// D13 — WorkItem sub-task hierarchy.
// Mounted by backend/routes/pm/projects.routes.mjs.
//
// API surface:
//   createSubTask(prisma, parentId, data, actor) → WorkItem
//   listSubTasks(prisma, workItemId)             → WorkItem[] (direct + grandchildren)
//   moveSubTask(prisma, workItemId, { parentId }) → WorkItem (with cycle guard)
//   rollupStatus(tx, workItemId)                 → void (recursive, in-tx)
//
// Status mapping (decision actée DH13) — the rollup operates on the
// existing WorkItemStatus union, not a parallel enum:
//   COMPLETED  : 'complete' | 'done' | 'finance_synced'
//   BLOCKED    : 'validation_error' | 'finance_sync_error'
//   IN_PROGRESS: 'in-progress'
//   PENDING    : anything else (default)
//   AT_RISK    : new value, written on parent when any child is BLOCKED.
//
// Depth contract: root = level 1, max 3 → great-grand-children forbidden.
// MAX_DEPTH_EXCEEDED returned on creation/move that would push past 3.

const MAX_DEPTH = 3;

// --- status sets ------------------------------------------------------

const COMPLETED_STATUSES = new Set(['complete', 'done', 'finance_synced']);
// `at_risk` is the rollup output — when a parent is at_risk, treat it as
// blocked for upward propagation so the signal reaches the root.
const BLOCKED_STATUSES = new Set(['validation_error', 'finance_sync_error', 'at_risk']);
const IN_PROGRESS_STATUSES = new Set(['in-progress']);

function classify(status) {
  if (BLOCKED_STATUSES.has(status)) return 'blocked';
  if (COMPLETED_STATUSES.has(status)) return 'completed';
  if (IN_PROGRESS_STATUSES.has(status)) return 'in_progress';
  return 'pending';
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

// Returns the chain [grandparent, parent, ..., self] up to MAX_DEPTH + 2
// (enough to detect over-depth without unbounded walks). Stops at root or
// at MAX_DEPTH + 2 iterations as a safety net.
async function ancestorChain(prisma, startId) {
  const chain = [];
  let cursor = startId;
  for (let i = 0; i < MAX_DEPTH + 2 && cursor; i += 1) {
    const row = await prisma.workItem.findFirst({
      where: { id: cursor, isDeleted: false },
      select: { id: true, parentId: true, projectId: true },
    });
    if (!row) break;
    chain.push(row);
    cursor = row.parentId;
  }
  return chain;
}

async function depthOf(prisma, workItemId) {
  // root has depth 1; each parentId step adds 1.
  const chain = await ancestorChain(prisma, workItemId);
  return chain.length;
}

// --- public API -------------------------------------------------------

export async function createSubTask(prisma, parentId, data, actor) {
  const title = String(data?.title || '').trim();
  if (!title) throw badRequest('TITLE_REQUIRED', "Field 'title' is required.", { field: 'title' });

  return prisma.$transaction(async (tx) => {
    const parent = await tx.workItem.findFirst({
      where: { id: parentId, isDeleted: false },
      select: { id: true, projectId: true, parentId: true },
    });
    if (!parent) throw notFound(`Parent work item '${parentId}' not found.`);

    // Depth of the *new* child = parent depth + 1. Reject if > MAX_DEPTH.
    const parentDepth = await depthOf(tx, parentId);
    if (parentDepth >= MAX_DEPTH) {
      throw badRequest(
        'MAX_DEPTH_EXCEEDED',
        `Cannot create sub-task: max depth ${MAX_DEPTH} would be exceeded.`,
        { field: 'parentId', maxDepth: MAX_DEPTH },
      );
    }

    const child = await tx.workItem.create({
      data: {
        title,
        projectId: parent.projectId,
        parentId,
        status: typeof data?.status === 'string' ? data.status : 'pending',
        type: typeof data?.type === 'string' ? data.type : 'task',
        priority: typeof data?.priority === 'string' ? data.priority : 'medium',
        description: typeof data?.description === 'string' ? data.description : null,
        assignee: typeof data?.assignee === 'string' ? data.assignee : null,
        plannedDate: data?.plannedDate ? new Date(data.plannedDate) : null,
      },
    });

    await tx.projectItemActivity.create({
      data: {
        entityType: 'project_item',
        entityId: child.id,
        projectId: parent.projectId,
        workItemId: child.id,
        actorUserId: actor?.actorUserId || null,
        actorDisplayName: actor?.actorDisplayName || 'User',
        actionType: 'work_item_created',
        message: `${actor?.actorDisplayName || 'User'} created sub-task: ${title}`,
        eventSource: 'user',
      },
    });

    // Parent rollup after a new child arrives.
    await rollupStatus(tx, parentId);

    return child;
  });
}

// Lists direct children + their direct children (2 levels deep — enough
// for the drawer's "sub-tasks" panel). Soft-deleted rows excluded.
export async function listSubTasks(prisma, workItemId) {
  const parent = await prisma.workItem.findFirst({
    where: { id: workItemId, isDeleted: false },
    select: { id: true },
  });
  if (!parent) throw notFound(`Work item '${workItemId}' not found.`);
  return prisma.workItem.findMany({
    where: { parentId: workItemId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    include: {
      children: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

// Re-parent a work item. Validates depth at the destination and the
// absence of a cycle (newParent must not be in self's descendant tree).
export async function moveSubTask(prisma, workItemId, { parentId: newParentId }) {
  return prisma.$transaction(async (tx) => {
    const self = await tx.workItem.findFirst({
      where: { id: workItemId, isDeleted: false },
      select: { id: true, parentId: true, projectId: true },
    });
    if (!self) throw notFound(`Work item '${workItemId}' not found.`);
    const previousParentId = self.parentId;

    // Detach mode (move to root).
    if (!newParentId) {
      const updated = await tx.workItem.update({
        where: { id: workItemId },
        data: { parentId: null },
      });
      if (previousParentId) await rollupStatus(tx, previousParentId);
      return updated;
    }

    if (newParentId === workItemId) {
      throw badRequest('CYCLE_DETECTED', 'A work item cannot be its own parent.', { field: 'parentId' });
    }

    const newParent = await tx.workItem.findFirst({
      where: { id: newParentId, isDeleted: false },
      select: { id: true, projectId: true },
    });
    if (!newParent) throw notFound(`Target parent '${newParentId}' not found.`);

    if (newParent.projectId !== self.projectId) {
      throw badRequest('CROSS_PROJECT_MOVE', 'Cannot move a work item between projects.', { field: 'parentId' });
    }

    // Cycle guard — walk up from newParent; the chain must NOT contain self.
    const chain = await ancestorChain(tx, newParentId);
    if (chain.some((node) => node.id === workItemId)) {
      throw badRequest('CYCLE_DETECTED', 'Move would create a cycle.', { field: 'parentId' });
    }

    // Depth guard — newParentDepth + 1 (self) + maxSubtreeDepth(self) - 1 ≤ MAX_DEPTH.
    const newParentDepth = chain.length;
    const subtreeDepth = await maxSubtreeDepth(tx, workItemId);
    if (newParentDepth + subtreeDepth > MAX_DEPTH) {
      throw badRequest(
        'MAX_DEPTH_EXCEEDED',
        `Move would exceed max depth ${MAX_DEPTH}.`,
        { field: 'parentId', maxDepth: MAX_DEPTH },
      );
    }

    const updated = await tx.workItem.update({
      where: { id: workItemId },
      data: { parentId: newParentId },
    });

    // Rollup on both old and new parents.
    if (previousParentId && previousParentId !== newParentId) {
      await rollupStatus(tx, previousParentId);
    }
    await rollupStatus(tx, newParentId);

    return updated;
  });
}

// Returns the max depth of the subtree rooted at workItemId.
// Self alone → 1. Self + child → 2. Self + grand-child → 3.
async function maxSubtreeDepth(prisma, workItemId) {
  const stack = [{ id: workItemId, depth: 1 }];
  let max = 1;
  while (stack.length) {
    const { id, depth } = stack.pop();
    if (depth > max) max = depth;
    const children = await prisma.workItem.findMany({
      where: { parentId: id, isDeleted: false },
      select: { id: true },
    });
    for (const c of children) stack.push({ id: c.id, depth: depth + 1 });
  }
  return max;
}

// Recursive parent-status rollup. Walks from `workItemId` upward to the
// root and updates each ancestor's status according to its children:
//   any child BLOCKED          → 'at_risk'
//   all children COMPLETED     → 'complete' (uses the existing canonical)
//   any child IN_PROGRESS      → 'in-progress'
//   else                       → unchanged (typically 'pending')
//
// Designed to run inside a tx so the chain is atomic.
export async function rollupStatus(tx, workItemId) {
  let cursor = workItemId;
  // Safety: cap to MAX_DEPTH + 1 hops.
  for (let i = 0; cursor && i <= MAX_DEPTH + 1; i += 1) {
    const node = await tx.workItem.findFirst({
      where: { id: cursor, isDeleted: false },
      select: { id: true, parentId: true, status: true },
    });
    if (!node) return;
    const children = await tx.workItem.findMany({
      where: { parentId: cursor, isDeleted: false },
      select: { status: true },
    });
    if (children.length === 0) {
      // leaf — nothing to roll up from
      cursor = node.parentId;
      continue;
    }
    const tally = { completed: 0, blocked: 0, in_progress: 0, pending: 0 };
    for (const c of children) tally[classify(c.status)] += 1;

    let nextStatus = node.status;
    if (tally.blocked > 0) nextStatus = 'at_risk';
    else if (tally.completed === children.length) nextStatus = 'complete';
    else if (tally.in_progress > 0) nextStatus = 'in-progress';
    else nextStatus = node.status; // all pending → leave as-is (per spec)

    if (nextStatus !== node.status) {
      await tx.workItem.update({
        where: { id: node.id },
        data: { status: nextStatus },
      });
    }
    cursor = node.parentId;
  }
}
