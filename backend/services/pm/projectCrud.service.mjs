// PM project CRUD — Phase 2 of Sprint 2 refactor.
// Mounted by backend/routes/pm/projects.routes.mjs.
//
// Conventions:
//   - All reads filter { isDeleted: false }.
//   - All deletes are soft: { isDeleted: true, deletedAt: new Date() }.
//   - Business errors throw `Error` with `err.statusCode` set (400/404/409).
//   - Activity logs go to ProjectItemActivity for work-item lifecycle events.

export { getProjectById } from '../projects/projectCollaboration.service.mjs';
import { rollupStatus } from './workItemHierarchy.service.mjs';

const ALLOWED_PROJECT_FIELDS = new Set([
  'name', 'clientName', 'clientAccountId', 'status', 'projectMode',
  'isTelecomProject', 'bulkImportRequired', 'purchaseOrder', 'projectCategory',
  'managerId', 'ownerDepartmentId', 'startDate', 'endDate', 'description',
]);

const ALLOWED_WORK_ITEM_FIELDS = new Set([
  'title', 'description', 'status', 'priority', 'assignee',
  'plannedDate', 'actualDate', 'type',
  // WBS scheduling fields editable from the drawer (no finance impact).
  'forecastDate', 'actualStartDate', 'weightPercent',
  // Delivery milestones — completed / accepted (existing) / signed.
  'completedDate', 'acceptanceDate', 'signedDate',
]);

const FINANCE_FIELDS_HINT_ROUTE =
  'PATCH /api/v1/pm/projects/:projectId/work-items/:itemId/details';

const WORK_ITEM_DATE_FIELDS = [
  'plannedDate', 'actualDate', 'forecastDate', 'actualStartDate',
  'completedDate', 'acceptanceDate', 'signedDate',
];

// Coerce yyyy-MM-dd / ISO / Date strings into Date instances in-place.
// Drops the field entirely if it can't be parsed (Prisma 500s on garbage).
function coerceWorkItemDateFields(allowed) {
  for (const f of WORK_ITEM_DATE_FIELDS) {
    if (allowed[f] === undefined) continue;
    if (allowed[f] === null || allowed[f] === '') {
      // Explicit clear: keep null so Prisma writes NULL on update.
      allowed[f] = null;
      continue;
    }
    const parsed = new Date(allowed[f]);
    if (Number.isNaN(parsed.getTime())) {
      delete allowed[f];
    } else {
      allowed[f] = parsed;
    }
  }
}

// Fields that can't be set to a future date — they represent events that
// have actually happened. plannedDate / forecastDate stay free since they
// are planning artefacts and can be in the future.
const NO_FUTURE_DATE_FIELDS = ['actualStartDate', 'actualDate', 'completedDate', 'acceptanceDate', 'signedDate'];

function assertNoFutureDates(patch) {
  const now = Date.now();
  // 23h59 tolerance so a same-day pick in any timezone passes.
  const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
  const cap = todayEnd.getTime();
  for (const f of NO_FUTURE_DATE_FIELDS) {
    if (!(patch[f] instanceof Date)) continue;
    if (patch[f].getTime() > cap) {
      throw badRequest(`Field '${f}' cannot be in the future (today is ${new Date(now).toISOString().slice(0, 10)}).`, { field: f });
    }
  }
}

function deriveStartSchedule(plannedDate, actualStartDate) {
  if (!plannedDate || !actualStartDate) return { scheduleStatus: null, startVarianceDays: null };
  const diff = Math.round((actualStartDate.getTime() - plannedDate.getTime()) / 86400000);
  if (!Number.isFinite(diff)) return { scheduleStatus: null, startVarianceDays: null };
  if (diff > 0) return { scheduleStatus: 'delayed', startVarianceDays: diff };
  if (diff < 0) return { scheduleStatus: 'early', startVarianceDays: diff };
  return { scheduleStatus: 'on_time', startVarianceDays: 0 };
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
}

function pickAllowed(data, allowedSet) {
  const out = {};
  for (const key of Object.keys(data || {})) {
    if (allowedSet.has(key)) out[key] = data[key];
  }
  return out;
}

/**
 * Update a project. Soft-deleted projects cannot be updated.
 * Strips id/createdAt/updatedAt/isDeleted/deletedAt and any unknown fields.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {Record<string, unknown>} data
 * @returns {Promise<object>} updated Project
 * @throws 404 if project not found
 */
export async function updateProject(prisma, projectId, data) {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    throw notFound(`Project '${projectId}' not found.`);
  }
  const patch = pickAllowed(data, ALLOWED_PROJECT_FIELDS);
  return prisma.project.update({
    where: { id: projectId },
    data: patch,
  });
}

/**
 * Soft-delete a project and cascade soft-delete its WorkItems in one transaction.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {{ actorUserId: string|null, actorDisplayName: string }} _actor reserved for future audit
 * @returns {Promise<void>}
 * @throws 404 if project not found or already soft-deleted
 */
export async function deleteProject(prisma, projectId, _actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({
      where: { id: projectId, isDeleted: false },
      select: { id: true },
    });
    if (!existing) {
      throw notFound(`Project '${projectId}' not found.`);
    }
    const now = new Date();
    await tx.project.update({
      where: { id: projectId },
      data: { isDeleted: true, deletedAt: now },
    });
    await tx.workItem.updateMany({
      where: { projectId, isDeleted: false },
      data: { isDeleted: true, deletedAt: now },
    });
  });
}

/**
 * Create a WorkItem under a project. Logs a ProjectItemActivity.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {Record<string, unknown>} data must include `title`
 * @param {{ actorUserId: string|null, actorDisplayName: string }} actor
 * @returns {Promise<object>} created WorkItem
 * @throws 404 if parent project not found
 * @throws 400 if `title` missing
 */
export async function createWorkItem(prisma, projectId, data, actor) {
  const title = String(data?.title || '').trim();
  if (!title) {
    throw badRequest("Field 'title' is required.");
  }
  return prisma.$transaction(async (tx) => {
    const parent = await tx.project.findFirst({
      where: { id: projectId, isDeleted: false },
      select: { id: true },
    });
    if (!parent) {
      throw notFound(`Project '${projectId}' not found.`);
    }
    const allowed = pickAllowed(data, ALLOWED_WORK_ITEM_FIELDS);
    coerceWorkItemDateFields(allowed);
    assertNoFutureDates(allowed);
    const workItem = await tx.workItem.create({
      data: { ...allowed, title, projectId },
    });
    await tx.projectItemActivity.create({
      data: {
        entityType: 'project_item',
        entityId: workItem.id,
        projectId,
        workItemId: workItem.id,
        actorUserId: actor?.actorUserId || null,
        actorDisplayName: actor?.actorDisplayName || 'User',
        actionType: 'work_item_created',
        message: `${actor?.actorDisplayName || 'User'} created work item: ${title}`,
        eventSource: 'user',
      },
    });
    return workItem;
  });
}

/**
 * Update a WorkItem (non-finance fields only).
 * Finance fields must be updated via the dedicated /details route.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {string} itemId
 * @param {Record<string, unknown>} data
 * @param {{ actorUserId: string|null, actorDisplayName: string }} _actor reserved for future audit
 * @returns {Promise<object>} updated WorkItem
 * @throws 404 if work item not found or doesn't belong to projectId
 * @throws 400 if a finance-sensitive field is present
 */
export async function updateWorkItem(prisma, projectId, itemId, data, actor) {
  // Pull every field we might diff against for the activity log, plus the
  // ones we read for rollup decisions.
  const existing = await prisma.workItem.findFirst({
    where: { id: itemId, projectId, isDeleted: false },
    select: {
      id: true, title: true, status: true, parentId: true, priority: true,
      assignee: true, weightPercent: true,
      plannedDate: true, actualDate: true, forecastDate: true, actualStartDate: true,
      completedDate: true, acceptanceDate: true, signedDate: true,
    },
  });
  if (!existing) {
    throw notFound(`Work item '${itemId}' not found in project '${projectId}'.`);
  }
  // We silently drop unknown keys (incl. finance fields + actor metadata) so
  // the drawer can echo back its full formData without forcing the frontend
  // to white-list. Finance fields still have to flow through /details.
  const patch = pickAllowed(data, ALLOWED_WORK_ITEM_FIELDS);
  coerceWorkItemDateFields(patch);
  assertNoFutureDates(patch);

  // A parent's status is a roll-up of its children — don't let the drawer
  // overwrite it. Same logic for weightPercent: a parent's share of the
  // project is implicit (sum of children) so we lock it to keep the math
  // consistent. Children still control both directly.
  const hasChildren = await prisma.workItem.count({
    where: { parentId: itemId, isDeleted: false },
  });
  if (hasChildren > 0) {
    if (Object.prototype.hasOwnProperty.call(patch, 'status')) delete patch.status;
    if (Object.prototype.hasOwnProperty.call(patch, 'weightPercent')) delete patch.weightPercent;
  }

  // Signing closes the task: when the client signs off, status auto-promotes
  // to 'done' unless the caller passes an explicit status in the same PATCH
  // (e.g. re-opening or status only changed by the rollup). Leaf items only —
  // parents already have status locked above.
  if (hasChildren === 0
      && Object.prototype.hasOwnProperty.call(patch, 'signedDate')
      && patch.signedDate instanceof Date
      && !Object.prototype.hasOwnProperty.call(patch, 'status')) {
    patch.status = 'done';
  }

  // Re-derive schedule status from the post-update planned+actual start dates.
  // We need the resulting effective values, so merge current row + patch.
  if (patch.plannedDate !== undefined || patch.actualStartDate !== undefined) {
    const current = await prisma.workItem.findUnique({
      where: { id: itemId },
      select: { plannedDate: true, actualStartDate: true },
    });
    const effPlanned = Object.prototype.hasOwnProperty.call(patch, 'plannedDate')
      ? patch.plannedDate
      : current?.plannedDate;
    const effStart = Object.prototype.hasOwnProperty.call(patch, 'actualStartDate')
      ? patch.actualStartDate
      : current?.actualStartDate;
    const sched = deriveStartSchedule(effPlanned, effStart);
    patch.scheduleStatus = sched.scheduleStatus;
    patch.startVarianceDays = sched.startVarianceDays;
  }

  // D13 — when a child's status changes, roll up the chain in the same tx.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workItem.update({
      where: { id: itemId },
      data: patch,
    });

    // Activity log: one entry per field whose value actually changed.
    const activities = buildWorkItemActivityEntries(existing, updated, actor, projectId);
    if (activities.length > 0) {
      await tx.projectItemActivity.createMany({ data: activities });
    }

    // Roll up to the parent chain when the leaf's status, dates, or weight
    // change. Each ancestor recomputes its own status (existing rollup) and
    // pulls min(start) / max(end) / aggregated weight from its direct kids.
    if (existing.parentId) {
      const triggers = ['status', 'actualStartDate', 'actualDate', 'completedDate', 'acceptanceDate', 'signedDate', 'weightPercent'];
      const shouldRollup = triggers.some((k) => Object.prototype.hasOwnProperty.call(patch, k));
      if (shouldRollup) {
        if (Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status !== existing.status) {
          await rollupStatus(tx, existing.parentId);
        }
        await rollupParentDatesAndWeight(tx, existing.parentId);
      }
    }
    return updated;
  });
}

// Walk up the ancestor chain and recompute each parent's actualStartDate
// (min of kids' starts), actualDate (max of kids' ends if every kid has one),
// completedDate / acceptanceDate / signedDate (max only when all kids reached
// the milestone — otherwise null), and weightPercent (sum of kids' weights).
async function rollupParentDatesAndWeight(tx, parentId) {
  let cursor = parentId;
  const guard = new Set();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const kids = await tx.workItem.findMany({
      where: { parentId: cursor, isDeleted: false },
      select: {
        actualStartDate: true, actualDate: true, completedDate: true,
        acceptanceDate: true, signedDate: true, weightPercent: true,
      },
    });
    if (kids.length === 0) break;

    const minDate = (vals) => {
      const ts = vals.filter(Boolean).map((d) => new Date(d).getTime());
      return ts.length > 0 ? new Date(Math.min(...ts)) : null;
    };
    const maxIfAll = (vals) => {
      if (vals.length === 0) return null;
      if (vals.some((v) => !v)) return null;
      const ts = vals.map((d) => new Date(d).getTime());
      return new Date(Math.max(...ts));
    };
    const weightSum = kids.reduce((acc, k) => acc + (k.weightPercent ? Number(k.weightPercent) : 0), 0);

    await tx.workItem.update({
      where: { id: cursor },
      data: {
        actualStartDate: minDate(kids.map((k) => k.actualStartDate)),
        actualDate:      maxIfAll(kids.map((k) => k.actualDate)),
        completedDate:   maxIfAll(kids.map((k) => k.completedDate)),
        acceptanceDate:  maxIfAll(kids.map((k) => k.acceptanceDate)),
        signedDate:      maxIfAll(kids.map((k) => k.signedDate)),
        weightPercent:   weightSum > 0 ? weightSum.toFixed(2) : null,
      },
    });

    const next = await tx.workItem.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = next?.parentId || null;
  }
}

// Diff `existing` vs `updated` and emit one ProjectItemActivity per change.
// Skips fields we don't care about logging (timestamps Prisma updates itself).
function buildWorkItemActivityEntries(existing, updated, actor, projectId) {
  const TRACKED = [
    'title', 'status', 'priority', 'assignee', 'weightPercent',
    'plannedDate', 'actualDate', 'forecastDate', 'actualStartDate',
    'completedDate', 'acceptanceDate', 'signedDate',
  ];
  const isoOrSame = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null);
  const sameValue = (a, b) => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (a instanceof Date || b instanceof Date) return isoOrSame(a) === isoOrSame(b);
    // Prisma Decimal columns come back as Decimal objects with same .toString()
    // but different identity (a === b is always false). Compare by string in
    // every non-primitive case so weightPercent: 50 → 50 stops getting logged.
    if (typeof a === 'object' || typeof b === 'object') return String(a) === String(b);
    if (typeof a !== typeof b) return String(a) === String(b);
    return a === b;
  };
  const rows = [];
  for (const key of TRACKED) {
    if (sameValue(existing[key], updated[key])) continue;
    const before = isoOrSame(existing[key]);
    const after = isoOrSame(updated[key]);
    rows.push({
      entityType: 'project_item',
      entityId: updated.id,
      projectId,
      workItemId: updated.id,
      actorUserId: actor?.actorUserId || null,
      actorDisplayName: actor?.actorDisplayName || 'User',
      actionType: 'work_item_updated',
      fieldName: key,
      oldValueJson: before,
      newValueJson: after,
      message: `${actor?.actorDisplayName || 'User'} changed ${key}: ${before ?? '∅'} → ${after ?? '∅'}`,
      eventSource: 'user',
    });
  }
  return rows;
}

/**
 * Soft-delete a WorkItem and log the action. Does NOT touch Finance state.
 *
 * TODO(sprint-2-pending): finance sync handling on work item deletion is unresolved.
 * Currently we soft-delete the WorkItem only; the Finance mirror record is left intact.
 * Decide with PO: (a) reverse, (b) mark orphan, (c) block deletion with 409.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {string} itemId
 * @param {{ actorUserId: string|null, actorDisplayName: string }} actor
 * @returns {Promise<void>}
 * @throws 404 if work item not found or doesn't belong to projectId
 */
export async function deleteWorkItem(prisma, projectId, itemId, actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workItem.findFirst({
      where: { id: itemId, projectId, isDeleted: false },
      select: { id: true, title: true, financeSyncStatus: true },
    });
    if (!existing) {
      throw notFound(`Work item '${itemId}' not found in project '${projectId}'.`);
    }
    if (existing.financeSyncStatus === 'synced') {
      console.warn(
        `[deleteWorkItem] WorkItem ${itemId} had active finance sync — Finance record left untouched. Business rule pending (Sprint 2 #5).`
      );
    }
    // Cascade soft-delete: walk the descendants tree (max 3 levels per
     // schema) and soft-delete each one in the same transaction. Without
    // this, deleting a parent left orphan sub-tasks visible at root.
    const descendantIds = await collectDescendantIds(tx, itemId);
    const allIds = [itemId, ...descendantIds];
    await tx.workItem.updateMany({
      where: { id: { in: allIds }, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await tx.projectItemActivity.create({
      data: {
        entityType: 'project_item',
        entityId: itemId,
        projectId,
        workItemId: itemId,
        actorUserId: actor?.actorUserId || null,
        actorDisplayName: actor?.actorDisplayName || 'User',
        actionType: 'work_item_deleted',
        message: descendantIds.length > 0
          ? `${actor?.actorDisplayName || 'User'} deleted '${existing.title}' and ${descendantIds.length} sub-task(s)`
          : `${actor?.actorDisplayName || 'User'} deleted work item: ${existing.title}`,
        eventSource: 'user',
      },
    });
  });
}

// Walk WorkItem.children breadth-first and return every descendant id.
async function collectDescendantIds(tx, rootId) {
  const found = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const kids = await tx.workItem.findMany({
      where: { parentId: { in: frontier }, isDeleted: false },
      select: { id: true },
    });
    if (kids.length === 0) break;
    const kidIds = kids.map((k) => k.id);
    found.push(...kidIds);
    frontier = kidIds;
  }
  return found;
}

/**
 * List active members of a project.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @returns {Promise<Array<object>>} project members
 * @throws 404 if project not found
 */
export async function listProjectMembers(prisma, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    throw notFound(`Project '${projectId}' not found.`);
  }
  return prisma.projectMember.findMany({
    where: { projectId, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { id: true, name: true, code: true } },
    },
  });
}

/**
 * Add a member to a project.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {{ userId: string, roleCode: string, departmentId?: string }} data
 * @returns {Promise<object>} created ProjectMember
 * @throws 404 if project not found
 * @throws 400 if userId or roleCode missing
 * @throws 409 if member already active with this roleCode
 */
export async function addProjectMember(prisma, projectId, data) {
  const userId = String(data?.userId || '').trim();
  const roleCode = String(data?.roleCode || data?.role || '').trim();
  if (!userId || !roleCode) {
    throw badRequest("Fields 'userId' and 'roleCode' are required.");
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    throw notFound(`Project '${projectId}' not found.`);
  }
  const existing = await prisma.projectMember.findFirst({
    where: { projectId, userId, roleCode, isDeleted: false },
    select: { id: true },
  });
  if (existing) {
    throw conflict(
      `User '${userId}' is already an active member with role '${roleCode}' on project '${projectId}'.`
    );
  }
  let departmentId = data?.departmentId ? String(data.departmentId).trim() : '';
  if (!departmentId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { departmentId: true },
    });
    if (!user?.departmentId) {
      throw badRequest(
        `Cannot resolve departmentId for user '${userId}'. Pass departmentId explicitly.`
      );
    }
    departmentId = user.departmentId;
  }
  return prisma.projectMember.create({
    data: { projectId, userId, roleCode, departmentId },
  });
}

/**
 * Soft-delete all active memberships for (projectId, userId) regardless of role.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<void>}
 * @throws 404 if no active membership found
 */
export async function removeProjectMember(prisma, projectId, userId) {
  const active = await prisma.projectMember.findMany({
    where: { projectId, userId, isDeleted: false },
    select: { id: true },
  });
  if (active.length === 0) {
    throw notFound(
      `No active membership found for user '${userId}' on project '${projectId}'.`
    );
  }
  await prisma.projectMember.updateMany({
    where: { projectId, userId, isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

const SCOPE_ALLOWED_KEYS = new Set(['objectives', 'deliverables', 'outOfScope', 'assumptions', 'constraints']);
const EMPTY_SCOPE = { objectives: [], deliverables: [], outOfScope: [], assumptions: [], constraints: [] };

export async function fetchProjectScope(prisma, projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  const scope = await prisma.projectScope.findUnique({
    where: { projectId },
  });
  return scope ?? { ...EMPTY_SCOPE, projectId };
}

export async function updateProjectScope(prisma, projectId, data, actor) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  const invalidKey = Object.keys(data).find((k) => !SCOPE_ALLOWED_KEYS.has(k));
  if (invalidKey) {
    const err = new Error(`Invalid field: ${invalidKey}`);
    err.statusCode = 400;
    err.code = 'INVALID_SCOPE_FIELD';
    err.field = invalidKey;
    throw err;
  }
  const invalidType = Object.entries(data).find(([, v]) => !Array.isArray(v));
  if (invalidType) {
    const err = new Error(`Field must be an array: ${invalidType[0]}`);
    err.statusCode = 400;
    err.code = 'INVALID_SCOPE_FIELD';
    err.field = invalidType[0];
    throw err;
  }
  return prisma.projectScope.upsert({
    where: { projectId },
    update: {
      ...data,
      updatedByUserId: actor?.actorUserId ?? null,
    },
    create: {
      projectId,
      ...EMPTY_SCOPE,
      ...data,
      updatedByUserId: actor?.actorUserId ?? null,
    },
  });
}
