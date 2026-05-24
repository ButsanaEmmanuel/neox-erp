// HRM-2.3 — Integration tests for the Training + Certifications service.
//
// Run with: node backend/tests/hrm/hrm-training.test.mjs
// or         npm run test:hrm-training
//
// Coverage matches the HRM-2.3 exit criteria:
//   1. enroll → statusCode = "enrolled"
//   2. enroll twice on the same course → 409 ALREADY_ENROLLED with current status
//   3. cancel then re-enroll → row revived back to "enrolled" (no duplicate,
//      thanks to @@unique([userId, courseId]))
//   4. complete with a score → statusCode "completed", certificate stored,
//      getUserCertifications surfaces it (powers the profile badge)
//   5. assertPermission denies a user that lacks hrm.training.execute
//      → returns false, response body is { code: 'PERMISSION_DENIED',
//        required: 'hrm.training.execute' }

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createCourse,
  enrollUser,
  completeEnrollment,
  cancelEnrollment,
  getUserCertifications,
} from '../../services/hrm/training.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_training_test_${RUN}__`;
const TEST_EMAIL_DOMAIN = `${RUN}.training-test.invalid`;

const TRACKED = {
  courseIds: new Set(),
  userIds: new Set(),
};

async function setup() {
  // We need two users: one with execute permissions (irrelevant for the
  // service-level tests — used as the enrolled employee) and one
  // without ANY hrm.training permissions for the 403 test.
  const learner = await prisma.user.create({
    data: {
      email: `learner-${RUN}@${TEST_EMAIL_DOMAIN}`,
      name:  `${PREFIX} learner`,
      isActive: true,
      hasSystemAccess: true,
    },
  });
  TRACKED.userIds.add(learner.id);

  const noPermsUser = await prisma.user.create({
    data: {
      email: `noperm-${RUN}@${TEST_EMAIL_DOMAIN}`,
      name:  `${PREFIX} no-perms`,
      isActive: true,
      hasSystemAccess: true,
    },
  });
  TRACKED.userIds.add(noPermsUser.id);
  // Explicitly DO NOT assign any role/permissions — they start with
  // an empty effective set, which is exactly what we need for the
  // assertPermission deny path.

  const course = await createCourse(prisma, {
    title: `${PREFIX} Workplace Safety 101`,
    category: 'Compliance',
    durationHours: 4,
    isMandatory: true,
    isInternal: true,
  });
  TRACKED.courseIds.add(course.id);

  return { learner, noPermsUser, course };
}

async function teardown() {
  for (const cid of TRACKED.courseIds) {
    await prisma.trainingEnrollment.deleteMany({ where: { courseId: cid } });
    await prisma.trainingCourse.deleteMany({ where: { id: cid } });
  }
  for (const uid of TRACKED.userIds) {
    await prisma.trainingEnrollment.deleteMany({ where: { userId: uid } });
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

async function checkEnroll({ learner, course }) {
  const enr = await enrollUser(prisma, { userId: learner.id, courseId: course.id });
  assert.equal(enr.userId, learner.id);
  assert.equal(enr.courseId, course.id);
  assert.equal(enr.statusCode, 'enrolled');
  assert.ok(enr.enrolledAt instanceof Date);
  console.log('  ✓ enrollUser creates a row with statusCode = enrolled');
  return enr;
}

async function checkDoubleEnroll({ learner, course }) {
  let err;
  try {
    await enrollUser(prisma, { userId: learner.id, courseId: course.id });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'second enroll should throw');
  assert.equal(err.statusCode, 409);
  // ALREADY_ENROLLED is the specific code (extra-code wins over the
  // generic CONFLICT default). The structured payload carries the
  // existing status so the UI can surface "Already enrolled
  // (status: enrolled)" instead of a generic 409.
  assert.equal(err.code, 'ALREADY_ENROLLED');
  assert.equal(err.currentStatus, 'enrolled');
  assert.ok(err.enrollmentId, 'payload exposes the enrollmentId of the conflicting row');
  console.log('  ✓ double-enroll throws 409 ALREADY_ENROLLED with currentStatus');
}

async function checkCancelThenReenroll({ learner, course, enrollmentId }) {
  await cancelEnrollment(prisma, enrollmentId);
  const cancelled = await prisma.trainingEnrollment.findUnique({ where: { id: enrollmentId } });
  assert.equal(cancelled.statusCode, 'cancelled');
  assert.ok(cancelled.cancelledAt, 'cancelledAt stamped');

  const revived = await enrollUser(prisma, { userId: learner.id, courseId: course.id });
  // Same DB row (we revive in place — the @@unique([userId, courseId])
  // forbids creating a sibling).
  assert.equal(revived.id, enrollmentId);
  assert.equal(revived.statusCode, 'enrolled');
  assert.equal(revived.cancelledAt, null);

  const rowCount = await prisma.trainingEnrollment.count({
    where: { userId: learner.id, courseId: course.id },
  });
  assert.equal(rowCount, 1, 'still exactly one row for (userId, courseId)');
  console.log('  ✓ cancel then re-enroll revives the same row (no duplicate)');
  return revived;
}

async function checkCompleteStoresCertificate({ learner, enrollmentId }) {
  const certHandle = `https://lms.example.com/cert/${RUN}`;
  const completed = await completeEnrollment(prisma, enrollmentId, {
    score: 92,
    certificate: certHandle,
    notes: 'Passed in one sitting',
  });
  assert.equal(completed.statusCode, 'completed');
  assert.ok(completed.completedAt, 'completedAt stamped');
  assert.equal(Number(completed.score), 92);
  assert.equal(completed.certificate, certHandle);

  const certifications = await getUserCertifications(prisma, learner.id);
  assert.ok(certifications.length >= 1, 'getUserCertifications surfaces the completed enrollment');
  const found = certifications.find((c) => c.id === enrollmentId);
  assert.ok(found, 'completed enrollment is in the certifications list');
  assert.equal(found.certificate, certHandle);
  console.log('  ✓ completion stores certificate + getUserCertifications powers the profile badge');
}

async function checkAssertPermissionDeniesWithoutExecute({ noPermsUser }) {
  // Fake the http.ServerResponse just enough for assertPermission to
  // capture its writes — we don't want to spin up a real server.
  let writtenStatus = null;
  let writtenBody = null;
  const fakeRes = {
    headersSent: false,
    writeHead(status) { writtenStatus = status; this.headersSent = true; },
    end(body) { writtenBody = body; },
  };
  const allowed = await assertPermission(
    { userId: noPermsUser.id, res: fakeRes },
    'hrm.training.execute',
  );
  assert.equal(allowed, false, 'assertPermission returns false for a user without execute');
  assert.equal(writtenStatus, 403);
  assert.ok(writtenBody, '403 body written');
  const payload = JSON.parse(writtenBody);
  assert.equal(payload.code, 'PERMISSION_DENIED');
  assert.equal(payload.required, 'hrm.training.execute');
  console.log('  ✓ assertPermission denies a user lacking hrm.training.execute with structured 403');
}

async function main() {
  console.log('🧪 HRM-2.3 — Training + Certifications integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const { learner, noPermsUser, course } = await setup();
    console.log(`  ✓ learner = ${learner.email}, course = ${course.id}`);
    console.log('');
    console.log('Integration:');
    const enr = await checkEnroll({ learner, course });
    await checkDoubleEnroll({ learner, course });
    const revived = await checkCancelThenReenroll({ learner, course, enrollmentId: enr.id });
    await checkCompleteStoresCertificate({ learner, enrollmentId: revived.id });
    await checkAssertPermissionDeniesWithoutExecute({ noPermsUser });
    console.log('');
    console.log('✅ All HRM-2.3 training tests passed.');
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
  console.error('❌ Training tests failed:', e);
  process.exit(1);
});
