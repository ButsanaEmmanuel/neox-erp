// HRM-2.4 — Integration tests for the HR policies service.
//
// Run with: node backend/tests/hrm/hrm-policies.test.mjs
// or         npm run test:hrm-policies
//
// Coverage matches the HRM-2.4 exit criteria for the policies side:
//   1. publishPolicy: draft → published, publishedAt stamped
//   2. acknowledgePolicy twice → 409 ALREADY_ACKNOWLEDGED with
//      the existing acknowledgementId + signedAt
//   3. archivePolicy: published → archived, archivedAt stamped
//   4. assertPermission denies a user lacking hrm.policies.execute
//      on the publish path (mocked res, no HTTP)

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createPolicy,
  publishPolicy,
  archivePolicy,
  acknowledgePolicy,
} from '../../services/hrm/policies.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_policies_test_${RUN}__`;
const DOMAIN = `${RUN}.policies-test.invalid`;

const TRACKED = { policyIds: new Set(), userIds: new Set() };

async function setup() {
  const author = await prisma.user.create({
    data: { email: `author-${RUN}@${DOMAIN}`, name: `${PREFIX} author`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(author.id);
  const reader = await prisma.user.create({
    data: { email: `reader-${RUN}@${DOMAIN}`, name: `${PREFIX} reader`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(reader.id);
  const noPerms = await prisma.user.create({
    data: { email: `noperm-${RUN}@${DOMAIN}`, name: `${PREFIX} no-perms`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(noPerms.id);
  return { author, reader, noPerms };
}

async function teardown() {
  for (const pid of TRACKED.policyIds) {
    await prisma.policyAcknowledgement.deleteMany({ where: { policyId: pid } });
    await prisma.hrmPolicy.deleteMany({ where: { id: pid } });
  }
  for (const uid of TRACKED.userIds) {
    await prisma.policyAcknowledgement.deleteMany({ where: { userId: uid } });
    await prisma.hrmPolicy.deleteMany({ where: { createdByUserId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

async function checkPublish({ author }) {
  const policy = await createPolicy(prisma, {
    title: `${PREFIX} Code of Conduct`,
    category: 'conduct',
    content: 'Be kind. Ship quickly. Document why.',
    version: '1.0',
  }, { actorUserId: author.id });
  TRACKED.policyIds.add(policy.id);
  assert.equal(policy.statusCode, 'draft', 'created in draft');
  assert.equal(policy.publishedAt, null);

  const published = await publishPolicy(prisma, policy.id);
  assert.equal(published.statusCode, 'published');
  assert.ok(published.publishedAt instanceof Date, 'publishedAt stamped');
  console.log('  ✓ publishPolicy moves draft → published with publishedAt stamped');
  return published;
}

async function checkDoubleAck({ policyId, reader }) {
  const first = await acknowledgePolicy(prisma, policyId, { actorUserId: reader.id });
  assert.equal(first.userId, reader.id);
  assert.equal(first.policyId, policyId);

  let err;
  try {
    await acknowledgePolicy(prisma, policyId, { actorUserId: reader.id });
  } catch (e) { err = e; }
  assert.ok(err, 'second ack should throw');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'ALREADY_ACKNOWLEDGED');
  assert.equal(err.acknowledgementId, first.id, 'payload exposes the existing ack id');
  assert.ok(err.signedAt, 'signedAt surfaced');
  console.log('  ✓ double acknowledge → 409 ALREADY_ACKNOWLEDGED with existing id');
}

async function checkArchive({ policyId }) {
  const archived = await archivePolicy(prisma, policyId);
  assert.equal(archived.statusCode, 'archived');
  assert.ok(archived.archivedAt instanceof Date, 'archivedAt stamped');

  // Re-publishing an archived policy must be refused.
  let err;
  try { await publishPolicy(prisma, policyId); } catch (e) { err = e; }
  assert.ok(err, 'republish of archived must throw');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'POLICY_ARCHIVED');
  console.log('  ✓ archivePolicy stamps archivedAt + refuses republish');
}

async function checkAssertPermissionDeniesPublish({ noPerms }) {
  let writtenStatus = null;
  let writtenBody = null;
  const fakeRes = {
    headersSent: false,
    writeHead(s) { writtenStatus = s; this.headersSent = true; },
    end(b) { writtenBody = b; },
  };
  const allowed = await assertPermission(
    { userId: noPerms.id, res: fakeRes },
    'hrm.policies.execute',
  );
  assert.equal(allowed, false);
  assert.equal(writtenStatus, 403);
  const payload = JSON.parse(writtenBody);
  assert.equal(payload.code, 'PERMISSION_DENIED');
  assert.equal(payload.required, 'hrm.policies.execute');
  console.log('  ✓ assertPermission denies a user lacking hrm.policies.execute (403)');
}

async function main() {
  console.log('🧪 HRM-2.4 — Policies integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const { author, reader, noPerms } = await setup();
    console.log(`  ✓ author=${author.email}, reader=${reader.email}, noPerms=${noPerms.email}`);
    console.log('');
    console.log('Integration:');
    const published = await checkPublish({ author });
    await checkDoubleAck({ policyId: published.id, reader });
    await checkArchive({ policyId: published.id });
    await checkAssertPermissionDeniesPublish({ noPerms });
    console.log('');
    console.log('✅ All HRM-2.4 policies tests passed.');
  } finally {
    console.log('');
    console.log('Teardown:');
    try {
      await teardown();
      console.log('  ✓ test data removed');
    } catch (e) {
      console.error('  ✗ teardown failed:', e?.message ?? e);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Policies tests failed:', e);
  process.exit(1);
});
