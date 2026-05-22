// PM project CRUD — Phase 2 of Sprint 2 refactor.
// Mounted by backend/routes/pm/projects.routes.mjs.
//
// Conventions:
//   - All reads filter { isDeleted: false }.
//   - All deletes are soft: { isDeleted: true, deletedAt: new Date() }.
//   - Business errors throw `Error` with `err.statusCode` set (400/404/409).
//   - Activity logs go to ProjectItemActivity for work-item lifecycle events.

export { getProjectById } from '../projects/projectCollaboration.service.mjs';

const ALLOWED_PROJECT_FIELDS = new Set([
  'name', 'clientName', 'clientAccountId', 'status', 'projectMode',
  'isTelecomProject', 'bulkImportRequired', 'purchaseOrder', 'projectCategory',
  'managerId', 'ownerDepartmentId', 'startDate', 'endDate', 'description',
]);

const ALLOWED_WORK_ITEM_FIELDS = new Set([
  'title', 'description', 'status', 'priority', 'assignee',
  'plannedDate', 'actualDate', 'type',
]);

const FINANCE_FIELDS_HINT_ROUTE =
  'PATCH /api/v1/pm/projects/:projectId/work-items/:itemId/details';

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
export async function updateWorkItem(prisma, projectId, itemId, data, _actor) {
  const existing = await prisma.workItem.findFirst({
    where: { id: itemId, projectId, isDeleted: false },
    select: { id: true },
  });
  if (!existing) {
    throw notFound(`Work item '${itemId}' not found in project '${projectId}'.`);
  }
  for (const key of Object.keys(data || {})) {
    if (!ALLOWED_WORK_ITEM_FIELDS.has(key)) {
      throw badRequest(
        `Field '${key}' must be updated via ${FINANCE_FIELDS_HINT_ROUTE}`
      );
    }
  }
  const patch = pickAllowed(data, ALLOWED_WORK_ITEM_FIELDS);
  return prisma.workItem.update({
    where: { id: itemId },
    data: patch,
  });
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
    await tx.workItem.update({
      where: { id: itemId },
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
        message: `${actor?.actorDisplayName || 'User'} deleted work item: ${existing.title}`,
        eventSource: 'user',
      },
    });
  });
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
