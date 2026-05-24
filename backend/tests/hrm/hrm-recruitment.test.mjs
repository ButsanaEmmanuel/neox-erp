// HRM-2.1 — Integration tests for the Recruitment pipeline.
//
// Run with: node backend/tests/hrm/hrm-recruitment.test.mjs
// (Also exposed as `npm run test:hrm-recruitment`.)
//
// Hits the dev DB. Each scenario tags its data with a unique prefix
// so the teardown can purge them, even if the run aborts midway.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  createCandidate,
  updateCandidateStage,
  rejectCandidate,
  hireCandidate,
  getCandidate,
} from '../../services/hrm/recruitment.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_recruitment_test_${RUN}__`;
const TEST_EMAIL_DOMAIN = `${RUN}.recruitment-test.invalid`;

const TRACKED = {
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

  // Ensure the CONTRIBUTOR role exists (required by
  // transitionCandidateToOnboarding when hiring).
  const role = await prisma.role.findFirst({
    where: { code: { in: ['CONTRIBUTOR', 'employee_self_service'] }, isDeleted: false, isActive: true },
  });
  if (!role) {
    // Create a temporary contributor role just for this test.
    await prisma.role.create({
      data: {
        code: 'CONTRIBUTOR',
        name: 'CONTRIBUTOR',
        label: 'Contributor (test bootstrap)',
        isSystem: false,
        isActive: true,
      },
    });
  }

  return { actor, department };
}

async function teardown() {
  for (const userId of TRACKED.hiredUserIds) {
    await prisma.auditLog.deleteMany({ where: { entityId: userId } });
    await prisma.domainEvent.deleteMany({
      where: { payloadJson: { path: ['username'], string_contains: TEST_EMAIL_DOMAIN } },
    }).catch(() => {});
    await prisma.accessProvisioning.deleteMany({ where: { userId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.hrmEmploymentProfile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  for (const candidateId of TRACKED.candidateIds) {
    await prisma.auditLog.deleteMany({ where: { entityId: candidateId } });
    await prisma.accessProvisioning.deleteMany({ where: { candidateId } });
    await prisma.recruitmentCandidate.deleteMany({ where: { id: candidateId } });
  }
  for (const postingId of TRACKED.postingIds) {
    await prisma.jobPosting.deleteMany({ where: { id: postingId } });
  }
}

async function checkPipelineTransitions({ actor, department }) {
  const posting = await createJobPosting(
    prisma,
    {
      title: `${PREFIX} Pipeline test`,
      departmentId: department.id,
      description: 'Test posting for stage transitions',
      statusCode: 'open',
    },
    { actorUserId: actor.id },
  );
  TRACKED.postingIds.add(posting.id);

  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} Cand Pipeline`,
    personalEmail: `pipeline-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'Engineer',
    recruitmentDepartmentId: department.id,
    jobPostingId: posting.id,
  });
  TRACKED.candidateIds.add(candidate.id);
  assert.equal(candidate.statusCode, 'sourced');

  let updated = await updateCandidateStage(prisma, candidate.id, { statusCode: 'screening' });
  assert.equal(updated.statusCode, 'screening');

  updated = await updateCandidateStage(prisma, candidate.id, { statusCode: 'interview' });
  assert.equal(updated.statusCode, 'interview');
  assert.ok(updated.interviewDate, 'interviewDate auto-stamped on first transition');

  updated = await updateCandidateStage(prisma, candidate.id, {
    statusCode: 'offer',
    offerAmount: 90000,
    offerCurrency: 'usd',
  });
  assert.equal(updated.statusCode, 'offer');
  assert.ok(updated.offerDate, 'offerDate auto-stamped on first transition');
  assert.equal(Number(updated.offerAmount), 90000);
  assert.equal(updated.offerCurrency, 'USD', 'currency upper-cased');

  // Refuse direct transition to hired via /stage.
  await assert.rejects(
    () => updateCandidateStage(prisma, candidate.id, { statusCode: 'hired' }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'CONFLICT');
      return true;
    },
  );

  // Refuse direct transition to rejected via /stage.
  await assert.rejects(
    () => updateCandidateStage(prisma, candidate.id, { statusCode: 'rejected' }),
    (err) => err.statusCode === 409 && err.code === 'CONFLICT',
  );

  console.log('  ✓ pipeline transitions sourced→screening→interview→offer with auto-stamped dates');
  console.log('  ✓ stage endpoint refuses hired/rejected (409, redirected to /hire and /reject)');

  return { posting, candidate };
}

async function checkHireFlow({ actor, department, posting }) {
  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} Cand Hire`,
    personalEmail: `hire-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'Senior',
    recruitmentDepartmentId: department.id,
    jobPostingId: posting.id,
  });
  TRACKED.candidateIds.add(candidate.id);

  await updateCandidateStage(prisma, candidate.id, { statusCode: 'screening' });
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'offer' });

  const professionalEmail = `hired-${RUN}@${TEST_EMAIL_DOMAIN}`;
  const result = await hireCandidate(
    prisma,
    candidate.id,
    { professionalEmail },
    { actorUserId: actor.id },
  );
  assert.equal(result.candidate.statusCode, 'onboarding');
  assert.ok(result.provisioning.userId, 'hire returns a provisioned userId');
  TRACKED.hiredUserIds.add(result.provisioning.userId);

  // Verify the User + HrmEmploymentProfile + UserRole + AccessProvisioning all landed.
  const newUser = await prisma.user.findUnique({ where: { id: result.provisioning.userId } });
  assert.ok(newUser, 'User row materialized');
  assert.equal(newUser.email, professionalEmail);

  const profile = await prisma.hrmEmploymentProfile.findUnique({ where: { userId: newUser.id } });
  assert.ok(profile, 'HrmEmploymentProfile materialized');
  assert.equal(profile.employmentType, 'employee');

  const userRoles = await prisma.userRole.findMany({ where: { userId: newUser.id, validTo: null } });
  assert.ok(userRoles.length >= 1, 'at least one active UserRole assigned');

  const provisionings = await prisma.accessProvisioning.findMany({
    where: { candidateId: candidate.id, userId: newUser.id },
  });
  assert.equal(provisionings.length, 1, 'AccessProvisioning row created');

  console.log('  ✓ hire flow materialises User + HrmEmploymentProfile + UserRole + AccessProvisioning');

  // Idempotency: hire again -> 409 with hiredUserId.
  await assert.rejects(
    () => hireCandidate(prisma, candidate.id, { professionalEmail }, { actorUserId: actor.id }),
    (err) => {
      assert.equal(err.statusCode, 409, 'second hire = 409');
      assert.equal(err.code, 'CONFLICT');
      assert.equal(err.hiredUserId, newUser.id, 'conflict surfaces existing hiredUserId');
      return true;
    },
  );
  console.log('  ✓ second hire on the same candidate -> 409 CONFLICT + hiredUserId');

  return { hiredCandidate: candidate, hiredUserId: newUser.id, professionalEmail };
}

async function checkHireRollback({ actor, department, professionalEmailTaken }) {
  // New candidate, taken to offer; then try to hire with a
  // professionalEmail that already exists on a User (the one created
  // by the previous test). user.create throws P2002 -> transaction
  // rolls back. The candidate should still be at 'offer' afterwards
  // and no extra HrmEmploymentProfile/UserRole/AccessProvisioning
  // should exist for this candidate.
  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} Cand Rollback`,
    personalEmail: `rollback-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'Junior',
    recruitmentDepartmentId: department.id,
  });
  TRACKED.candidateIds.add(candidate.id);
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'screening' });
  await updateCandidateStage(prisma, candidate.id, { statusCode: 'offer' });

  const provisioningsBefore = await prisma.accessProvisioning.count({ where: { candidateId: candidate.id } });

  await assert.rejects(
    () => hireCandidate(
      prisma,
      candidate.id,
      { professionalEmail: professionalEmailTaken },
      { actorUserId: actor.id },
    ),
    (err) => Boolean(err),  // any throw is fine — we test the side-effects, not the error shape
  );

  const after = await getCandidate(prisma, candidate.id);
  assert.equal(after.statusCode, 'offer', 'candidate stays at offer after rollback');
  assert.equal(after.hiredUserId, null, 'hiredUserId still null after rollback');

  const provisioningsAfter = await prisma.accessProvisioning.count({ where: { candidateId: candidate.id } });
  assert.equal(provisioningsAfter, provisioningsBefore, 'no AccessProvisioning leaked through');

  // No HrmEmploymentProfile created for any new user under this candidate.
  // (the candidate has no linked user; checking by absence of provisionings
  //  for the rollback userId is the strongest signal we can get since we
  //  cannot predict the cuid that would have been generated.)
  console.log('  ✓ rollback: failed hire leaves candidate at offer + no AccessProvisioning leaked');
}

async function checkReject({ department }) {
  const candidate = await createCandidate(prisma, {
    fullName: `${PREFIX} Cand Reject`,
    personalEmail: `reject-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'Designer',
    recruitmentDepartmentId: department.id,
  });
  TRACKED.candidateIds.add(candidate.id);

  const rejected = await rejectCandidate(prisma, candidate.id, { reason: 'Not a fit' });
  assert.equal(rejected.statusCode, 'rejected');
  assert.equal(rejected.rejectionReason, 'Not a fit');
  console.log('  ✓ reject sets statusCode=rejected with rejectionReason');
}

async function checkPostingLifecycle({ actor, department }) {
  // Empty posting: delete is allowed.
  const p1 = await createJobPosting(prisma, {
    title: `${PREFIX} Empty Posting`,
    departmentId: department.id,
    description: 'no candidates',
    statusCode: 'open',
  }, { actorUserId: actor.id });
  TRACKED.postingIds.add(p1.id);
  const deleted = await deleteJobPosting(prisma, p1.id);
  assert.equal(deleted.deleted, true);

  // Posting with active candidate: delete refused.
  const p2 = await createJobPosting(prisma, {
    title: `${PREFIX} Active Posting`,
    departmentId: department.id,
    description: 'has candidates',
    statusCode: 'open',
  }, { actorUserId: actor.id });
  TRACKED.postingIds.add(p2.id);
  const c = await createCandidate(prisma, {
    fullName: `${PREFIX} Linked Cand`,
    personalEmail: `linked-${RUN}@${TEST_EMAIL_DOMAIN}`,
    position: 'X',
    recruitmentDepartmentId: department.id,
    jobPostingId: p2.id,
  });
  TRACKED.candidateIds.add(c.id);
  await assert.rejects(
    () => deleteJobPosting(prisma, p2.id),
    (err) => err.statusCode === 409 && err.code === 'CONFLICT',
  );

  // Update title + status to 'closed' is allowed.
  const updated = await updateJobPosting(prisma, p2.id, { title: `${PREFIX} Active Posting (renamed)`, statusCode: 'closed' });
  assert.equal(updated.title, `${PREFIX} Active Posting (renamed)`);
  assert.equal(updated.statusCode, 'closed');

  console.log('  ✓ posting CRUD + delete refused while active candidates remain');
}

async function main() {
  console.log('🧪 HRM-2.1 — Recruitment service integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const { actor, department } = await setup();
    console.log(`  ✓ actor = ${actor.email ?? actor.id}, department = ${department.name}`);
    console.log('');
    console.log('Integration:');
    const { posting } = await checkPipelineTransitions({ actor, department });
    const { professionalEmail } = await checkHireFlow({ actor, department, posting });
    await checkHireRollback({ actor, department, professionalEmailTaken: professionalEmail });
    await checkReject({ department });
    await checkPostingLifecycle({ actor, department });
    console.log('');
    console.log('✅ All HRM-2.1 recruitment tests passed.');
  } finally {
    console.log('');
    console.log('Teardown:');
    try {
      await teardown();
      console.log('  ✓ test postings + candidates + hired users removed');
    } catch (e) {
      console.error('  ✗ teardown failed:', e?.message ?? e);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Recruitment tests failed:', e);
  process.exit(1);
});
