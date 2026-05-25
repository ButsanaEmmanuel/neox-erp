// DH3 — Payroll workflow integration tests.
// Run via: node backend/tests/finance/finance-payroll-workflow.test.mjs
// or       npm run test:finance-payroll-workflow
//
// Isolation pattern: throwaway schedule + user + salary profile + timesheets,
// wiped in finally. Same shape as pm-milestones-hierarchy.test.mjs.
//
// 7 assertions (Sprint Finance-2 F2.7) :
//   1. executePayrollRun → run + employees + batch + disbursement lines
//   2. adjustPayrollRunEmployee → adjustment + recalc + propagate Payable + FinanceEntry
//   3. postPayrollRun → run.postingStatus = posted + batch.status = approved + log écrit
//   4. disbursePayrollLine → PaymentDisbursement + line.status = paid
//   5. reconcilePayrollBatch → batch.status = reconciled
//   6. runDuePayrollSchedules → due triggered, non-due ignored
//   7. RBAC : 403 sans finance.payroll.execute sur POST /payroll-runs/:id/post
//      (note : la route utilise finance.payroll.execute, pas hrm.payroll.execute
//       — c'est la permission réelle gravée dans auth-server.mjs:1809)

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  executePayrollRun,
  postPayrollRun,
  adjustPayrollRunEmployee,
  runDuePayrollSchedules,
  upsertPayrollSchedule,
  upsertEmployeeSalaryProfile,
  getPayrollRunDetail,
} from '../../services/hrm/payrollEngine.service.mjs';
import {
  disbursePayrollLine,
  reconcilePayrollBatch,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__dh3_test_${RUN}__`;

const TRACKED = {
  scheduleIds: new Set(),
  salaryProfileIds: new Set(),
  timesheetIds: new Set(),
  userIds: new Set(),
  runIds: new Set(),
  batchIds: new Set(),
  periodIds: new Set(),
};

const mockRes = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(payload) { this.body = payload; },
});

// ── Setup ─────────────────────────────────────────────────────────────

async function setup() {
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new Error('Admin ebutsana@neox.io must exist — seed DB first');

  const department = await prisma.department.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!department) throw new Error('No active department — seed DB first');

  // Test user — gets a salary profile + approved timesheets so the engine
  // includes them in the run. createdAt is backdated to last month: the
  // engine restricts timesheet matching to workDate >= user.createdAt
  // (payrollEngine.service.mjs:475), so a freshly-created user would have
  // all timesheets filtered out.
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const testUser = await prisma.user.create({
    data: {
      id: `usr_${PREFIX}_emp`,
      name: `${PREFIX} employee`,
      email: `emp-${RUN}@dh3-test.invalid`,
      passwordHash: 'x',
      isActive: true,
      hasSystemAccess: true,
      departmentId: department.id,
      createdAt: lastMonth,
    },
  });
  TRACKED.userIds.add(testUser.id);

  const profile = await upsertEmployeeSalaryProfile(
    prisma,
    { userId: testUser.id, monthlyBaseSalary: 2200, overtimeMultiplier: 1.5, currencyCode: 'USD', effectiveFrom: new Date().toISOString() },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );
  TRACKED.salaryProfileIds.add(profile.id);

  // Seed 5 approved timesheets in the current month (engine's default period).
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 0; i < 5; i += 1) {
    const workDate = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 5 + i));
    const ts = await prisma.timesheetEntry.create({
      data: {
        userId: testUser.id,
        departmentId: department.id,
        workDate,
        hours: 8,
        statusCode: 'approved',
        approvedAt: new Date(),
        approvedByUserId: admin.id,
      },
    });
    TRACKED.timesheetIds.add(ts.id);
  }

  // Active schedule (default review-before-posting so the run waits for Post).
  const schedule = await upsertPayrollSchedule(
    prisma,
    {
      code: `${PREFIX}_sched_main`,
      name: `${PREFIX} main schedule`,
      executionRule: 'day_of_month',
      dayOfMonth: 25,
      validationMode: 'review_before_posting',
      isActive: true,
    },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );
  TRACKED.scheduleIds.add(schedule.id);

  return { admin, department, testUser, schedule };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  // FK-dependent rows first. Wrap each in catch so a failed earlier step
  // doesn't abort the rest of the cleanup.
  const swallow = (p) => p.catch(() => {});

  // 1. Finance entries created by post → disburse → reconcile chain.
  for (const rid of TRACKED.runIds) {
    const run = await prisma.payrollRun.findUnique({ where: { id: rid }, select: { payrollBatchId: true } }).catch(() => null);
    if (run?.payrollBatchId) TRACKED.batchIds.add(run.payrollBatchId);
  }
  for (const bid of TRACKED.batchIds) {
    const lines = await prisma.payrollDisbursementLine.findMany({ where: { payrollBatchId: bid }, select: { payableId: true } }).catch(() => []);
    for (const l of lines) {
      if (!l.payableId) continue;
      const pay = await prisma.payable.findUnique({ where: { id: l.payableId }, select: { financeEntryId: true } }).catch(() => null);
      if (pay?.financeEntryId) {
        await swallow(prisma.paymentDisbursement.deleteMany({ where: { payableId: l.payableId } }));
        await swallow(prisma.financeActivity.deleteMany({ where: { financeEntryId: pay.financeEntryId } }));
        await swallow(prisma.financeApproval.deleteMany({ where: { financeEntryId: pay.financeEntryId } }));
        await swallow(prisma.financeEvidenceDocument.deleteMany({ where: { financeEntryId: pay.financeEntryId } }));
        await swallow(prisma.financeEntrySourceLink.deleteMany({ where: { financeEntryId: pay.financeEntryId } }));
        await swallow(prisma.payable.deleteMany({ where: { id: l.payableId } }));
        await swallow(prisma.financeEntry.deleteMany({ where: { id: pay.financeEntryId } }));
      }
    }
    await swallow(prisma.payrollDisbursementLine.deleteMany({ where: { payrollBatchId: bid } }));
    await swallow(prisma.payrollBatch.deleteMany({ where: { id: bid } }));
  }

  // 2. PayrollRun deps.
  for (const rid of TRACKED.runIds) {
    await swallow(prisma.payrollRunLog.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollNotification.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollAdjustment.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollCalculationDetail.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollRunTimesheetLink.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollRunEmployee.deleteMany({ where: { payrollRunId: rid } }));
    await swallow(prisma.payrollRun.deleteMany({ where: { id: rid } }));
  }

  // 3. Audit logs scoped to our entities (best-effort).
  for (const uid of TRACKED.userIds) {
    await swallow(prisma.auditLog.deleteMany({ where: { entityId: uid } }));
  }

  // 4. Timesheets + salary profiles + schedules + users.
  await swallow(prisma.timesheetEntry.deleteMany({ where: { id: { in: [...TRACKED.timesheetIds] } } }));
  await swallow(prisma.employeeSalaryProfile.deleteMany({ where: { id: { in: [...TRACKED.salaryProfileIds] } } }));
  for (const sid of TRACKED.scheduleIds) {
    await swallow(prisma.payrollScheduleHistory.deleteMany({ where: { payrollScheduleId: sid } }));
    await swallow(prisma.payrollSchedule.deleteMany({ where: { id: sid } }));
  }
  await swallow(prisma.user.deleteMany({ where: { id: { in: [...TRACKED.userIds] } } }));
}

// ── Tests ─────────────────────────────────────────────────────────────

async function test1_executeRun({ admin, schedule, testUser }) {
  const run = await executePayrollRun(
    prisma,
    { scheduleId: schedule.id, validationMode: 'review_before_posting', triggerType: 'manual' },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );
  TRACKED.runIds.add(run.id);
  if (run.payrollBatchId) TRACKED.batchIds.add(run.payrollBatchId);
  if (run.payrollPeriodId) TRACKED.periodIds.add(run.payrollPeriodId);

  assert.ok(run.id, 'run created');
  assert.ok(run.payrollBatchId, 'payrollBatch generated for included employees');
  const myEmp = run.employees?.find((e) => e.userId === testUser.id);
  assert.ok(myEmp, 'test user appears in PayrollRunEmployee');
  assert.equal(myEmp.inclusionStatus, 'included', 'test user is included (has salary profile + timesheets)');
  assert.ok(Number(myEmp.grossPay) > 0, `test user grossPay > 0 (got ${myEmp.grossPay})`);
  assert.ok((run.payrollBatch?.lines || []).length >= 1, 'batch has at least 1 disbursement line');
  console.log('  ✓ 1. executePayrollRun → run + employees + batch + disbursement lines');
  return { runId: run.id, batchId: run.payrollBatchId, payrollRunEmployeeId: myEmp.id };
}

async function test2_adjust({ admin, payrollRunEmployeeId, runId }) {
  const before = await prisma.payrollRunEmployee.findUnique({ where: { id: payrollRunEmployeeId } });
  const beforeRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
  const beforeGross = Number(beforeRun.totalGrossPay);
  const newAmount = Number(before.grossPay) + 150;

  await adjustPayrollRunEmployee(
    prisma,
    payrollRunEmployeeId,
    { adjustedAmount: newAmount, reason: 'Bonus exceptionnel test' },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );

  const after = await prisma.payrollRunEmployee.findUnique({ where: { id: payrollRunEmployeeId } });
  assert.equal(Number(after.adjustedGrossPay), newAmount, 'adjustedGrossPay updated');

  const adjustment = await prisma.payrollAdjustment.findFirst({
    where: { payrollRunEmployeeId },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(adjustment, 'PayrollAdjustment row created');
  assert.equal(Number(adjustment.adjustedAmount), newAmount, 'adjustment.adjustedAmount matches');

  const afterRun = await prisma.payrollRun.findUnique({ where: { id: runId } });
  assert.notEqual(Number(afterRun.totalGrossPay), beforeGross, `run.totalGrossPay recalculated (before=${beforeGross}, after=${afterRun.totalGrossPay})`);

  // Propagation to Payable + FinanceEntry (engine updates them when payrollLineId exists).
  if (after.payableId) {
    const payable = await prisma.payable.findUnique({ where: { id: after.payableId } });
    assert.equal(Number(payable.totalAmount), newAmount, 'Payable.totalAmount propagated');
    const entry = await prisma.financeEntry.findUnique({ where: { id: payable.financeEntryId } });
    assert.equal(Number(entry.amount), newAmount, 'FinanceEntry.amount propagated');
  }
  console.log('  ✓ 2. adjustPayrollRunEmployee → adjustment + recalc + propagation Payable + FinanceEntry');
}

async function test3_post({ admin, runId, batchId }) {
  await postPayrollRun(prisma, runId, { registerProofReference: `REG-${RUN}` }, { actorUserId: admin.id, actorDisplayName: admin.name });

  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  assert.equal(run.postingStatus, 'posted', `run.postingStatus = posted (got ${run.postingStatus})`);

  const batch = await prisma.payrollBatch.findUnique({ where: { id: batchId } });
  assert.equal(batch.approvalStatus, 'approved', `batch.approvalStatus = approved (got ${batch.approvalStatus})`);

  const log = await prisma.payrollRunLog.findFirst({ where: { payrollRunId: runId, actionType: 'run_posted' } });
  assert.ok(log, 'PayrollRunLog "run_posted" written');
  console.log('  ✓ 3. postPayrollRun → posted + batch approved + log écrit');
}

async function test4_disburse({ admin, batchId }) {
  const detail = await prisma.payrollBatch.findUnique({ where: { id: batchId }, include: { lines: true } });
  const line = detail.lines.find((l) => l.status !== 'paid' && l.status !== 'reconciled');
  assert.ok(line, 'a pending line exists for disbursement');

  await disbursePayrollLine(prisma, line.id, {
    proofReference: `BANK-${RUN}-${line.id.slice(-6)}`,
    paymentDate: new Date().toISOString(),
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });

  const afterLine = await prisma.payrollDisbursementLine.findUnique({ where: { id: line.id } });
  assert.equal(afterLine.status, 'paid', `line.status = paid (got ${afterLine.status})`);

  if (afterLine.payableId) {
    const payments = await prisma.paymentDisbursement.findMany({ where: { payableId: afterLine.payableId } });
    assert.ok(payments.length >= 1, `PaymentDisbursement created (count=${payments.length})`);
  }
  console.log('  ✓ 4. disbursePayrollLine → PaymentDisbursement créé + line.status = paid');
}

async function test5_reconcile({ admin, batchId }) {
  // Pay any remaining pending lines first so the batch can reconcile cleanly.
  const detail = await prisma.payrollBatch.findUnique({ where: { id: batchId }, include: { lines: true } });
  for (const l of detail.lines) {
    if (l.status === 'paid' || l.status === 'reconciled') continue;
    await disbursePayrollLine(prisma, l.id, {
      proofReference: `BANK-${RUN}-${l.id.slice(-6)}`,
      paymentDate: new Date().toISOString(),
      actorUserId: admin.id,
      actorDisplayName: admin.name,
    });
  }
  await reconcilePayrollBatch(prisma, batchId, { notes: 'DH3 test reconciliation', actorUserId: admin.id, actorDisplayName: admin.name });
  const after = await prisma.payrollBatch.findUnique({ where: { id: batchId } });
  assert.equal(after.status, 'reconciled', `batch.status = reconciled (got ${after.status})`);
  console.log('  ✓ 5. reconcilePayrollBatch → batch.status = reconciled');
}

async function test6_runDue({ admin }) {
  // Create one due + one not-due schedule, both isolated to this test.
  const scheduleDue = await upsertPayrollSchedule(
    prisma,
    {
      code: `${PREFIX}_sched_due`,
      name: `${PREFIX} due schedule`,
      executionRule: 'day_of_month',
      dayOfMonth: 25,
      validationMode: 'review_before_posting',
      isActive: true,
    },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );
  TRACKED.scheduleIds.add(scheduleDue.id);

  const scheduleNotDue = await upsertPayrollSchedule(
    prisma,
    {
      code: `${PREFIX}_sched_notdue`,
      name: `${PREFIX} not-due schedule`,
      executionRule: 'day_of_month',
      dayOfMonth: 25,
      validationMode: 'review_before_posting',
      isActive: true,
    },
    { actorUserId: admin.id, actorDisplayName: admin.name },
  );
  TRACKED.scheduleIds.add(scheduleNotDue.id);

  // Force nextRunAt: due = 1 day ago, not-due = 30 days from now.
  await prisma.payrollSchedule.update({
    where: { id: scheduleDue.id },
    data: { nextRunAt: new Date(Date.now() - 24 * 3600 * 1000) },
  });
  await prisma.payrollSchedule.update({
    where: { id: scheduleNotDue.id },
    data: { nextRunAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  });

  const triggered = await runDuePayrollSchedules(prisma, { actorUserId: admin.id, actorDisplayName: admin.name });
  for (const r of triggered) {
    TRACKED.runIds.add(r.id);
    if (r.payrollBatchId) TRACKED.batchIds.add(r.payrollBatchId);
  }
  const dueTriggered = triggered.find((r) => r.payrollScheduleId === scheduleDue.id);
  const notDueTriggered = triggered.find((r) => r.payrollScheduleId === scheduleNotDue.id);
  assert.ok(dueTriggered, 'due schedule was triggered');
  assert.equal(notDueTriggered, undefined, 'not-due schedule was NOT triggered');
  console.log(`  ✓ 6. runDuePayrollSchedules → due déclenché, non-due ignoré (total triggered: ${triggered.length})`);
}

async function test7_rbacDeny() {
  // Synthetic user with no roles → no finance.payroll.execute.
  const orphan = await prisma.user.create({
    data: {
      id: `usr_${PREFIX}_orphan`,
      name: `${PREFIX} orphan`,
      email: `orphan-${RUN}@dh3-test.invalid`,
      passwordHash: 'x',
      isActive: true,
      hasSystemAccess: true,
    },
  });
  TRACKED.userIds.add(orphan.id);
  const res = mockRes();
  const allowed = await assertPermission({ userId: orphan.id, res }, 'finance.payroll.execute');
  assert.equal(allowed, false, 'orphan must be denied');
  assert.equal(res.statusCode, 403, '403 emitted by assertPermission');
  console.log('  ✓ 7. RBAC : 403 sur POST /payroll-runs/:id/post sans finance.payroll.execute');
}

// ── Runner ────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 DH3 — Payroll workflow integration');
  console.log('');
  try {
    console.log('Setup:');
    const ctx = await setup();
    console.log(`  ✓ admin=${ctx.admin.email}, testUser=${ctx.testUser.id}, schedule=${ctx.schedule.id}`);
    console.log('');
    console.log('Integration (sequential — each test builds on prior state):');
    const r1 = await test1_executeRun(ctx);
    await test2_adjust({ ...ctx, ...r1 });
    await test3_post({ ...ctx, ...r1 });
    await test4_disburse({ ...ctx, ...r1 });
    await test5_reconcile({ ...ctx, ...r1 });
    await test6_runDue(ctx);
    await test7_rbacDeny();
    console.log('');
    console.log('✅ DH3 — 7/7 tests passed.');
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
  console.error('❌ DH3 tests failed:', e);
  process.exit(1);
});
