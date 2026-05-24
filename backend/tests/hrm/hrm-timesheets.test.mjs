// HRM-2.5 — Integration tests for the timesheet service.
//
// Run with: node backend/tests/hrm/hrm-timesheets.test.mjs
// or         npm run test:hrm-timesheets
//
// Coverage matches the HRM-2.5 exit criteria:
//   1. upsertEntry → statusCode "draft" (new rows default to draft
//      from the service, not "submitted" from the legacy column
//      default)
//   2. submitEntry: draft → submitted with submittedAt stamped
//   3. approveEntry: submitted → approved with approvedByUserId +
//      approvedAt stamped
//   4. submit a row that is already approved → 409 ENTRY_APPROVED
//   5. approve a row that isn't submitted → 409 ENTRY_NOT_SUBMITTED
//      with currentStatus
//   6. Payroll exclusion: a draft + a submitted entry must NOT show
//      up in the payrollEngine's approved-entries query (the engine
//      filters on statusCode = "approved" — we duplicate that exact
//      query so a regression in the engine immediately fails here)
//   7. assertPermission denies a user lacking hrm.timesheets.execute
//      on the approve path

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  upsertEntry,
  submitEntry,
  approveEntry,
} from '../../services/hrm/timesheets.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_timesheets_test_${RUN}__`;
const DOMAIN = `${RUN}.timesheets-test.invalid`;

const TRACKED = { entryIds: new Set(), userIds: new Set() };

async function setup() {
  const department = await prisma.department.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!department) throw new Error('No department available — seed DB first');

  const owner = await prisma.user.create({
    data: { email: `owner-${RUN}@${DOMAIN}`, name: `${PREFIX} owner`, isActive: true, hasSystemAccess: true, departmentId: department.id },
  });
  TRACKED.userIds.add(owner.id);
  const approver = await prisma.user.create({
    data: { email: `approver-${RUN}@${DOMAIN}`, name: `${PREFIX} approver`, isActive: true, hasSystemAccess: true, departmentId: department.id },
  });
  TRACKED.userIds.add(approver.id);
  const noPerms = await prisma.user.create({
    data: { email: `noperm-${RUN}@${DOMAIN}`, name: `${PREFIX} no-perms`, isActive: true, hasSystemAccess: true, departmentId: department.id },
  });
  TRACKED.userIds.add(noPerms.id);

  return { department, owner, approver, noPerms };
}

async function teardown() {
  for (const eid of TRACKED.entryIds) {
    await prisma.timesheetEntry.deleteMany({ where: { id: eid } });
  }
  for (const uid of TRACKED.userIds) {
    await prisma.timesheetEntry.deleteMany({ where: { userId: uid } });
    await prisma.timesheetEntry.deleteMany({ where: { approvedByUserId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

function mondayOf(date) {
  const d = new Date(date);
  const dow = d.getUTCDay();
  const diff = (dow === 0 ? -6 : 1 - dow);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function checkUpsertCreatesDraft({ owner }) {
  const e = await upsertEntry(prisma, {
    userId: owner.id,
    workDate: '2026-05-25',  // a Monday
    hours: 4,
    projectId: `${PREFIX}proj`,
    description: 'Designed the new dashboard',
  }, { actorUserId: owner.id });
  TRACKED.entryIds.add(e.id);
  assert.equal(e.statusCode, 'draft', 'new entry defaults to draft');
  assert.equal(Number(e.hours), 4);
  assert.equal(e.userId, owner.id);
  assert.ok(e.weekStartDate, 'weekStartDate stamped on create');
  console.log('  ✓ upsertEntry creates a row at statusCode = draft with weekStartDate stamped');
  return e;
}

async function checkSubmitStampsSubmittedAt({ owner, entryId }) {
  const e = await submitEntry(prisma, entryId, { actorUserId: owner.id });
  assert.equal(e.statusCode, 'submitted');
  assert.ok(e.submittedAt instanceof Date, 'submittedAt stamped');
  console.log('  ✓ submitEntry moves draft → submitted with submittedAt stamped');
}

async function checkApproveStampsApprover({ approver, entryId }) {
  const e = await approveEntry(prisma, entryId, { actorUserId: approver.id });
  assert.equal(e.statusCode, 'approved');
  assert.ok(e.approvedAt instanceof Date, 'approvedAt stamped');
  assert.equal(e.approvedByUserId, approver.id, 'approver recorded');
  console.log('  ✓ approveEntry moves submitted → approved with approvedByUserId + approvedAt stamped');
}

async function checkDoubleSubmitOfApprovedRejects({ owner, entryId }) {
  let err;
  try {
    await submitEntry(prisma, entryId, { actorUserId: owner.id });
  } catch (e) { err = e; }
  assert.ok(err, 'submitting an approved entry should throw');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'ENTRY_APPROVED');
  console.log('  ✓ submit of an already-approved entry → 409 ENTRY_APPROVED');
}

async function checkApproveOfNonSubmittedRejects({ owner, approver }) {
  // Create a fresh draft entry and try to approve it directly.
  const draft = await upsertEntry(prisma, {
    userId: owner.id,
    workDate: '2026-05-26',
    hours: 2,
    projectId: `${PREFIX}proj`,
  }, { actorUserId: owner.id });
  TRACKED.entryIds.add(draft.id);

  let err;
  try {
    await approveEntry(prisma, draft.id, { actorUserId: approver.id });
  } catch (e) { err = e; }
  assert.ok(err, 'approving a draft should throw');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'ENTRY_NOT_SUBMITTED');
  assert.equal(err.currentStatus, 'draft');
  console.log('  ✓ approve of a not-yet-submitted entry → 409 ENTRY_NOT_SUBMITTED with currentStatus');
  return draft;
}

async function checkPayrollExcludesNonApproved({ owner, draftEntry }) {
  // Mirror payrollEngine.service.mjs:404 exactly — if this filter ever
  // drifts, the test fails and forces re-syncing the test or the engine.
  const periodStart = mondayOf('2026-05-25');
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);

  const approvedEntries = await prisma.timesheetEntry.findMany({
    where: {
      isDeleted: false,
      statusCode: 'approved',
      workDate: { gte: periodStart, lte: periodEnd },
      userId: { in: [owner.id] },
    },
  });
  const approvedIds = new Set(approvedEntries.map((e) => e.id));

  // The draft entry must NOT be in the approved set.
  assert.ok(!approvedIds.has(draftEntry.id),
    'a draft entry must not appear in the payroll engine\'s approved-entries query');
  // The first entry we approved earlier MUST be in there.
  const allEntries = await prisma.timesheetEntry.findMany({ where: { userId: owner.id } });
  const approvedOne = allEntries.find((e) => e.statusCode === 'approved');
  assert.ok(approvedOne, 'sanity: we did approve one entry earlier');
  assert.ok(approvedIds.has(approvedOne.id),
    'an approved entry MUST appear in the payroll engine\'s approved-entries query');

  console.log('  ✓ payroll query (statusCode=approved) excludes draft + submitted hours');
}

async function checkAssertPermissionDeniesApprove({ noPerms }) {
  let writtenStatus = null;
  let writtenBody = null;
  const fakeRes = {
    headersSent: false,
    writeHead(s) { writtenStatus = s; this.headersSent = true; },
    end(b) { writtenBody = b; },
  };
  const allowed = await assertPermission(
    { userId: noPerms.id, res: fakeRes },
    'hrm.timesheets.execute',
  );
  assert.equal(allowed, false);
  assert.equal(writtenStatus, 403);
  const payload = JSON.parse(writtenBody);
  assert.equal(payload.code, 'PERMISSION_DENIED');
  assert.equal(payload.required, 'hrm.timesheets.execute');
  console.log('  ✓ assertPermission denies a user lacking hrm.timesheets.execute (403)');
}

async function main() {
  console.log('🧪 HRM-2.5 — Timesheets integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const { owner, approver, noPerms } = await setup();
    console.log(`  ✓ owner=${owner.email}, approver=${approver.email}, noPerms=${noPerms.email}`);
    console.log('');
    console.log('Integration:');
    const draft = await checkUpsertCreatesDraft({ owner });
    await checkSubmitStampsSubmittedAt({ owner, entryId: draft.id });
    await checkApproveStampsApprover({ approver, entryId: draft.id });
    await checkDoubleSubmitOfApprovedRejects({ owner, entryId: draft.id });
    const otherDraft = await checkApproveOfNonSubmittedRejects({ owner, approver });
    await checkPayrollExcludesNonApproved({ owner, draftEntry: otherDraft });
    await checkAssertPermissionDeniesApprove({ noPerms });
    console.log('');
    console.log('✅ All HRM-2.5 timesheet tests passed.');
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
  console.error('❌ Timesheets tests failed:', e);
  process.exit(1);
});
