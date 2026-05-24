// HRM-2.7 — Cross-module regression suite.
//
// Run with: node backend/tests/hrm/hrm-regression.test.mjs
// or         npm run test:hrm-regression
//
// This isn't a re-run of every per-module test — those run as their
// own suites. This file pins down the end-to-end flows where two or
// more services hand off to each other, plus the RBAC seeds the rest
// of the suite assumes (super_admin sees everything; the
// employee_self_service role can do its own thing but is blocked from
// admin paths).
//
// Five flows:
//   1. Hire candidate → onboarding checklist materialises with the
//      right tasks via the hire hook (cross: recruitment + onboarding)
//   2. Leave request → approve → balance.pending → balance.used in
//      one tx (cross: leave service + balance bookkeeping)
//   3. Timesheet submit → approve → present in the payroll engine's
//      approved-entries query; non-approved entries excluded (cross:
//      timesheets + payroll engine's read filter)
//   4. RBAC happy path: a seeded super_admin has every HRM perm
//   5. RBAC negative: employee_self_service is blocked on the admin
//      routes (hrm.cases.execute, hrm.policies.write, hrm.training.write)

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { hireCandidate, createCandidate, updateCandidateStage, createJobPosting } from '../../services/hrm/recruitment.service.mjs';
import { createTemplate } from '../../services/hrm/onboarding.service.mjs';
import { createRequest, approveRequest } from '../../services/hrm/leave.service.mjs';
import { upsertEntry, submitEntry, approveEntry } from '../../services/hrm/timesheets.service.mjs';
import { getUserPermissions, invalidateCache } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_regression_test_${RUN}__`;
const DOMAIN = `${RUN}.regression-test.invalid`;

const TRACKED = {
  userIds: new Set(),
  hiredUserIds: new Set(),
  candidateIds: new Set(),
  postingIds: new Set(),
  templateIds: new Set(),
  policyIds: new Set(),
  leaveRequestIds: new Set(),
  entryIds: new Set(),
};

async function setup() {
  const department = await prisma.department.findFirst({
    where: { isDeleted: false, isActive: true }, orderBy: { createdAt: 'asc' },
  });
  if (!department) throw new Error('No department available — seed DB first');

  // We need a CONTRIBUTOR role for the hire path (recruitmentOnboarding
  // assigns it). Make sure it exists.
  const role = await prisma.role.findFirst({
    where: { code: { in: ['CONTRIBUTOR', 'employee_self_service'] }, isDeleted: false, isActive: true },
  });
  if (!role) {
    await prisma.role.create({
      data: { code: 'CONTRIBUTOR', name: 'CONTRIBUTOR', label: 'Contributor (regression bootstrap)', isActive: true, isSystem: false },
    });
  }

  // An actor with write perms on the seed (any existing privileged user works).
  const actor = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true, hasSystemAccess: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!actor) throw new Error('No active actor user — seed DB first');

  return { department, actor };
}

async function teardown() {
  for (const eid of TRACKED.entryIds) await prisma.timesheetEntry.deleteMany({ where: { id: eid } });
  for (const lid of TRACKED.leaveRequestIds) await prisma.leaveRequest.deleteMany({ where: { id: lid } });
  for (const pid of TRACKED.policyIds) {
    await prisma.leaveBalance.deleteMany({ where: { policyId: pid } });
    await prisma.leavePolicy.deleteMany({ where: { id: pid } });
  }
  for (const cid of TRACKED.candidateIds) {
    await prisma.accessProvisioning.deleteMany({ where: { candidateId: cid } });
    await prisma.recruitmentCandidate.deleteMany({ where: { id: cid } });
  }
  for (const uid of TRACKED.hiredUserIds) {
    await prisma.timesheetEntry.deleteMany({ where: { userId: uid } });
    await prisma.timesheetEntry.deleteMany({ where: { approvedByUserId: uid } });
    await prisma.leaveRequest.deleteMany({ where: { userId: uid } });
    await prisma.leaveBalance.deleteMany({ where: { userId: uid } });
    await prisma.onboardingChecklistTask.deleteMany({ where: { checklist: { userId: uid } } });
    await prisma.onboardingChecklist.deleteMany({ where: { userId: uid } });
    await prisma.auditLog.deleteMany({ where: { entityId: uid } });
    await prisma.accessProvisioning.deleteMany({ where: { userId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.hrmEmploymentProfile.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
  for (const uid of TRACKED.userIds) {
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
    invalidateCache(uid);
  }
  for (const pid of TRACKED.postingIds) await prisma.jobPosting.deleteMany({ where: { id: pid } });
  for (const tid of TRACKED.templateIds) {
    await prisma.onboardingChecklistTask.deleteMany({ where: { templateTask: { templateId: tid } } });
    await prisma.onboardingChecklist.deleteMany({ where: { templateId: tid } });
    await prisma.onboardingTemplateTask.deleteMany({ where: { templateId: tid } });
    await prisma.onboardingTemplate.deleteMany({ where: { id: tid } });
  }
}

async function flowHireToOnboarding({ actor, department }) {
  // Department-scoped onboarding template — hire hook should pick it
  // up via resolveTemplateForDepartment.
  const template = await createTemplate(prisma, {
    name: `${PREFIX} dept tpl`,
    departmentId: department.id,
    isActive: true,
    tasks: [
      { title: 'IT setup', assignedRole: 'it', isRequired: true, order: 0 },
      { title: 'HR welcome', assignedRole: 'hr', isRequired: true, order: 1 },
    ],
  });
  TRACKED.templateIds.add(template.id);

  const posting = await createJobPosting(prisma, {
    title: `${PREFIX} posting`, departmentId: department.id,
    description: 'cross-module flow test', statusCode: 'open',
  }, { actorUserId: actor.id });
  TRACKED.postingIds.add(posting.id);

  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} hire-flow`,
    personalEmail: `flow-${RUN}@${DOMAIN}`,
    position: 'Engineer',
    recruitmentDepartmentId: department.id,
    jobPostingId: posting.id,
  });
  TRACKED.candidateIds.add(candidate.id);
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'screening' });
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'offer' });

  const result = await hireCandidate(prisma, candidate.id, {
    professionalEmail: `hire-flow-${RUN}@${DOMAIN}`,
  }, { actorUserId: actor.id });
  TRACKED.hiredUserIds.add(result.provisioning.userId);

  assert.ok(result.onboardingChecklistId, 'hire hook returned an onboardingChecklistId');
  const checklist = await prisma.onboardingChecklist.findUnique({
    where: { id: result.onboardingChecklistId },
    include: { tasks: true },
  });
  assert.equal(checklist.userId, result.provisioning.userId);
  assert.equal(checklist.statusCode, 'in_progress');
  assert.equal(checklist.tasks.length, 2, 'checklist hydrated from template tasks');
  console.log('  ✓ flow: hire → onboarding checklist auto-created with 2 template tasks');
  return { hiredUserId: result.provisioning.userId };
}

async function flowLeaveRequestApprove({ hiredUserId, actor }) {
  // Policy + balance.
  const policy = await prisma.leavePolicy.create({
    data: { name: `${PREFIX} policy`, leaveType: 'annual', daysPerYear: 20, requiresApproval: true, noticeDays: 0, isActive: true },
  });
  TRACKED.policyIds.add(policy.id);
  await prisma.leaveBalance.create({
    data: { userId: hiredUserId, policyId: policy.id, year: 2030, allocated: 10, used: 0, pending: 0, carryOver: 0 },
  });

  const req = await createRequest(prisma, {
    userId: hiredUserId,
    policyId: policy.id,
    startDate: '2030-08-05',  // Monday (2030-08-04 was Sunday)
    endDate:   '2030-08-07',  // Wednesday → 3 days
  }, { actorUserId: hiredUserId });
  TRACKED.leaveRequestIds.add(req.id);
  assert.equal(req.days, 3);
  assert.equal(req.statusCode, 'pending');

  let bal = await prisma.leaveBalance.findFirst({ where: { userId: hiredUserId, policyId: policy.id, year: 2030 } });
  assert.equal(Number(bal.pending), 3, 'pending = 3 after request');
  assert.equal(Number(bal.used),    0, 'used = 0 before approve');

  await approveRequest(prisma, req.id, { reviewerUserId: actor.id });
  bal = await prisma.leaveBalance.findFirst({ where: { userId: hiredUserId, policyId: policy.id, year: 2030 } });
  assert.equal(Number(bal.pending), 0, 'pending → 0 after approve');
  assert.equal(Number(bal.used),    3, 'used   → 3 after approve');
  console.log('  ✓ flow: leave request → approve → balance.pending=0, used=3 (one tx)');
}

async function flowTimesheetSubmitApprovePayroll({ hiredUserId, actor }) {
  // One draft entry, one we submit + approve.
  const draft = await upsertEntry(prisma, {
    userId: hiredUserId,
    workDate: '2030-09-02',  // Monday
    hours: 4,
  }, { actorUserId: hiredUserId });
  TRACKED.entryIds.add(draft.id);
  assert.equal(draft.statusCode, 'draft');

  const submitted = await upsertEntry(prisma, {
    userId: hiredUserId,
    workDate: '2030-09-03',  // Tuesday — different day so the upsert creates a second row
    hours: 8,
  }, { actorUserId: hiredUserId });
  TRACKED.entryIds.add(submitted.id);
  const submittedNow = await submitEntry(prisma, submitted.id, { actorUserId: hiredUserId });
  assert.equal(submittedNow.statusCode, 'submitted');
  const approved = await approveEntry(prisma, submitted.id, { actorUserId: actor.id });
  assert.equal(approved.statusCode, 'approved');

  // Mirror the engine's read query (payrollEngine.service.mjs:404).
  const periodStart = new Date(Date.UTC(2030, 8, 1));
  const periodEnd   = new Date(Date.UTC(2030, 8, 30));
  const approvedEntries = await prisma.timesheetEntry.findMany({
    where: {
      isDeleted: false,
      statusCode: 'approved',
      workDate: { gte: periodStart, lte: periodEnd },
      userId: { in: [hiredUserId] },
    },
  });
  const ids = new Set(approvedEntries.map((e) => e.id));
  assert.ok(ids.has(approved.id),  'approved entry IS in the payroll engine result set');
  assert.ok(!ids.has(draft.id),    'draft entry is NOT in the payroll engine result set');
  console.log('  ✓ flow: timesheet submit → approve → payroll engine query includes approved, excludes draft');
}

async function rbacSuperAdminCanDoEverything() {
  // The seeded super_admin / ADMIN account has global:all:all_access.
  // Find it (the seed lists ebutsana@neox.io but any locked-admin works).
  const admin = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true, hasSystemAccess: true, email: { contains: '@neox.io' } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    console.log('  ⚠ skipping super_admin check — no @neox.io admin found in seed');
    return;
  }
  invalidateCache(admin.id);
  const perms = await getUserPermissions(admin.id);
  // We don't assert every key — only that the catalogue is well-populated
  // and the privileged ones we exercised this sprint are present.
  for (const key of [
    'hrm.leave.read', 'hrm.leave.execute',
    'hrm.recruitment.execute',
    'hrm.training.write',
    'hrm.policies.execute',
    'hrm.cases.execute',
    'hrm.timesheets.execute',
  ]) {
    assert.ok(perms.has(key), `super_admin should have ${key} (got ${perms.size} perms)`);
  }
  console.log(`  ✓ super_admin (${admin.email}) has all HRM-2 execute permissions (${perms.size} keys total)`);
}

async function rbacSelfServiceBlockedOnAdminRoutes() {
  // Create a fresh user, attach the seeded employee_self_service role,
  // and confirm the admin-only keys are absent.
  const role = await prisma.role.findFirst({ where: { code: 'employee_self_service', isDeleted: false } });
  if (!role) {
    console.log('  ⚠ skipping self-service check — employee_self_service role not seeded');
    return;
  }
  const user = await prisma.user.create({
    data: { email: `selfsvc-${RUN}@${DOMAIN}`, name: `${PREFIX} self`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(user.id);
  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, validFrom: new Date(), validTo: null },
  });
  invalidateCache(user.id);
  const perms = await getUserPermissions(user.id);

  // Allowed (the seed lists these for the self-service role).
  assert.ok(perms.has('hrm.leave.read'),     'self-service has hrm.leave.read');
  assert.ok(perms.has('hrm.policies.read'),  'self-service has hrm.policies.read');

  // Denied — admin / execute paths must NOT be in the set.
  for (const key of [
    'hrm.cases.execute',
    'hrm.policies.write',
    'hrm.training.write',
    'hrm.recruitment.execute',
    'hrm.leave.execute',
  ]) {
    assert.ok(!perms.has(key), `self-service must NOT have ${key}`);
  }
  console.log('  ✓ employee_self_service has the self perms and is blocked on every admin/execute key');
}

async function main() {
  console.log('🧪 HRM-2.7 — Cross-module regression suite');
  console.log('');
  try {
    console.log('Setup:');
    const { actor, department } = await setup();
    console.log(`  ✓ actor=${actor.email}, department=${department.name}`);
    console.log('');
    console.log('Flows:');
    const { hiredUserId } = await flowHireToOnboarding({ actor, department });
    await flowLeaveRequestApprove({ hiredUserId, actor });
    await flowTimesheetSubmitApprovePayroll({ hiredUserId, actor });
    console.log('');
    console.log('RBAC:');
    await rbacSuperAdminCanDoEverything();
    await rbacSelfServiceBlockedOnAdminRoutes();
    console.log('');
    console.log('✅ All HRM-2.7 regression flows passed.');
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
  console.error('❌ Regression tests failed:', e);
  process.exit(1);
});
