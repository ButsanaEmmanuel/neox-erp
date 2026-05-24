// PM project mutation routes — Phase 2 of Sprint 2 refactor.
// Mounted from backend/auth-server.mjs via handlePmProjectRoutes(ctx).
//
// TODO(refactor): extract parseBody/parseActor/parseActorFromUrl/json into
// backend/utils.mjs once a second route module needs them. Currently injected
// via ctx for minimal blast radius.

import {
  updateProject,
  deleteProject,
  createWorkItem,
  updateWorkItem,
  deleteWorkItem,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  fetchProjectScope,
  updateProjectScope,
  getProjectById,
} from '../../services/pm/projectCrud.service.mjs';
import {
  listProjectMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '../../services/pm/milestones.service.mjs';
import { safeBroadcast } from '../../services/realtime/sseBroadcaster.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';
import {
  createSubTask,
  listSubTasks,
  moveSubTask,
} from '../../services/pm/workItemHierarchy.service.mjs';

// SSE payload hygiene : exclude auth metadata fields from patchedFields,
// they are not part of the business state mutated by the request.
const META_FIELDS = new Set(['actorUserId', 'actorDisplayName', 'userId']);
const patchedFieldsOf = (body) => Object.keys(body || {}).filter((k) => !META_FIELDS.has(k));

/**
 * Route a request to the appropriate PM project handler.
 *
 * @param {{
 *   req: import('http').IncomingMessage,
 *   res: import('http').ServerResponse,
 *   url: URL,
 *   pathname: string,
 *   method: string,
 *   prisma: import('@prisma/client').PrismaClient,
 *   assertModuleAccess: (prisma: any, url: URL, moduleId: string, body?: any) => Promise<unknown>,
 *   parseBody: (req: any) => Promise<any>,
 *   parseActor: (body: any) => { actorUserId: string|null, actorDisplayName: string },
 *   parseActorFromUrl: (url: URL) => { actorUserId: string|null, actorDisplayName: string },
 *   json: (res: any, status: number, payload: unknown) => void,
 * }} ctx
 * @returns {Promise<boolean>} true if the route was handled, false otherwise.
 */
export async function handlePmProjectRoutes(ctx) {
  const { res, pathname, method, json } = ctx;

  const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  const workItemsMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/work-items$/);
  const workItemMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/work-items\/([^/]+)$/);
  // D13 — sub-task routes are project-agnostic (lookup by workItemId).
  const subTasksMatch = pathname.match(/^\/api\/v1\/pm\/work-items\/([^/]+)\/subtasks$/);
  const workItemParentMatch = pathname.match(/^\/api\/v1\/pm\/work-items\/([^/]+)\/parent$/);
  const membersMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/members$/);
  const memberMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/members\/([^/]+)$/);
  const scopeMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/scope$/);
  const milestonesMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/milestones$/);
  const milestoneMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/milestones\/([^/]+)$/);

  // Fast bail-out: if no pattern + method combination matches what we own,
  // return false so the main flow keeps dispatching. This prevents the
  // try/catch below from swallowing errors that belong to other modules.
  const hasMatch =
    (projectMatch && (method === 'GET' || method === 'PATCH' || method === 'DELETE')) ||
    (workItemsMatch && method === 'POST') ||
    (workItemMatch && (method === 'PATCH' || method === 'DELETE')) ||
    (membersMatch && (method === 'GET' || method === 'POST')) ||
    (memberMatch && method === 'DELETE') ||
    (scopeMatch && (method === 'GET' || method === 'PATCH')) ||
    (milestonesMatch && (method === 'GET' || method === 'POST')) ||
    (milestoneMatch && (method === 'PATCH' || method === 'DELETE')) ||
    (subTasksMatch && (method === 'GET' || method === 'POST')) ||
    (workItemParentMatch && method === 'PATCH');

  if (!hasMatch) return false;

  try {
    if (projectMatch && method === 'GET') {
      const [, projectId] = projectMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.read'))) return true;
      const project = await getProjectById(ctx.prisma, projectId);
      json(res, 200, { project });
      return true;
    }

    if (projectMatch && method === 'PATCH') {
      const [, projectId] = projectMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.write'))) return true;
      const project = await updateProject(ctx.prisma, projectId, body);
      safeBroadcast('project_updated', { projectId, patchedFields: patchedFieldsOf(body) });
      json(res, 200, { project });
      return true;
    }

    if (projectMatch && method === 'DELETE') {
      const [, projectId] = projectMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.delete'))) return true;
      await deleteProject(ctx.prisma, projectId, actor);
      safeBroadcast('project_deleted', { projectId });
      json(res, 200, { ok: true });
      return true;
    }

    if (workItemsMatch && method === 'POST') {
      const [, projectId] = workItemsMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.write'))) return true;
      const workItem = await createWorkItem(ctx.prisma, projectId, body, actor);
      safeBroadcast('work_item_created', { projectId, workItemId: workItem.id, type: workItem.type });
      json(res, 201, { workItem });
      return true;
    }

    if (workItemMatch && method === 'PATCH') {
      const [, projectId, itemId] = workItemMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.write'))) return true;
      const workItem = await updateWorkItem(ctx.prisma, projectId, itemId, body, actor);
      safeBroadcast('work_item_updated', { projectId, workItemId: itemId, patchedFields: patchedFieldsOf(body) });
      json(res, 200, { workItem });
      return true;
    }

    if (workItemMatch && method === 'DELETE') {
      const [, projectId, itemId] = workItemMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.delete'))) return true;
      await deleteWorkItem(ctx.prisma, projectId, itemId, actor);
      safeBroadcast('work_item_deleted', { projectId, workItemId: itemId });
      json(res, 200, { ok: true });
      return true;
    }

    if (membersMatch && method === 'GET') {
      const [, projectId] = membersMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.read'))) return true;
      const members = await listProjectMembers(ctx.prisma, projectId);
      json(res, 200, { members });
      return true;
    }

    if (membersMatch && method === 'POST') {
      const [, projectId] = membersMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.write'))) return true;
      const member = await addProjectMember(ctx.prisma, projectId, body);
      safeBroadcast('project_member_added', { projectId, userId: member.userId, roleCode: member.roleCode });
      json(res, 201, { member });
      return true;
    }

    if (memberMatch && method === 'DELETE') {
      const [, projectId, userId] = memberMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.projects.write'))) return true;
      await removeProjectMember(ctx.prisma, projectId, userId);
      safeBroadcast('project_member_removed', { projectId, userId });
      json(res, 200, { ok: true });
      return true;
    }

    if (scopeMatch && method === 'GET') {
      const [, projectId] = scopeMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.scope.read'))) return true;
      const scope = await fetchProjectScope(ctx.prisma, projectId);
      json(res, 200, scope);
      return true;
    }

    if (scopeMatch && method === 'PATCH') {
      const [, projectId] = scopeMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.scope.write'))) return true;
      const scope = await updateProjectScope(ctx.prisma, projectId, body, actor);
      safeBroadcast('project_scope_updated', { projectId });
      json(res, 200, scope);
      return true;
    }

    if (milestonesMatch && method === 'GET') {
      const [, projectId] = milestonesMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.milestones.read'))) return true;
      const milestones = await listProjectMilestones(ctx.prisma, projectId);
      json(res, 200, { milestones });
      return true;
    }

    if (milestonesMatch && method === 'POST') {
      const [, projectId] = milestonesMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.milestones.write'))) return true;
      const milestone = await createMilestone(ctx.prisma, projectId, body);
      safeBroadcast('milestone_created', { projectId, milestoneId: milestone.id });
      json(res, 201, { milestone });
      return true;
    }

    if (milestoneMatch && method === 'PATCH') {
      const [, projectId, milestoneId] = milestoneMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.milestones.write'))) return true;
      const milestone = await updateMilestone(ctx.prisma, projectId, milestoneId, body);
      safeBroadcast('milestone_updated', { projectId, milestoneId, patchedFields: patchedFieldsOf(body) });
      json(res, 200, { milestone });
      return true;
    }

    if (milestoneMatch && method === 'DELETE') {
      const [, projectId, milestoneId] = milestoneMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.milestones.delete'))) return true;
      await deleteMilestone(ctx.prisma, projectId, milestoneId);
      safeBroadcast('milestone_deleted', { projectId, milestoneId });
      json(res, 200, { ok: true });
      return true;
    }

    // D13 — sub-task hierarchy routes (project-agnostic).
    if (subTasksMatch && method === 'GET') {
      const [, workItemId] = subTasksMatch;
      const actor = ctx.parseActorFromUrl(ctx.url);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.read'))) return true;
      const subtasks = await listSubTasks(ctx.prisma, workItemId);
      json(res, 200, { subtasks });
      return true;
    }

    if (subTasksMatch && method === 'POST') {
      const [, parentId] = subTasksMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.write'))) return true;
      const workItem = await createSubTask(ctx.prisma, parentId, body, actor);
      safeBroadcast('work_item_created', { projectId: workItem.projectId, workItemId: workItem.id, type: workItem.type, parentId });
      json(res, 201, { workItem });
      return true;
    }

    if (workItemParentMatch && method === 'PATCH') {
      const [, workItemId] = workItemParentMatch;
      const body = await ctx.parseBody(ctx.req);
      const actor = ctx.parseActor(body);
      if (!(await assertPermission({ userId: actor.actorUserId, res }, 'pm.workItems.write'))) return true;
      const workItem = await moveSubTask(ctx.prisma, workItemId, { parentId: body?.parentId ?? null });
      safeBroadcast('work_item_updated', { projectId: workItem.projectId, workItemId, patchedFields: ['parentId'] });
      json(res, 200, { workItem });
      return true;
    }

    // Defensive: hasMatch said we own this, but no branch matched.
    // Indicates a bug in hasMatch — log and surface as 500.
    console.error(
      `[handlePmProjectRoutes] hasMatch true but no branch matched: ${method} ${pathname}`
    );
    json(res, 500, { error: 'Internal routing error' });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error(`[handlePmProjectRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    // D14 — forward structured details when present (e.g. MILESTONE_BLOCKED).
    if (Array.isArray(err?.blockers)) payload.blockers = err.blockers;
    if (err?.field) payload.field = err.field;
    json(res, status, payload);
    return true;
  }
}
