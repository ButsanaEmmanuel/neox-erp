// HRM-2.7 — Integration tests for the contractor upsert flow.
//
// Run with: node backend/tests/hrm/hrm-contractors.test.mjs
// or         npm run test:hrm-contractors
//
// Coverage:
//   1. upsertContractor first call → { created: true } + User +
//      HrmEmploymentProfile(employmentType='contractor', source-aware
//      creationSource)
//   2. upsertContractor same email → { created: false, id == first.id }
//      (idempotent — no duplicate User, no duplicate profile)
//   3. Bulk-import source ("TELECOM_IMPORT") routes through the same
//      helper and lands as creationSource = 'TELECOM_IMPORT'
//   4. The freshly-upserted contractor appears in
//      listAssignableEmployees (the directory endpoint behind the
//      WorkItem assignee picker)

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { upsertContractor } from '../../services/hrm/contractorUpsert.service.mjs';
import { listAssignableEmployees } from '../../services/hrm/assignables.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_contractors_test_${RUN}__`;
const DOMAIN = `${RUN}.contractors-test.invalid`;

const TRACKED = { userIds: new Set() };

async function teardown() {
  for (const uid of TRACKED.userIds) {
    await prisma.hrmEmploymentProfile.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

async function checkFirstUpsertCreates() {
  const email = `contractor-${RUN}@${DOMAIN}`;
  const r = await upsertContractor(prisma, {
    firstName: 'Alice', lastName: 'Vendor', email,
    source: 'manual_contractor',
  });
  TRACKED.userIds.add(r.id);
  assert.equal(r.created, true);
  assert.ok(r.id, 'returns the new user id');

  const profile = await prisma.hrmEmploymentProfile.findFirst({ where: { userId: r.id } });
  assert.ok(profile, 'HrmEmploymentProfile created');
  assert.equal(profile.employmentType, 'contractor');
  assert.equal(profile.statusCode, 'active');
  assert.equal(profile.creationSource, 'MANUAL', 'source "manual_contractor" → creationSource MANUAL');
  console.log('  ✓ first upsert creates User + contractor profile (created=true)');
  return { id: r.id, email };
}

async function checkSecondUpsertIsIdempotent({ id, email }) {
  const r = await upsertContractor(prisma, {
    firstName: 'Alice', lastName: 'Vendor', email,
  });
  assert.equal(r.created, false, 'second call must NOT create');
  assert.equal(r.id, id, 'same id returned');

  const dupCount = await prisma.user.count({ where: { email } });
  assert.equal(dupCount, 1, 'still exactly one User row for this email');
  const profileCount = await prisma.hrmEmploymentProfile.count({ where: { userId: id } });
  assert.equal(profileCount, 1, 'still exactly one HrmEmploymentProfile for this contractor');
  console.log('  ✓ second upsert on the same email returns created=false + same id (idempotent)');
}

async function checkBulkImportSource() {
  const email = `bulk-${RUN}@${DOMAIN}`;
  const r = await upsertContractor(prisma, {
    firstName: 'Bob', lastName: 'Telecom', email,
    source: 'TELECOM_IMPORT',
    externalRef: `telecom-${RUN}`,
  });
  TRACKED.userIds.add(r.id);
  const profile = await prisma.hrmEmploymentProfile.findFirst({ where: { userId: r.id } });
  assert.equal(profile.creationSource, 'TELECOM_IMPORT', 'bulk-import source survives the round trip');
  assert.equal(profile.reviewNotesJson?.externalRef, `telecom-${RUN}`, 'externalRef captured in reviewNotesJson');
  console.log('  ✓ bulk-import source routes through the helper and lands as TELECOM_IMPORT');
  return r.id;
}

async function checkContractorAppearsInAssignables({ contractorId }) {
  const assignables = await listAssignableEmployees(prisma, {});
  const found = assignables.find((e) => e.id === contractorId);
  assert.ok(found, 'fresh contractor shows up in the assignable employees list');
  assert.equal(found.employmentType, 'contractor');

  // Filter by employmentType also returns it.
  const onlyContractors = await listAssignableEmployees(prisma, { employmentType: 'contractor' });
  assert.ok(onlyContractors.some((e) => e.id === contractorId),
    'employmentType=contractor filter includes the new contractor');
  console.log('  ✓ contractor is visible in GET /hrm/employees?assignable=true');
}

async function main() {
  console.log('🧪 HRM-2.7 — Contractor upsert integration tests');
  console.log('');
  try {
    console.log('Integration:');
    const first = await checkFirstUpsertCreates();
    await checkSecondUpsertIsIdempotent(first);
    const bulkId = await checkBulkImportSource();
    await checkContractorAppearsInAssignables({ contractorId: bulkId });
    console.log('');
    console.log('✅ All HRM-2.7 contractor tests passed.');
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
  console.error('❌ Contractor tests failed:', e);
  process.exit(1);
});
