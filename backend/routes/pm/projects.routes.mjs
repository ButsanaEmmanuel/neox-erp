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
    (milestoneMatch && (method === 'PATCH' || method === 'DELETE'));

  if (!hasMatch) return false;

  try {
    if (projectMatch && method === 'GET') {
      const [, projectId] = projectMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const project = await getProjectById(ctx.prisma, projectId);
      json(res, 200, { project });
      return true;
    }

    if (projectMatch && method === 'PATCH') {
      const [, projectId] = projectMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const project = await updateProject(ctx.prisma, projectId, body);
      json(res, 200, { project });
      return true;
    }

    if (projectMatch && method === 'DELETE') {
      const [, projectId] = projectMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const actor = ctx.parseActorFromUrl(ctx.url);
      await deleteProject(ctx.prisma, projectId, actor);
      json(res, 200, { ok: true });
      return true;
    }

    if (workItemsMatch && method === 'POST') {
      const [, projectId] = workItemsMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const actor = ctx.parseActor(body);
      const workItem = await createWorkItem(ctx.prisma, projectId, body, actor);
      json(res, 201, { workItem });
      return true;
    }

    if (workItemMatch && method === 'PATCH') {
      const [, projectId, itemId] = workItemMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const actor = ctx.parseActor(body);
      const workItem = await updateWorkItem(ctx.prisma, projectId, itemId, body, actor);
      json(res, 200, { workItem });
      return true;
    }

    if (workItemMatch && method === 'DELETE') {
      const [, projectId, itemId] = workItemMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const actor = ctx.parseActorFromUrl(ctx.url);
      await deleteWorkItem(ctx.prisma, projectId, itemId, actor);
      json(res, 200, { ok: true });
      return true;
    }

    if (membersMatch && method === 'GET') {
      const [, projectId] = membersMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const members = await listProjectMembers(ctx.prisma, projectId);
      json(res, 200, { members });
      return true;
    }

    if (membersMatch && method === 'POST') {
      const [, projectId] = membersMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const member = await addProjectMember(ctx.prisma, projectId, body);
      json(res, 201, { member });
      return true;
    }

    if (memberMatch && method === 'DELETE') {
      const [, projectId, userId] = memberMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      await removeProjectMember(ctx.prisma, projectId, userId);
      json(res, 200, { ok: true });
      return true;
    }

    if (scopeMatch && method === 'GET') {
      const [, projectId] = scopeMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const scope = await fetchProjectScope(ctx.prisma, projectId);
      json(res, 200, scope);
      return true;
    }

    if (scopeMatch && method === 'PATCH') {
      const [, projectId] = scopeMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const actor = ctx.parseActor(body);
      const scope = await updateProjectScope(ctx.prisma, projectId, body, actor);
      json(res, 200, scope);
      return true;
    }

    if (milestonesMatch && method === 'GET') {
      const [, projectId] = milestonesMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      const milestones = await listProjectMilestones(ctx.prisma, projectId);
      json(res, 200, { milestones });
      return true;
    }

    if (milestonesMatch && method === 'POST') {
      const [, projectId] = milestonesMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const milestone = await createMilestone(ctx.prisma, projectId, body);
      json(res, 201, { milestone });
      return true;
    }

    if (milestoneMatch && method === 'PATCH') {
      const [, projectId, milestoneId] = milestoneMatch;
      const body = await ctx.parseBody(ctx.req);
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project', body);
      const milestone = await updateMilestone(ctx.prisma, projectId, milestoneId, body);
      json(res, 200, { milestone });
      return true;
    }

    if (milestoneMatch && method === 'DELETE') {
      const [, projectId, milestoneId] = milestoneMatch;
      await ctx.assertModuleAccess(ctx.prisma, ctx.url, 'project');
      await deleteMilestone(ctx.prisma, projectId, milestoneId);
      json(res, 200, { ok: true });
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
    json(res, status, payload);
    return true;
  }
}
