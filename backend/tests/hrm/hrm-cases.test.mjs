// HRM-2.4 — Integration tests for the HR cases service.
//
// Run with: node backend/tests/hrm/hrm-cases.test.mjs
// or         npm run test:hrm-cases
//
// Coverage matches the HRM-2.4 exit criteria for the cases side:
//   1. createCase → statusCode "open" + opening event in HrmCaseEvent
//   2. changeStatus(escalated) by caller with canExecute → statusCode
//      "escalated", escalatedAt stamped, event row written
//   3. changeStatus(closed)    → statusCode "closed", closedAt stamped,
//      resolution recorded from the note
//   4. assertPermission denies a user lacking hrm.cases.execute on
//      escalate (mocked res, no HTTP)
//   5. Illegal transition closed → anywhere returns 409
//      ILLEGAL_TRANSITION
//   6. Listing scoped to forUserId returns only reported-by-me OR
//      assigned-to-me cases

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createCase,
  changeStatus,
  listCases,
} from '../../services/hrm/cases.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_cases_test_${RUN}__`;
const DOMAIN = `${RUN}.cases-test.invalid`;

const TRACKED = { caseIds: new Set(), userIds: new Set() };

async function setup() {
  const reporter = await prisma.user.create({
    data: { email: `reporter-${RUN}@${DOMAIN}`, name: `${PREFIX} reporter`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(reporter.id);
  const assignee = await prisma.user.create({
    data: { email: `assignee-${RUN}@${DOMAIN}`, name: `${PREFIX} assignee`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(assignee.id);
  const stranger = await prisma.user.create({
    data: { email: `stranger-${RUN}@${DOMAIN}`, name: `${PREFIX} stranger`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(stranger.id);
  const noPerms = await prisma.user.create({
    data: { email: `noperm-${RUN}@${DOMAIN}`, name: `${PREFIX} no-perms`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(noPerms.id);
  return { reporter, assignee, stranger, noPerms };
}

async function teardown() {
  for (const cid of TRACKED.caseIds) {
    await prisma.hrmCaseEvent.deleteMany({ where: { caseId: cid } });
    await prisma.hrmCase.deleteMany({ where: { id: cid } });
  }
  for (const uid of TRACKED.userIds) {
    await prisma.hrmCaseEvent.deleteMany({ where: { authorUserId: uid } });
    await prisma.hrmCase.deleteMany({ where: { reportedByUserId: uid } });
    await prisma.hrmCase.deleteMany({ where: { assignedToUserId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

async function checkCreate({ reporter, assignee }) {
  const c = await createCase(prisma, {
    caseType: 'incident',
    title: `${PREFIX} workplace safety incident`,
    description: 'Spilled coffee on the keyboard, requested replacement.',
    priority: 'medium',
    assignedToUserId: assignee.id,
  }, { actorUserId: reporter.id });
  TRACKED.caseIds.add(c.id);
  assert.equal(c.statusCode, 'open');
  assert.equal(c.reportedByUserId, reporter.id);
  assert.equal(c.assignedToUserId, assignee.id);

  // Opening event written.
  const events = await prisma.hrmCaseEvent.findMany({ where: { caseId: c.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'status_change');
  assert.equal(events[0].fromStatus, null);
  assert.equal(events[0].toStatus, 'open');
  console.log('  ✓ createCase opens at "open" + writes an opening event');
  return c;
}

async function checkEscalate({ caseId, reporter }) {
  // canExecute = true so the call goes through (reporter doesn't own
  // the execute perm in real RBAC, but the service-level flag is what
  // the route exposes).
  const updated = await changeStatus(prisma, caseId, {
    toStatus: 'escalated',
    note: 'Manager unreachable — escalating to HR director',
    actorUserId: reporter.id,
    canExecute: true,
    actorIsAssignee: false,
  });
  assert.equal(updated.statusCode, 'escalated');
  assert.ok(updated.escalatedAt, 'escalatedAt stamped');

  const events = await prisma.hrmCaseEvent.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } });
  const last = events[events.length - 1];
  assert.equal(last.eventType, 'status_change');
  assert.equal(last.fromStatus, 'open');
  assert.equal(last.toStatus, 'escalated');
  console.log('  ✓ escalate stamps escalatedAt + appends a status_change event');
}

async function checkClose({ caseId, reporter }) {
  // Move escalated → resolved first (closed only follows resolved/escalated/...).
  await changeStatus(prisma, caseId, {
    toStatus: 'resolved', note: 'IT replaced the keyboard',
    actorUserId: reporter.id, canExecute: true, actorIsAssignee: false,
  });
  const closed = await changeStatus(prisma, caseId, {
    toStatus: 'closed', note: 'Confirmed by reporter — closing the loop',
    actorUserId: reporter.id, canExecute: true, actorIsAssignee: false,
  });
  assert.equal(closed.statusCode, 'closed');
  assert.ok(closed.closedAt, 'closedAt stamped');
  assert.equal(closed.resolution, 'Confirmed by reporter — closing the loop', 'resolution recorded from note');
  console.log('  ✓ close stamps closedAt + records resolution from the note');
}

async function checkClosedIsTerminal({ caseId, reporter }) {
  let err;
  try {
    await changeStatus(prisma, caseId, {
      toStatus: 'investigating', actorUserId: reporter.id,
      canExecute: true, actorIsAssignee: false,
    });
  } catch (e) { err = e; }
  assert.ok(err, 'closed → investigating must throw');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'ILLEGAL_TRANSITION');
  assert.equal(err.from, 'closed');
  console.log('  ✓ closed is terminal — any further transition returns 409 ILLEGAL_TRANSITION');
}

async function checkAssertPermissionDeniesEscalate({ noPerms }) {
  let writtenStatus = null;
  let writtenBody = null;
  const fakeRes = {
    headersSent: false,
    writeHead(s) { writtenStatus = s; this.headersSent = true; },
    end(b) { writtenBody = b; },
  };
  const allowed = await assertPermission(
    { userId: noPerms.id, res: fakeRes },
    'hrm.cases.execute',
  );
  assert.equal(allowed, false);
  assert.equal(writtenStatus, 403);
  const payload = JSON.parse(writtenBody);
  assert.equal(payload.code, 'PERMISSION_DENIED');
  assert.equal(payload.required, 'hrm.cases.execute');
  console.log('  ✓ assertPermission denies a user lacking hrm.cases.execute (403)');
}

async function checkScopedListing({ reporter, stranger, assignee }) {
  // Open a stranger-only case so we have something to filter out.
  const strangerCase = await createCase(prisma, {
    caseType: 'inquiry',
    title:    `${PREFIX} stranger-only case`,
    description: 'Should NOT show up for the reporter scope',
    priority: 'low',
  }, { actorUserId: stranger.id });
  TRACKED.caseIds.add(strangerCase.id);

  const mine = await listCases(prisma, { forUserId: reporter.id });
  const myIds = new Set(mine.map((c) => c.id));
  assert.ok(myIds.size >= 1, 'reporter sees at least their own case');
  assert.ok(!myIds.has(strangerCase.id), 'reporter does NOT see the stranger-only case');

  // Assignee sees the reporter's case because they're assigned to it.
  const asAssignee = await listCases(prisma, { forUserId: assignee.id });
  assert.ok(asAssignee.some((c) => c.assignedToUserId === assignee.id), 'assignee sees cases assigned to them');
  assert.ok(!asAssignee.some((c) => c.id === strangerCase.id), 'assignee does NOT see unrelated cases');

  // Global listing (no forUserId) returns both, confirming the filter
  // is the cause of the scoping above.
  const all = await listCases(prisma, {});
  assert.ok(all.some((c) => c.id === strangerCase.id), 'global listing includes the stranger case');
  console.log('  ✓ listCases({forUserId}) scopes to reported-by-me OR assigned-to-me');
}

async function main() {
  console.log('🧪 HRM-2.4 — Cases integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const { reporter, assignee, stranger, noPerms } = await setup();
    console.log(`  ✓ reporter=${reporter.email}, assignee=${assignee.email}, stranger=${stranger.email}, noPerms=${noPerms.email}`);
    console.log('');
    console.log('Integration:');
    const opened = await checkCreate({ reporter, assignee });
    await checkEscalate({ caseId: opened.id, reporter });
    await checkClose({ caseId: opened.id, reporter });
    await checkClosedIsTerminal({ caseId: opened.id, reporter });
    await checkAssertPermissionDeniesEscalate({ noPerms });
    await checkScopedListing({ reporter, stranger, assignee });
    console.log('');
    console.log('✅ All HRM-2.4 cases tests passed.');
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
  console.error('❌ Cases tests failed:', e);
  process.exit(1);
});
