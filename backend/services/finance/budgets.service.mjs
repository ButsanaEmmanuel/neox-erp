// Sprint Finance-4 (F4.2) — Budgets service.
//
// Four design decisions actées (cf. NEOX_FINANCE_PLAN §7 + handoff 2026-05-25) :
// [1] No direct departmentId on FinanceEntry — dept scope resolved via Project.ownerDepartmentId
// [2] No FK between FinanceEntry.categoryCode and FinanceCategorySetting — logical join via code
// [3] Currency: entries filtered by budget.currencyCode — cross-currency aggregation deferred to DF6
// [4] Direction: inherited from FinanceCategorySetting.direction — entries filtered accordingly

function err(statusCode, code, message, extra = {}) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  Object.assign(e, extra);
  return e;
}
const notFound = (msg, extra) => err(404, 'NOT_FOUND', msg, extra);
const badRequest = (msg, extra) => err(400, 'BAD_REQUEST', msg, extra);
const conflict = (msg, extra) => err(409, 'CONFLICT', msg, extra);

const ALLOWED_STATUSES = new Set(['draft', 'active', 'closed']);

function decimalToNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const out = Number(raw);
  return Number.isFinite(out) ? out : 0;
}

function parseDate(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    throw badRequest(`${fieldName} is required.`);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`${fieldName} is not a valid date.`, { value });
  }
  return d;
}

function parsePlannedAmount(value) {
  if (value === null || value === undefined || value === '') {
    throw badRequest('plannedAmount is required.');
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest('plannedAmount must be numeric.', { value });
  if (n < 0) throw badRequest('plannedAmount must be ≥ 0.', { value });
  return n;
}

function assertScopeXor(departmentId, projectId) {
  const hasDept = !!(departmentId && String(departmentId).trim());
  const hasProj = !!(projectId && String(projectId).trim());
  if (!hasDept && !hasProj) {
    throw badRequest('Budget scope required: provide departmentId OR projectId.');
  }
  if (hasDept && hasProj) {
    throw badRequest('Budget scope conflict: provide departmentId OR projectId, not both.');
  }
}

// chargeCode generator — readable, sortable, unique. CC-D###### for department
// budgets, CC-P###### for project budgets. Mirrors nextDisplayCode (counter off
// the current max); the @unique index is the integrity backstop on collision.
async function nextChargeCode(prisma, scopeKind) {
  const prefix = scopeKind === 'project' ? 'CC-P' : 'CC-D';
  const last = await prisma.budget.findFirst({
    where: { chargeCode: { startsWith: prefix } },
    orderBy: { chargeCode: 'desc' },
    select: { chargeCode: true },
  });
  let next = 1;
  if (last?.chargeCode) {
    const parsed = Number(last.chargeCode.slice(prefix.length));
    if (Number.isFinite(parsed) && parsed >= 1) next = parsed + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

// Validates a project budget's parent: must be a non-deleted, non-closed
// DEPARTMENT budget in the same currency. Returns the lean parent or throws.
async function assertValidParentBudget(prisma, parentBudgetId, childCurrency) {
  const parent = await prisma.budget.findFirst({
    where: { id: String(parentBudgetId), isDeleted: false },
    select: { id: true, departmentId: true, projectId: true, status: true, currencyCode: true },
  });
  if (!parent) throw notFound(`Parent budget '${parentBudgetId}' not found.`, { id: parentBudgetId });
  if (!parent.departmentId || parent.projectId) {
    throw badRequest('parentBudgetId must reference a department budget.', { parentBudgetId });
  }
  if (parent.status === 'closed') {
    throw conflict('Parent department budget is closed.', { parentBudgetId });
  }
  if (childCurrency && parent.currencyCode !== childCurrency) {
    throw badRequest(
      `Parent budget currency (${parent.currencyCode}) must match the project budget currency (${childCurrency}).`,
      { parentBudgetId },
    );
  }
  return parent;
}

export async function listBudgets(prisma, filters = {}) {
  const where = { isDeleted: false };
  if (filters.status) where.status = String(filters.status);
  if (filters.departmentId) where.departmentId = String(filters.departmentId);
  if (filters.projectId) where.projectId = String(filters.projectId);
  if (filters.currencyCode) where.currencyCode = String(filters.currencyCode);
  if (filters.periodFrom || filters.periodTo) {
    where.AND = [];
    if (filters.periodFrom) where.AND.push({ periodEnd: { gte: new Date(filters.periodFrom) } });
    if (filters.periodTo) where.AND.push({ periodStart: { lte: new Date(filters.periodTo) } });
  }

  const rows = await prisma.budget.findMany({
    where,
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    include: {
      department: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, name: true } },
      lines: {
        include: { category: { select: { id: true, code: true, name: true, direction: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    take: filters.take ? Number(filters.take) : 200,
  });

  // Opt-in: attach actuals so the list view can show real spend / variance
  // without opening each budget. Reuses the already-loaded budget+lines
  // (opts.budget) to avoid a refetch per row.
  if (filters.withActuals) {
    return Promise.all(
      rows.map(async (b) => ({ ...b, actuals: await computeBudgetActuals(prisma, b.id, { budget: b }) })),
    );
  }
  return rows;
}

// Lightweight scope picker for the budget create/edit modal. Gated by
// finance.budgets.read so a finance user needs no cross-module HRM/PM
// permission. Projects carry ownerDepartmentId so the UI can suggest the
// parent department budget for the hierarchy (project budgets draw from it).
export async function listBudgetScopes(prisma) {
  const [departments, projects] = await Promise.all([
    prisma.department.findMany({
      where: { isDeleted: false },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, ownerDepartmentId: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { departments, projects };
}

// Active finance categories for the budget-line editor. Gated by
// finance.budgets.read (same as the rest of the budget UI) so adding a line
// doesn't require a separate finance.settings permission.
export async function listBudgetCategories(prisma) {
  return prisma.financeCategorySetting.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, direction: true, isActive: true },
    orderBy: [{ direction: 'asc' }, { name: 'asc' }],
  });
}

export async function getBudgetDetail(prisma, budgetId) {
  const id = String(budgetId || '').trim();
  if (!id) throw badRequest('budgetId is required.');

  const budget = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    include: {
      department: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, name: true, ownerDepartmentId: true } },
      lines: {
        include: { category: { select: { id: true, code: true, name: true, direction: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!budget) throw notFound(`Budget '${id}' not found.`, { id });

  const actuals = await computeBudgetActuals(prisma, id, { budget });
  return { ...budget, actuals };
}

// Department voted envelope vs. the project budgets drawn from it.
//   votedTotal = Σ department budget lines (the "voted" plan)
//   allocated  = Σ each child project budget's planned total
//   remaining  = votedTotal − allocated
// Soft control: over-allocation is flagged (overAllocated), not blocked —
// consistent with the expense overspend policy ("avertir et autoriser").
export async function getDepartmentEnvelope(prisma, deptBudgetId) {
  const id = String(deptBudgetId || '').trim();
  if (!id) throw badRequest('deptBudgetId is required.');

  const dept = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    include: { lines: { select: { plannedAmount: true } } },
  });
  if (!dept) throw notFound(`Budget '${id}' not found.`, { id });
  if (!dept.departmentId) throw badRequest('Envelope is only defined for department budgets.', { id });

  const votedTotal = (dept.lines || []).reduce((acc, l) => acc + decimalToNumber(l.plannedAmount), 0);

  const children = await prisma.budget.findMany({
    where: { parentBudgetId: id, isDeleted: false },
    include: {
      lines: { select: { plannedAmount: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const childRows = children.map((c) => ({
    id: c.id,
    name: c.name,
    projectId: c.projectId,
    projectName: c.project?.name || null,
    total: (c.lines || []).reduce((acc, l) => acc + decimalToNumber(l.plannedAmount), 0),
  }));
  const allocated = childRows.reduce((acc, c) => acc + c.total, 0);

  return {
    budgetId: id,
    currencyCode: dept.currencyCode,
    votedTotal,
    allocated,
    remaining: votedTotal - allocated,
    overAllocated: allocated > votedTotal,
    children: childRows,
  };
}

export async function createBudget(prisma, payload = {}, actor = {}) {
  const name = String(payload.name || '').trim();
  if (!name) throw badRequest('name is required.');

  const periodStart = parseDate(payload.periodStart, 'periodStart');
  const periodEnd = parseDate(payload.periodEnd, 'periodEnd');
  if (periodEnd <= periodStart) {
    throw badRequest('periodEnd must be after periodStart.', { periodStart, periodEnd });
  }

  assertScopeXor(payload.departmentId, payload.projectId);

  const currencyCode = String(payload.currencyCode || 'USD').trim().toUpperCase();
  const status = String(payload.status || 'draft');
  if (!ALLOWED_STATUSES.has(status)) {
    throw badRequest(`status must be one of ${[...ALLOWED_STATUSES].join(', ')}.`, { status });
  }

  const createdBy = String(actor.actorUserId || payload.createdBy || '').trim();
  if (!createdBy) throw badRequest('createdBy (actor.actorUserId) is required.');

  if (payload.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: String(payload.departmentId), isDeleted: false },
      select: { id: true },
    });
    if (!dept) throw notFound(`Department '${payload.departmentId}' not found.`, { id: payload.departmentId });
  }
  if (payload.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: String(payload.projectId), isDeleted: false },
      select: { id: true },
    });
    if (!proj) throw notFound(`Project '${payload.projectId}' not found.`, { id: payload.projectId });
  }

  let parentBudgetId = null;
  if (payload.parentBudgetId) {
    if (!payload.projectId) {
      throw badRequest('parentBudgetId is only valid for project budgets.', { parentBudgetId: payload.parentBudgetId });
    }
    await assertValidParentBudget(prisma, payload.parentBudgetId, currencyCode);
    parentBudgetId = String(payload.parentBudgetId);
  }

  const chargeCode = await nextChargeCode(prisma, payload.projectId ? 'project' : 'department');

  return prisma.budget.create({
    data: {
      name,
      periodStart,
      periodEnd,
      departmentId: payload.departmentId ? String(payload.departmentId) : null,
      projectId: payload.projectId ? String(payload.projectId) : null,
      parentBudgetId,
      chargeCode,
      currencyCode,
      status,
      createdBy,
    },
    include: {
      department: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, name: true } },
      lines: true,
    },
  });
}

export async function updateBudget(prisma, budgetId, payload = {}, actor = {}) {
  const id = String(budgetId || '').trim();
  if (!id) throw badRequest('budgetId is required.');

  const existing = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, status: true, departmentId: true, projectId: true, currencyCode: true },
  });
  if (!existing) throw notFound(`Budget '${id}' not found.`, { id });
  if (existing.status === 'closed') {
    throw conflict(`Budget '${id}' is closed and cannot be updated.`, { id });
  }

  const data = {};
  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) throw badRequest('name cannot be empty.');
    data.name = name;
  }
  if (payload.periodStart !== undefined) data.periodStart = parseDate(payload.periodStart, 'periodStart');
  if (payload.periodEnd !== undefined) data.periodEnd = parseDate(payload.periodEnd, 'periodEnd');

  const nextStart = data.periodStart ?? undefined;
  const nextEnd = data.periodEnd ?? undefined;
  if (nextStart && nextEnd && nextEnd <= nextStart) {
    throw badRequest('periodEnd must be after periodStart.', { periodStart: nextStart, periodEnd: nextEnd });
  }

  if (payload.currencyCode !== undefined) {
    data.currencyCode = String(payload.currencyCode).trim().toUpperCase();
  }
  if (payload.status !== undefined) {
    const status = String(payload.status);
    if (!ALLOWED_STATUSES.has(status)) {
      throw badRequest(`status must be one of ${[...ALLOWED_STATUSES].join(', ')}.`, { status });
    }
    data.status = status;
  }

  // Scope updates: allow swap dept↔project but enforce XOR.
  const wantsDeptUpdate = payload.departmentId !== undefined;
  const wantsProjUpdate = payload.projectId !== undefined;
  if (wantsDeptUpdate || wantsProjUpdate) {
    const nextDept = wantsDeptUpdate ? payload.departmentId : existing.departmentId;
    const nextProj = wantsProjUpdate ? payload.projectId : existing.projectId;
    assertScopeXor(nextDept, nextProj);
    if (wantsDeptUpdate) {
      data.departmentId = nextDept ? String(nextDept) : null;
      if (nextDept) {
        const dept = await prisma.department.findFirst({
          where: { id: String(nextDept), isDeleted: false },
          select: { id: true },
        });
        if (!dept) throw notFound(`Department '${nextDept}' not found.`, { id: nextDept });
      }
    }
    if (wantsProjUpdate) {
      data.projectId = nextProj ? String(nextProj) : null;
      if (nextProj) {
        const proj = await prisma.project.findFirst({
          where: { id: String(nextProj), isDeleted: false },
          select: { id: true },
        });
        if (!proj) throw notFound(`Project '${nextProj}' not found.`, { id: nextProj });
      }
    }
  }

  if (payload.parentBudgetId !== undefined) {
    if (payload.parentBudgetId) {
      const effectiveProjectId = wantsProjUpdate ? payload.projectId : existing.projectId;
      if (!effectiveProjectId) {
        throw badRequest('parentBudgetId is only valid for project budgets.', { parentBudgetId: payload.parentBudgetId });
      }
      const currency = data.currencyCode ?? existing.currencyCode;
      await assertValidParentBudget(prisma, payload.parentBudgetId, currency);
      data.parentBudgetId = String(payload.parentBudgetId);
    } else {
      data.parentBudgetId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return getBudgetDetail(prisma, id);
  }

  await prisma.budget.update({ where: { id }, data });
  return getBudgetDetail(prisma, id);
}

export async function deleteBudget(prisma, budgetId, actor = {}) {
  const id = String(budgetId || '').trim();
  if (!id) throw badRequest('budgetId is required.');

  const existing = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    select: { id: true },
  });
  if (!existing) throw notFound(`Budget '${id}' not found.`, { id });

  return prisma.budget.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
    select: { id: true, isDeleted: true, deletedAt: true },
  });
}

export async function upsertBudgetLine(prisma, budgetId, payload = {}, actor = {}) {
  const id = String(budgetId || '').trim();
  if (!id) throw badRequest('budgetId is required.');

  const budget = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, status: true },
  });
  if (!budget) throw notFound(`Budget '${id}' not found.`, { id });
  if (budget.status === 'closed') {
    throw conflict(`Budget '${id}' is closed and cannot accept line changes.`, { id });
  }

  const categoryId = String(payload.categoryId || '').trim();
  if (!categoryId) throw badRequest('categoryId is required.');

  const category = await prisma.financeCategorySetting.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });
  if (!category) throw notFound(`FinanceCategorySetting '${categoryId}' not found.`, { id: categoryId });
  if (!category.isActive) {
    throw badRequest(`FinanceCategorySetting '${categoryId}' is not active.`, { id: categoryId });
  }

  const plannedAmount = parsePlannedAmount(payload.plannedAmount);
  const notes = payload.notes === undefined || payload.notes === null ? null : String(payload.notes);

  return prisma.budgetLine.upsert({
    where: { budgetId_categoryId: { budgetId: id, categoryId } },
    update: { plannedAmount, notes },
    create: { budgetId: id, categoryId, plannedAmount, notes },
    include: { category: { select: { id: true, code: true, name: true, direction: true } } },
  });
}

export async function deleteBudgetLine(prisma, budgetId, lineId, actor = {}) {
  const id = String(budgetId || '').trim();
  const lid = String(lineId || '').trim();
  if (!id) throw badRequest('budgetId is required.');
  if (!lid) throw badRequest('lineId is required.');

  const budget = await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, status: true },
  });
  if (!budget) throw notFound(`Budget '${id}' not found.`, { id });
  if (budget.status === 'closed') {
    throw conflict(`Budget '${id}' is closed and cannot accept line changes.`, { id });
  }

  const line = await prisma.budgetLine.findFirst({
    where: { id: lid, budgetId: id },
    select: { id: true },
  });
  if (!line) throw notFound(`BudgetLine '${lid}' not found in budget '${id}'.`, { id: lid, budgetId: id });

  await prisma.budgetLine.delete({ where: { id: lid } });
  return { id: lid, deleted: true };
}

// Aggregates FinanceEntry rows mapped to each BudgetLine's category.
// Filters applied:
//   - categoryCode IN (lines.category.code)  ← [2] logical join, no FK
//   - currencyCode = budget.currencyCode     ← [3] cross-currency deferred
//   - direction = line.category.direction    ← [4] inherited from category
//   - sourceEventAt ∈ [periodStart, periodEnd]
//   - isDeleted = false
//   - if budget.projectId : projectId = budget.projectId
//   - else if budget.departmentId : projectId IN (Project where ownerDepartmentId = ...)  ← [1]
export async function computeBudgetActuals(prisma, budgetId, opts = {}) {
  const id = String(budgetId || '').trim();
  if (!id) throw badRequest('budgetId is required.');

  const budget = opts.budget || await prisma.budget.findFirst({
    where: { id, isDeleted: false },
    include: {
      lines: {
        include: { category: { select: { id: true, code: true, name: true, direction: true } } },
      },
    },
  });
  if (!budget) throw notFound(`Budget '${id}' not found.`, { id });

  const lines = budget.lines || [];
  if (lines.length === 0) {
    return { lines: [], totals: { planned: 0, actual: 0, variance: 0, variancePct: null, overBudget: false } };
  }

  // [1] Resolve dept scope → set of projectIds. Null = no scope filter on projectId.
  let scopedProjectIds = null;
  if (budget.projectId) {
    scopedProjectIds = [budget.projectId];
  } else if (budget.departmentId) {
    const projects = await prisma.project.findMany({
      where: { ownerDepartmentId: budget.departmentId, isDeleted: false },
      select: { id: true },
    });
    scopedProjectIds = projects.map((p) => p.id);
    // No projects AND no charge code → nothing can match; short-circuit to zero.
    // A charge-coded budget may still have directly-imputed entries, so let it through.
    if (scopedProjectIds.length === 0 && !budget.chargeCode) {
      return {
        lines: lines.map((line) => buildEmptyActual(line)),
        totals: aggregateTotals(lines.map((line) => buildEmptyActual(line))),
      };
    }
  }

  // [4] Group categories by direction so we can fan out one groupBy per direction bucket.
  const byDirection = new Map();
  for (const line of lines) {
    const dir = line.category?.direction;
    const code = line.category?.code;
    if (!dir || !code) continue;
    if (!byDirection.has(dir)) byDirection.set(dir, new Set());
    byDirection.get(dir).add(code);
  }

  const sumsByCode = new Map();
  const addSum = (code, amount) => sumsByCode.set(code, (sumsByCode.get(code) || 0) + amount);

  for (const [direction, codeSet] of byDirection.entries()) {
    const codes = [...codeSet];
    if (codes.length === 0) continue;

    const baseWhere = {
      isDeleted: false,
      categoryCode: { in: codes },        // [2] logical join via code
      direction,                          // [4] direction inherited from category
      currencyCode: budget.currencyCode,  // [3] same-currency only
      sourceEventAt: { gte: budget.periodStart, lte: budget.periodEnd },
    };

    // (a) Explicit charge-code imputation — authoritative. The charge code IS
    //     the scope, so no projectId filter applies here.
    if (budget.chargeCode) {
      const groupedCc = await prisma.financeEntry.groupBy({
        by: ['categoryCode'],
        where: { ...baseWhere, chargeCode: budget.chargeCode },
        _sum: { amount: true },
      });
      for (const row of groupedCc) addSum(row.categoryCode, decimalToNumber(row._sum?.amount));
    }

    // (b) Legacy inferred attribution — only entries NOT charge-coded, matched
    //     by dept/project scope. The chargeCode=null filter prevents
    //     double-counting rows already captured by path (a).
    const legacyWhere = { ...baseWhere, chargeCode: null };
    if (scopedProjectIds) legacyWhere.projectId = { in: scopedProjectIds };
    const groupedLegacy = await prisma.financeEntry.groupBy({
      by: ['categoryCode'],
      where: legacyWhere,
      _sum: { amount: true },
    });
    for (const row of groupedLegacy) addSum(row.categoryCode, decimalToNumber(row._sum?.amount));
  }

  const enriched = lines.map((line) => {
    const code = line.category?.code || null;
    const planned = decimalToNumber(line.plannedAmount);
    const actual = code && sumsByCode.has(code) ? sumsByCode.get(code) : 0;
    const variance = planned - actual;
    const variancePct = planned > 0 ? Number(((variance / planned) * 100).toFixed(2)) : null;
    return {
      lineId: line.id,
      categoryId: line.categoryId,
      categoryCode: code,
      categoryName: line.category?.name || null,
      direction: line.category?.direction || null,
      plannedAmount: planned,
      actualAmount: actual,
      variance,
      variancePct,
      overBudget: planned > 0 && actual > planned,
    };
  });

  return { lines: enriched, totals: aggregateTotals(enriched) };
}

function buildEmptyActual(line) {
  const planned = decimalToNumber(line.plannedAmount);
  return {
    lineId: line.id,
    categoryId: line.categoryId,
    categoryCode: line.category?.code || null,
    categoryName: line.category?.name || null,
    direction: line.category?.direction || null,
    plannedAmount: planned,
    actualAmount: 0,
    variance: planned,
    variancePct: planned > 0 ? 100 : null,
    overBudget: false,
  };
}

function aggregateTotals(lines) {
  const planned = lines.reduce((acc, l) => acc + (l.plannedAmount || 0), 0);
  const actual = lines.reduce((acc, l) => acc + (l.actualAmount || 0), 0);
  const variance = planned - actual;
  const variancePct = planned > 0 ? Number(((variance / planned) * 100).toFixed(2)) : null;
  return { planned, actual, variance, variancePct, overBudget: planned > 0 && actual > planned };
}
