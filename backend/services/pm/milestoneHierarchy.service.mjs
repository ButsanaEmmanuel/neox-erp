// DH12 — Milestone parent/child hierarchy.
// Mounted by backend/routes/pm/projects.routes.mjs.
//
// Calqué sur backend/services/pm/workItemHierarchy.service.mjs avec
// deux écarts assumés :
//   1. Pas de ProjectItemActivity pour Milestone (table inexistante).
//   2. La whitelist Milestone.status est {planned, in_progress, done, blocked}
//      — rollupStatus n'écrit jamais en dehors.
//
// API surface :
//   createSubMilestone(prisma, parentId, data)             → Milestone
//   listSubMilestones (prisma, milestoneId)                → Milestone[] (enfants + petits-enfants)
//   moveSubMilestone  (prisma, milestoneId, { parentId })  → Milestone
//   rollupStatus      (tx, milestoneId)                    → void (récursif, in-tx)
//
// Depth contract : root = niveau 1, max = niveau 3.
// Statut mapping (rollup) — utilise UNIQUEMENT les 4 valeurs whitelistées :
//   tous "done"        → 'done'
//   ≥1 "blocked"       → 'blocked'
//   ≥1 "in_progress"   → 'in_progress'
//   sinon              → 'planned'

const MAX_DEPTH = 3;

// Whitelist Milestone.status — doit rester aligné avec milestones.service.mjs.
const MILESTONE_STATUSES = new Set(['planned', 'in_progress', 'done', 'blocked']);

function classify(status) {
  if (status === 'blocked') return 'blocked';
  if (status === 'done') return 'done';
  if (status === 'in_progress') return 'in_progress';
  return 'planned';
}

// --- errors -----------------------------------------------------------

function err(statusCode, code, message, extra = {}) {
  const e = new Error(message);
  e.statusCode = statusCode;
  e.code = code;
  Object.assign(e, extra);
  return e;
}

const badRequest = (code, msg, extra) => err(400, code, msg, extra);
const notFound = (msg) => err(404, 'NOT_FOUND', msg);

// --- depth + cycle helpers -------------------------------------------

async function ancestorChain(prisma, startId) {
  const chain = [];
  let cursor = startId;
  for (let i = 0; i < MAX_DEPTH + 2 && cursor; i += 1) {
    const row = await prisma.milestone.findFirst({
      where: { id: cursor, isDeleted: false },
      select: { id: true, parentId: true, projectId: true },
    });
    if (!row) break;
    chain.push(row);
    cursor = row.parentId;
  }
  return chain;
}

async function depthOf(prisma, milestoneId) {
  const chain = await ancestorChain(prisma, milestoneId);
  return chain.length;
}

async function maxSubtreeDepth(prisma, milestoneId) {
  const stack = [{ id: milestoneId, depth: 1 }];
  let max = 1;
  while (stack.length) {
    const { id, depth } = stack.pop();
    if (depth > max) max = depth;
    const children = await prisma.milestone.findMany({
      where: { parentId: id, isDeleted: false },
      select: { id: true },
    });
    for (const c of children) stack.push({ id: c.id, depth: depth + 1 });
  }
  return max;
}

// --- public API -------------------------------------------------------

export async function createSubMilestone(prisma, parentId, data) {
  const title = String(data?.title || '').trim();
  if (!title) throw badRequest('TITLE_REQUIRED', "Field 'title' is required.", { field: 'title' });

  if (data?.dueDate === undefined || data?.dueDate === null) {
    throw badRequest('DUE_DATE_REQUIRED', "Field 'dueDate' is required.", { field: 'dueDate' });
  }
  if (typeof data.dueDate !== 'string' || Number.isNaN(Date.parse(data.dueDate))) {
    throw badRequest('INVALID_DUE_DATE', "Field 'dueDate' must be a valid ISO 8601 date string.", { field: 'dueDate' });
  }

  if (data?.status !== undefined && !MILESTONE_STATUSES.has(data.status)) {
    throw badRequest(
      'INVALID_STATUS',
      `Invalid status. Allowed: ${[...MILESTONE_STATUSES].join(', ')}`,
      { field: 'status' },
    );
  }

  if (data?.completionPct !== undefined) {
    const n = data.completionPct;
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw badRequest('INVALID_COMPLETION_PCT', "Field 'completionPct' must be an integer between 0 and 100.", { field: 'completionPct' });
    }
  }

  return prisma.$transaction(async (tx) => {
    const parent = await tx.milestone.findFirst({
      where: { id: parentId, isDeleted: false },
      select: { id: true, projectId: true, parentId: true },
    });
    if (!parent) throw notFound(`Parent milestone '${parentId}' not found.`);

    const parentDepth = await depthOf(tx, parentId);
    if (parentDepth >= MAX_DEPTH) {
      throw badRequest(
        'MAX_DEPTH_EXCEEDED',
        `Cannot create sub-milestone: max depth ${MAX_DEPTH} would be exceeded.`,
        { field: 'parentId', maxDepth: MAX_DEPTH },
      );
    }

    const child = await tx.milestone.create({
      data: {
        title,
        projectId: parent.projectId,
        parentId,
        dueDate: new Date(data.dueDate),
        description: typeof data?.description === 'string' ? data.description : null,
        status: typeof data?.status === 'string' ? data.status : 'planned',
        completionPct: Number.isInteger(data?.completionPct) ? data.completionPct : 0,
        ownerId: typeof data?.ownerId === 'string' && data.ownerId ? data.ownerId : null,
      },
    });

    // Parent rollup après l'arrivée du nouvel enfant.
    await rollupStatus(tx, parentId);

    return child;
  });
}

// Liste enfants directs + petits-enfants (2 niveaux sous milestoneId).
// Soft-deleted exclus à chaque niveau.
export async function listSubMilestones(prisma, milestoneId) {
  const parent = await prisma.milestone.findFirst({
    where: { id: milestoneId, isDeleted: false },
    select: { id: true },
  });
  if (!parent) throw notFound(`Milestone '${milestoneId}' not found.`);
  return prisma.milestone.findMany({
    where: { parentId: milestoneId, isDeleted: false },
    orderBy: { dueDate: 'asc' },
    include: {
      children: {
        where: { isDeleted: false },
        orderBy: { dueDate: 'asc' },
      },
    },
  });
}

// Re-parent un milestone. Garde-fous : profondeur, anti-cycle, anti-cross-project.
// newParentId === null/undefined => détache (devient racine).
export async function moveSubMilestone(prisma, milestoneId, { parentId: newParentId }) {
  return prisma.$transaction(async (tx) => {
    const self = await tx.milestone.findFirst({
      where: { id: milestoneId, isDeleted: false },
      select: { id: true, parentId: true, projectId: true },
    });
    if (!self) throw notFound(`Milestone '${milestoneId}' not found.`);
    const previousParentId = self.parentId;

    if (!newParentId) {
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: { parentId: null },
      });
      if (previousParentId) await rollupStatus(tx, previousParentId);
      return updated;
    }

    if (newParentId === milestoneId) {
      throw badRequest('CYCLE_DETECTED', 'A milestone cannot be its own parent.', { field: 'parentId' });
    }

    const newParent = await tx.milestone.findFirst({
      where: { id: newParentId, isDeleted: false },
      select: { id: true, projectId: true },
    });
    if (!newParent) throw notFound(`Target parent '${newParentId}' not found.`);

    if (newParent.projectId !== self.projectId) {
      throw badRequest('CROSS_PROJECT_MOVE', 'Cannot move a milestone between projects.', { field: 'parentId' });
    }

    // Cycle guard — remonter depuis newParent ; la chaîne NE DOIT PAS contenir self.
    const chain = await ancestorChain(tx, newParentId);
    if (chain.some((node) => node.id === milestoneId)) {
      throw badRequest('CYCLE_DETECTED', 'Move would create a cycle.', { field: 'parentId' });
    }

    // Depth guard — newParentDepth + maxSubtreeDepth(self) ≤ MAX_DEPTH.
    const newParentDepth = chain.length;
    const subtreeDepth = await maxSubtreeDepth(tx, milestoneId);
    if (newParentDepth + subtreeDepth > MAX_DEPTH) {
      throw badRequest(
        'MAX_DEPTH_EXCEEDED',
        `Move would exceed max depth ${MAX_DEPTH}.`,
        { field: 'parentId', maxDepth: MAX_DEPTH },
      );
    }

    const updated = await tx.milestone.update({
      where: { id: milestoneId },
      data: { parentId: newParentId },
    });

    if (previousParentId && previousParentId !== newParentId) {
      await rollupStatus(tx, previousParentId);
    }
    await rollupStatus(tx, newParentId);

    return updated;
  });
}

// Rollup récursif de status, du milestoneId vers la racine.
// Règle (whitelist {planned, in_progress, done, blocked}) :
//   tous "done"        → 'done'
//   ≥1 "blocked"       → 'blocked'
//   ≥1 "in_progress"   → 'in_progress'
//   sinon              → 'planned'
// À exécuter dans une tx pour garantir l'atomicité de la chaîne.
export async function rollupStatus(tx, milestoneId) {
  let cursor = milestoneId;
  for (let i = 0; cursor && i <= MAX_DEPTH + 1; i += 1) {
    const node = await tx.milestone.findFirst({
      where: { id: cursor, isDeleted: false },
      select: { id: true, parentId: true, status: true },
    });
    if (!node) return;
    const children = await tx.milestone.findMany({
      where: { parentId: cursor, isDeleted: false },
      select: { status: true },
    });
    if (children.length === 0) {
      // Feuille — rien à roll-up depuis ici, on continue vers le parent.
      cursor = node.parentId;
      continue;
    }
    const tally = { done: 0, blocked: 0, in_progress: 0, planned: 0 };
    for (const c of children) tally[classify(c.status)] += 1;

    let nextStatus;
    if (tally.done === children.length) nextStatus = 'done';
    else if (tally.blocked > 0) nextStatus = 'blocked';
    else if (tally.in_progress > 0) nextStatus = 'in_progress';
    else nextStatus = 'planned';

    if (nextStatus !== node.status) {
      await tx.milestone.update({
        where: { id: node.id },
        data: { status: nextStatus },
      });
    }
    cursor = node.parentId;
  }
}
