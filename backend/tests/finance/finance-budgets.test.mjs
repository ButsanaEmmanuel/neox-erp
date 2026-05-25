// F4.5 — Integration tests for Budgets (Sprint Finance-4).
//
// Run with: node backend/tests/finance/finance-budgets.test.mjs
//
// Contract under test (7 assertions, plan §7 F4.5) :
//   1. createBudget → scope dept XOR projet validé (project-scoped budget OK)
//   2. createBudget with both departmentId + projectId → 400 BAD_REQUEST
//   3. upsertBudgetLine → ligne créée + plannedAmount correct
//   4. computeBudgetActuals → actuals agrégés depuis FinanceEntry réelle
//      (filters: categoryCode + direction + currencyCode + period + projectId)
//   5. updateBudget on closed budget → 409 CONFLICT
//   6. deleteBudget → soft delete (isDeleted=true, still in DB)
//   7. assertPermission(unknown user, 'finance.budgets.write') → 403
//
// Isolation pattern : throwaway Department + Project + FinanceCategorySetting
// + Budget + BudgetLine + FinanceEntry, wiped in finally in strict FK order.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  upsertBudgetLine,
  computeBudgetActuals,
} from '../../services/finance/budgets.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f45_test_${RUN}__`;

const TRACKED = {
  budgetIds: new Set(),
  budgetLineIds: new Set(),
  financeEntryIds: new Set(),
  projectIds: new Set(),
  departmentIds: new Set(),
  categoryIds: new Set(),
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
    select: { id: true, name: true },
  });
  if (!admin) throw new Error('Admin ebutsana@neox.io must exist — seed DB first');

  const department = await prisma.department.create({
    data: { code: `${PREFIX}DEPT`, name: `${PREFIX} Test Dept` },
  });
  TRACKED.departmentIds.add(department.id);

  const project = await prisma.project.create({
    data: {
      name: `${PREFIX} Test Project`,
      clientName: `${PREFIX} Client`,
      managerId: admin.id,
      ownerDepartmentId: department.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      currency: 'USD',
    },
  });
  TRACKED.projectIds.add(project.id);

  const category = await prisma.financeCategorySetting.create({
    data: {
      code: `${PREFIX}CAT`,
      name: `${PREFIX} Test Category`,
      direction: 'outflow',
      isActive: true,
    },
  });
  TRACKED.categoryIds.add(category.id);

  return { admin, department, project, category };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  if (TRACKED.budgetLineIds.size > 0) {
    await prisma.budgetLine.deleteMany({ where: { id: { in: Array.from(TRACKED.budgetLineIds) } } });
  }
  if (TRACKED.budgetIds.size > 0) {
    // Hard delete in teardown (Budget cascades to BudgetLine; isDeleted soft-delete
    // is only relevant in the service — tests must clean fully).
    await prisma.budget.deleteMany({ where: { id: { in: Array.from(TRACKED.budgetIds) } } });
  }
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
    await prisma.financeEntry.deleteMany({
      where: { id: { in: Array.from(TRACKED.financeEntryIds) } },
    });
  }
  if (TRACKED.categoryIds.size > 0) {
    await prisma.financeCategorySetting.deleteMany({ where: { id: { in: Array.from(TRACKED.categoryIds) } } });
  }
  if (TRACKED.projectIds.size > 0) {
    await prisma.project.deleteMany({ where: { id: { in: Array.from(TRACKED.projectIds) } } });
  }
  if (TRACKED.departmentIds.size > 0) {
    await prisma.department.deleteMany({ where: { id: { in: Array.from(TRACKED.departmentIds) } } });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

try {
  const { admin, department, project, category } = await setup();

  // --- Case 1 — createBudget with project scope succeeds ---
  const periodStart = new Date('2026-06-01');
  const periodEnd = new Date('2026-08-31');

  const budget = await createBudget(
    prisma,
    {
      name: `${PREFIX} Q3 Marketing`,
      periodStart,
      periodEnd,
      projectId: project.id,
      currencyCode: 'USD',
      status: 'active',
    },
    { actorUserId: admin.id },
  );
  TRACKED.budgetIds.add(budget.id);
  assert.equal(budget.projectId, project.id, 'budget.projectId set');
  assert.equal(budget.departmentId, null, 'budget.departmentId null when project scope chosen');
  assert.equal(budget.currencyCode, 'USD', 'currencyCode persisted');
  assert.equal(budget.status, 'active', 'status persisted');
  assert.equal(budget.createdBy, admin.id, 'createdBy = actor');

  // --- Case 2 — createBudget with both dept + project → 400 ---
  let scopeConflictErr = null;
  try {
    await createBudget(
      prisma,
      {
        name: `${PREFIX} Bad`,
        periodStart,
        periodEnd,
        departmentId: department.id,
        projectId: project.id,
        currencyCode: 'USD',
      },
      { actorUserId: admin.id },
    );
  } catch (err) {
    scopeConflictErr = err;
  }
  assert.ok(scopeConflictErr, 'createBudget with both scopes throws');
  assert.equal(scopeConflictErr.statusCode, 400, 'statusCode 400 on scope conflict');
  assert.equal(scopeConflictErr.code, 'BAD_REQUEST', 'error code BAD_REQUEST');

  // --- Case 3 — upsertBudgetLine creates a line with correct plannedAmount ---
  const PLANNED = 5000;
  const line = await upsertBudgetLine(
    prisma,
    budget.id,
    { categoryId: category.id, plannedAmount: PLANNED, notes: 'Q3 campaign budget' },
    { actorUserId: admin.id },
  );
  TRACKED.budgetLineIds.add(line.id);
  assert.equal(line.budgetId, budget.id, 'line.budgetId set');
  assert.equal(line.categoryId, category.id, 'line.categoryId set');
  assert.equal(Number(line.plannedAmount), PLANNED, 'plannedAmount stored exactly');
  assert.equal(line.notes, 'Q3 campaign budget', 'notes persisted');

  // --- Case 4 — computeBudgetActuals aggregates real FinanceEntry rows ---
  // Seed two matching entries inside the period + one mismatch (different currency)
  // to verify [3] currency filter.
  const matchA = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE_A`,
      entryType: 'expense',
      direction: 'outflow', // matches category.direction
      title: `${PREFIX} entry A`,
      currencyCode: 'USD', // matches budget.currencyCode
      amount: 1200,
      sourceModule: 'test',
      sourceEntity: 'budget_actuals_test',
      sourceEntityId: `${PREFIX}A`,
      sourceEvent: 'test_seed',
      sourceEventAt: new Date('2026-07-15'), // inside period
      projectId: project.id, // matches budget scope
      categoryCode: category.code, // matches via logical join [2]
      lifecycleStatus: 'approved',
      approvalStatus: 'approved',
      evidenceStatus: 'not_required',
      settlementStatus: 'settled',
    },
  });
  TRACKED.financeEntryIds.add(matchA.id);

  const matchB = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE_B`,
      entryType: 'expense',
      direction: 'outflow',
      title: `${PREFIX} entry B`,
      currencyCode: 'USD',
      amount: 800,
      sourceModule: 'test',
      sourceEntity: 'budget_actuals_test',
      sourceEntityId: `${PREFIX}B`,
      sourceEvent: 'test_seed',
      sourceEventAt: new Date('2026-08-10'),
      projectId: project.id,
      categoryCode: category.code,
      lifecycleStatus: 'approved',
      approvalStatus: 'approved',
      evidenceStatus: 'not_required',
      settlementStatus: 'settled',
    },
  });
  TRACKED.financeEntryIds.add(matchB.id);

  // Mismatch on currency — should be excluded by [3] same-currency filter.
  const skipCurrency = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE_EUR`,
      entryType: 'expense',
      direction: 'outflow',
      title: `${PREFIX} entry EUR`,
      currencyCode: 'EUR', // different currency
      amount: 9999,
      sourceModule: 'test',
      sourceEntity: 'budget_actuals_test',
      sourceEntityId: `${PREFIX}EUR`,
      sourceEvent: 'test_seed',
      sourceEventAt: new Date('2026-07-20'),
      projectId: project.id,
      categoryCode: category.code,
      lifecycleStatus: 'approved',
      approvalStatus: 'approved',
      evidenceStatus: 'not_required',
      settlementStatus: 'settled',
    },
  });
  TRACKED.financeEntryIds.add(skipCurrency.id);

  const actuals = await computeBudgetActuals(prisma, budget.id);
  assert.equal(actuals.lines.length, 1, 'actuals has exactly one line (matching the single BudgetLine)');
  const lineActual = actuals.lines[0];
  assert.equal(lineActual.lineId, line.id, 'actuals line maps to the BudgetLine');
  assert.equal(lineActual.plannedAmount, PLANNED, 'planned reflects BudgetLine.plannedAmount');
  assert.equal(lineActual.actualAmount, 2000, 'actual sums matching entries (1200 + 800 — EUR excluded)');
  assert.equal(lineActual.variance, PLANNED - 2000, 'variance = planned - actual');
  assert.equal(actuals.totals.actual, 2000, 'totals.actual aggregated');
  assert.equal(actuals.totals.planned, PLANNED, 'totals.planned aggregated');

  // --- Case 5 — updateBudget on closed budget → 409 ---
  // First close the budget (allowed transition from active).
  const closedBudget = await updateBudget(
    prisma,
    budget.id,
    { status: 'closed' },
    { actorUserId: admin.id },
  );
  assert.equal(closedBudget.status, 'closed', 'budget transitioned to closed');

  let closedErr = null;
  try {
    await updateBudget(prisma, budget.id, { name: `${PREFIX} retry` }, { actorUserId: admin.id });
  } catch (err) {
    closedErr = err;
  }
  assert.ok(closedErr, 'updateBudget on closed budget throws');
  assert.equal(closedErr.statusCode, 409, 'statusCode 409');
  assert.equal(closedErr.code, 'CONFLICT', 'error code CONFLICT');

  // --- Case 6 — deleteBudget soft-deletes (isDeleted=true, row still in DB) ---
  const deleted = await deleteBudget(prisma, budget.id, { actorUserId: admin.id });
  assert.equal(deleted.isDeleted, true, 'service returns isDeleted=true');
  assert.ok(deleted.deletedAt, 'deletedAt set');

  const raw = await prisma.budget.findUnique({ where: { id: budget.id } });
  assert.ok(raw, 'budget row still in DB after soft delete');
  assert.equal(raw.isDeleted, true, 'DB row isDeleted=true');

  // --- Case 7 — assertPermission(unknown user, 'finance.budgets.write') → 403 ---
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_budgets_test', res },
    'finance.budgets.write',
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.budgets.write');

  console.log('✓ F4.5 finance-budgets — 7/7 assertions OK (create + scope conflict + line + actuals + closed conflict + soft delete + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
