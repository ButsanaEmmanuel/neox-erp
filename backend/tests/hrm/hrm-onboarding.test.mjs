// HRM-2.2 — Integration tests for the Onboarding hire hook + checklist
// completion + completion stats.
//
// Run with: node backend/tests/hrm/hrm-onboarding.test.mjs
// or         npm run test:hrm-onboarding
//
// The HRM-2.2 contract under test:
//   1. hire forwards an explicit onboardingTemplateId  -> checklist created
//   2. hire with no templateId                         -> dept template wins
//   3. hire with bogus templateId                      -> user still created,
//                                                         checklist null
//      (rollback non-bloquant: the hire transaction MUST succeed even
//       when the post-tx checklist hook fails.)
//   4. updateChecklistTask flips the roll-up statusCode to 'completed'
//      once every required task is done.
//   5. getCompletionStats returns a sensible roll-up.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createTemplate, getCompletionStats, updateChecklistTask } from '../../services/hrm/onboarding.service.mjs';
import { createCandidate, updateCandidateStage, hireCandidate, createJobPosting } from '../../services/hrm/recruitment.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_onboarding_test_${RUN}__`;
const TEST_EMAIL_DOMAIN = `${RUN}.onboarding-test.invalid`;

const TRACKED = {
  templateIds: new Set(),
  postingIds: new Set(),
  candidateIds: new Set(),
  hiredUserIds: new Set(),
};

async function setup() {
  const actor = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true, hasSystemAccess: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!actor) throw new Error('No active user available — seed DB first');
  const department = await prisma.department.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!department) throw new Error('No department available — seed DB first');

  // Make sure a CONTRIBUTOR role exists (required by the hire path).
  const role = await prisma.role.findFirst({
    where: { code: { in: ['CONTRIBUTOR', 'employee_self_service'] }, isDeleted: false, isActive: true },
  });
  if (!role) {
    await prisma.role.create({
      data: {
        code: 'CONTRIBUTOR', name: 'CONTRIBUTOR', label: 'Contributor (test bootstrap)',
        isSystem: false, isActive: true,
      },
    });
  }

  // Create a department-scoped active template with 3 tasks (2 required).
  const template = await createTemplate(prisma, {
    name: `${PREFIX} dept template`,
    departmentId: department.id,
    isActive: true,
    tasks: [
      { title: 'IT setup', assignedRole: 'it', isRequired: true, dueOffsetDays: 1, order: 0 },
      { title: 'HR welcome packet', assignedRole: 'hr', isRequired: true, dueOffsetDays: 0, order: 1 },
      { title: 'Sign offer letter', assignedRole: 'employee', isRequired: false, dueOffsetDays: 2, order: 2 },
    ],
  });
  TRACKED.templateIds.add(template.id);

  return { actor, department, template };
}

async function createOfferReadyCandidate({ actor, department, suffix }) {
  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} cand-${suffix}`,
    personalEmail: `cand-${suffix}-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'Engineer',
    recruitmentDepartmentId: department.id,
  });
  TRACKED.candidateIds.add(candidate.id);
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'screening' });
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'offer' });
  return candidate;
}

async function teardown() {
  // Order: dependent rows first.
  for (const uid of TRACKED.hiredUserIds) {
    await prisma.onboardingChecklistTask.deleteMany({ where: { completedByUserId: uid } });
    await prisma.onboardingChecklistTask.deleteMany({ where: { checklist: { userId: uid } } });
    await prisma.onboardingChecklist.deleteMany({ where: { userId: uid } });
    await prisma.auditLog.deleteMany({ where: { entityId: uid } });
    await prisma.accessProvisioning.deleteMany({ where: { userId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.hrmEmploymentProfile.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
  for (const cid of TRACKED.candidateIds) {
    await prisma.auditLog.deleteMany({ where: { entityId: cid } });
    await prisma.accessProvisioning.deleteMany({ where: { candidateId: cid } });
    await prisma.recruitmentCandidate.deleteMany({ where: { id: cid } });
  }
  for (const pid of TRACKED.postingIds) {
    await prisma.jobPosting.deleteMany({ where: { id: pid } });
  }
  for (const tid of TRACKED.templateIds) {
    await prisma.onboardingChecklistTask.deleteMany({ where: { templateTask: { templateId: tid } } });
    await prisma.onboardingChecklist.deleteMany({ where: { templateId: tid } });
    await prisma.onboardingTemplateTask.deleteMany({ where: { templateId: tid } });
    await prisma.onboardingTemplate.deleteMany({ where: { id: tid } });
  }
}

async function checkExplicitTemplate({ actor, department, template }) {
  const candidate = await createOfferReadyCandidate({ actor, department, suffix: 'explicit' });
  const result = await hireCandidate(
    prisma,
    candidate.id,
    {
      professionalEmail: `hired-explicit-${RUN}@${TEST_EMAIL_DOMAIN}`,
      onboardingTemplateId: template.id,
    },
    { actorUserId: actor.id },
  );
  assert.ok(result.provisioning.userId, 'hire returns a userId');
  assert.ok(result.onboardingChecklistId, 'hire returns onboardingChecklistId when template explicit');
  TRACKED.hiredUserIds.add(result.provisioning.userId);
  const checklist = await prisma.onboardingChecklist.findUnique({
    where: { id: result.onboardingChecklistId },
    include: { tasks: true },
  });
  assert.equal(checklist.userId, result.provisioning.userId);
  assert.equal(checklist.tasks.length, 3, '3 tasks copied from template');
  console.log('  ✓ hire with explicit onboardingTemplateId materialises a checklist with all template tasks');
  return { checklistId: result.onboardingChecklistId, hiredUserId: result.provisioning.userId };
}

async function checkDepartmentTemplateFallback({ actor, department }) {
  // No explicit templateId, but the department has the template from setup() -> should be picked up.
  const candidate = await createOfferReadyCandidate({ actor, department, suffix: 'dept' });
  const result = await hireCandidate(
    prisma,
    candidate.id,
    { professionalEmail: `hired-dept-${RUN}@${TEST_EMAIL_DOMAIN}` },
    { actorUserId: actor.id },
  );
  TRACKED.hiredUserIds.add(result.provisioning.userId);
  assert.ok(result.onboardingChecklistId, 'department template picked up when templateId omitted');
  console.log('  ✓ hire without explicit templateId resolves to the active department template');
}

async function checkRollbackNonBlocking({ actor, department }) {
  const candidate = await createOfferReadyCandidate({ actor, department, suffix: 'rollback' });
  const result = await hireCandidate(
    prisma,
    candidate.id,
    {
      professionalEmail: `hired-rollback-${RUN}@${TEST_EMAIL_DOMAIN}`,
      onboardingTemplateId: 'tpl-does-not-exist-xyz',
    },
    { actorUserId: actor.id },
  );
  TRACKED.hiredUserIds.add(result.provisioning.userId);
  // User MUST have been created — the bogus templateId is swallowed.
  const user = await prisma.user.findUnique({ where: { id: result.provisioning.userId } });
  assert.ok(user, 'user materialised even when the checklist hook failed');
  const profile = await prisma.hrmEmploymentProfile.findUnique({ where: { userId: user.id } });
  assert.ok(profile, 'HrmEmploymentProfile materialised even when the checklist hook failed');
  assert.equal(result.onboardingChecklistId, null, 'onboardingChecklistId reported as null when hook failed');
  const checklistsForUser = await prisma.onboardingChecklist.count({ where: { userId: user.id } });
  assert.equal(checklistsForUser, 0, 'no checklist row leaked');
  console.log('  ✓ rollback non-bloquant: bogus templateId leaves the employee created, no checklist row leaked');
}

async function checkTaskCompletionRollup({ checklistId, hiredUserId }) {
  const tasks = await prisma.onboardingChecklistTask.findMany({
    where: { checklistId },
    include: { templateTask: { select: { isRequired: true } } },
    orderBy: { templateTask: { order: 'asc' } },
  });
  assert.equal(tasks.length, 3);
  const requiredTasks = tasks.filter((t) => t.templateTask.isRequired);
  assert.equal(requiredTasks.length, 2);

  // Complete one required — checklist should stay in_progress.
  await updateChecklistTask(prisma, {
    checklistId,
    taskId: requiredTasks[0].id,
    statusCode: 'done',
    completedByUserId: hiredUserId,
  });
  let cl = await prisma.onboardingChecklist.findUnique({ where: { id: checklistId } });
  assert.equal(cl.statusCode, 'in_progress', 'still in_progress after only one required done');

  // Complete the other required and skip the optional -> should flip to completed.
  await updateChecklistTask(prisma, {
    checklistId, taskId: requiredTasks[1].id, statusCode: 'done', completedByUserId: hiredUserId,
  });
  const optional = tasks.find((t) => !t.templateTask.isRequired);
  await updateChecklistTask(prisma, {
    checklistId, taskId: optional.id, statusCode: 'skipped', completedByUserId: hiredUserId,
  });
  cl = await prisma.onboardingChecklist.findUnique({ where: { id: checklistId } });
  assert.equal(cl.statusCode, 'completed', 'auto-completed when every required is done + every other is done|skipped');
  assert.ok(cl.completedAt, 'completedAt stamped');
  console.log('  ✓ updateChecklistTask flips the rolled-up statusCode to completed when required + others done|skipped');
}

async function checkCompletionStats({ hiredUserId }) {
  const stats = await getCompletionStats(prisma, { userId: hiredUserId });
  assert.ok(stats.length >= 1, 'stats include the hired user');
  const stat = stats[0];
  assert.equal(stat.total, 3);
  assert.equal(stat.done, 2, '2 tasks marked done (the third is skipped)');
  assert.ok(stat.progressPct >= 60, `progress >= 60% (got ${stat.progressPct})`);
  console.log('  ✓ getCompletionStats rolls up tasks correctly per user');
}

async function main() {
  console.log('🧪 HRM-2.2 — Onboarding hire hook + completion + stats');
  console.log('');
  try {
    console.log('Setup:');
    const { actor, department, template } = await setup();
    console.log(`  ✓ actor = ${actor.email ?? actor.id}, department = ${department.name}, template = ${template.id}`);
    console.log('');
    console.log('Integration:');
    const { checklistId, hiredUserId } = await checkExplicitTemplate({ actor, department, template });
    await checkDepartmentTemplateFallback({ actor, department });
    await checkRollbackNonBlocking({ actor, department });
    await checkTaskCompletionRollup({ checklistId, hiredUserId });
    await checkCompletionStats({ hiredUserId });
    console.log('');
    console.log('✅ All HRM-2.2 onboarding tests passed.');
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
  console.error('❌ Onboarding tests failed:', e);
  process.exit(1);
});
