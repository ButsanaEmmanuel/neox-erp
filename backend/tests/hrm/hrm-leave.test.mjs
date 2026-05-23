// HRM-1.5 — Integration tests for the Leave management service.
//
// Run with: node backend/tests/hrm/hrm-leave.test.mjs
// (Also wired as `npm run test:hrm-leave`.)
//
// Hits the dev DB but stays isolated:
//   - test policies are created with a unique name prefix and torn
//     down in a finally block,
//   - LeaveBalance + LeaveRequest rows tied to the test policy are
//     deleted in the same teardown,
//   - the actor user is the first non-deleted User in the DB so we
//     don't depend on a specific seed identity.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  calculateLeaveDays,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  createPolicy,
} from '../../services/hrm/leave.service.mjs';

const prisma = new PrismaClient();
const TEST_PREFIX = `__hrm_leave_test_${Date.now()}__`;

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(typeof v === 'object' && typeof v.toString === 'function' ? v.toString() : v);
  return Number.isFinite(n) ? n : 0;
}

async function loadBalance(userId, policyId, year) {
  return prisma.leaveBalance.findUnique({
    where: { userId_policyId_year: { userId, policyId, year } },
  });
}

async function setup() {
  const user = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error('No active user available — seed the DB first');

  const policy = await createPolicy(prisma, {
    name: `${TEST_PREFIX} annual`,
    leaveType: 'annual',
    daysPerYear: 5,             // small budget to exercise insufficient-balance
    requiresApproval: true,
    noticeDays: 0,
  });

  return { user, policy };
}

async function teardown(policyId, userId) {
  if (!policyId) return;
  await prisma.leaveRequest.deleteMany({ where: { policyId } });
  await prisma.leaveBalance.deleteMany({ where: { policyId } });
  if (userId) {
    await prisma.leaveBalance.deleteMany({ where: { policyId, userId } });
  }
  await prisma.leavePolicy.deleteMany({ where: { id: policyId } });
}

// Pure unit checks first — fast feedback even if the DB is offline.
function checkCalculator() {
  // 2030-06-03 = Monday, 2030-06-05 = Wednesday  -> 3 weekdays
  assert.equal(calculateLeaveDays('2030-06-03', '2030-06-05'), 3, 'Mon..Wed = 3 working days');
  // 2030-06-08 = Saturday, 2030-06-09 = Sunday  -> 0 weekdays
  assert.equal(calculateLeaveDays('2030-06-08', '2030-06-09'), 0, 'Sat..Sun excluded');
  // 2030-06-07 = Friday, 2030-06-10 = Monday  -> 2 weekdays (Fri + Mon)
  assert.equal(calculateLeaveDays('2030-06-07', '2030-06-10'), 2, 'weekend spanning range skips Sat+Sun');
  // 2030-06-03 = Monday alone -> 1
  assert.equal(calculateLeaveDays('2030-06-03', '2030-06-03'), 1, 'single weekday inclusive');
  console.log('  ✓ calculateLeaveDays handles weekends and single-day ranges');
}

async function checkInsufficientBalance({ user, policy }) {
  // Allocated 5 — request 6 working days (Mon..Mon).
  await assert.rejects(
    () => createRequest(prisma, {
      userId: user.id,
      policyId: policy.id,
      startDate: '2030-09-02', // Monday
      endDate: '2030-09-09',   // next Monday (6 working days)
    }, { actorUserId: user.id }),
    (err) => {
      assert.equal(err.statusCode, 422, 'should be 422');
      assert.equal(err.code, 'INSUFFICIENT_BALANCE', 'should be INSUFFICIENT_BALANCE');
      assert.equal(err.requested, 6, 'requested 6');
      assert.equal(err.available, 5, 'available 5');
      return true;
    },
  );
  console.log('  ✓ insufficient balance -> 422 INSUFFICIENT_BALANCE with requested/available payload');
}

async function checkApprovePendingToUsed({ user, policy }) {
  const created = await createRequest(prisma, {
    userId: user.id,
    policyId: policy.id,
    startDate: '2030-09-16', // Monday
    endDate: '2030-09-17',   // Tuesday  -> 2 days
  }, { actorUserId: user.id });
  assert.equal(created.days, 2, 'request days = 2');
  assert.equal(created.statusCode, 'pending');

  let balance = await loadBalance(user.id, policy.id, 2030);
  assert.equal(toNumber(balance.pending), 2, 'pending = 2 after submit');
  assert.equal(toNumber(balance.used), 0, 'used = 0 after submit');

  await approveRequest(prisma, created.id, { reviewerUserId: user.id });

  balance = await loadBalance(user.id, policy.id, 2030);
  assert.equal(toNumber(balance.pending), 0, 'pending = 0 after approve');
  assert.equal(toNumber(balance.used), 2, 'used = 2 after approve');
  console.log('  ✓ approve moves balance.pending -> balance.used in one transaction');

  // Teardown for the next test: cancel to restore the balance.
  await cancelRequest(prisma, created.id, { actorUserId: user.id, hasExecutePermission: true });
}

async function checkCancelRestoresBalance({ user, policy }) {
  const created = await createRequest(prisma, {
    userId: user.id,
    policyId: policy.id,
    startDate: '2030-09-23', // Monday
    endDate: '2030-09-24',   // Tuesday  -> 2 days
  }, { actorUserId: user.id });

  await approveRequest(prisma, created.id, { reviewerUserId: user.id });

  let balance = await loadBalance(user.id, policy.id, 2030);
  assert.equal(toNumber(balance.used), 2, 'used = 2 after approve');

  // Cancel before startDate (2030 is future). hasExecutePermission flag
  // mirrors what the route layer passes when the actor has hrm.leave.execute.
  await cancelRequest(prisma, created.id, { actorUserId: user.id });

  balance = await loadBalance(user.id, policy.id, 2030);
  assert.equal(toNumber(balance.used), 0, 'used = 0 after cancel');
  assert.equal(toNumber(balance.pending), 0, 'pending stays 0 after cancel of approved');
  console.log('  ✓ cancel before startDate restores balance.used to 0');
}

async function checkOverlappingRequest({ user, policy }) {
  const first = await createRequest(prisma, {
    userId: user.id,
    policyId: policy.id,
    startDate: '2030-10-07', // Monday
    endDate: '2030-10-08',   // Tuesday
  }, { actorUserId: user.id });

  await assert.rejects(
    () => createRequest(prisma, {
      userId: user.id,
      policyId: policy.id,
      startDate: '2030-10-08', // overlap on Tuesday
      endDate: '2030-10-09',
    }, { actorUserId: user.id }),
    (err) => {
      assert.equal(err.statusCode, 409, 'overlap should be 409');
      assert.equal(err.code, 'CONFLICT', 'overlap should be CONFLICT');
      assert.equal(err.conflicting?.id, first.id, 'conflicting should reference the first request');
      return true;
    },
  );
  console.log('  ✓ overlapping pending/approved request -> 409 CONFLICT with conflicting{id,...}');

  // Bonus: also confirm a rejected request does NOT block a new submission
  // on the same dates (only pending|approved should conflict).
  await rejectRequest(prisma, first.id, { reviewerUserId: user.id });
  const reused = await createRequest(prisma, {
    userId: user.id,
    policyId: policy.id,
    startDate: '2030-10-07',
    endDate: '2030-10-08',
  }, { actorUserId: user.id });
  assert.equal(reused.days, 2, 'reused date range after rejection');
  console.log('  ✓ rejected requests do not block re-submission on the same period');
}

async function main() {
  console.log('🧪 HRM-1.5 — Leave service integration tests');
  console.log('');
  console.log('Unit:');
  checkCalculator();
  console.log('');

  let policyId = null;
  let userId = null;
  try {
    console.log('Setup:');
    const { user, policy } = await setup();
    policyId = policy.id;
    userId = user.id;
    console.log(`  ✓ test policy "${policy.name}" created (id=${policy.id})`);
    console.log(`  ✓ actor user = ${user.email ?? user.id}`);
    console.log('');

    console.log('Integration:');
    await checkInsufficientBalance({ user, policy });
    await checkApprovePendingToUsed({ user, policy });
    await checkCancelRestoresBalance({ user, policy });
    await checkOverlappingRequest({ user, policy });
    console.log('');
    console.log('✅ All HRM-1.5 leave tests passed.');
  } finally {
    console.log('');
    console.log('Teardown:');
    try {
      await teardown(policyId, userId);
      console.log('  ✓ test policy + balances + requests removed');
    } catch (e) {
      console.error('  ✗ teardown failed:', e?.message ?? e);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Leave tests failed:', e);
  process.exit(1);
});
