// HRM-1.3 — /api/v1/hrm/* RBAC admin dispatcher.
//
// Mounted from backend/auth-server.mjs via handleHrmRbacRoutes(ctx).
//
// Auth model: identity (for assignedBy and audit) is read from the
// existing query/body convention (userId / actorUserId). No new auth
// layer introduced here — when assertPermission(ctx, key) lands, it
// will be threaded through these handlers as a one-liner per route.

import {
  listPermissions,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listUserAssignments,
  assignRoleToUser,
  revokeUserRole,
  upsertUserOverride,
  removeUserOverride,
} from '../../services/hrm/rbacAdmin.service.mjs';

const ROLES_COLL = /^\/api\/v1\/hrm\/roles$/;
const ROLE_ITEM  = /^\/api\/v1\/hrm\/roles\/([^/]+)$/;
const PERMS_COLL = /^\/api\/v1\/hrm\/permissions$/;
const USER_PERMS = /^\/api\/v1\/hrm\/users\/([^/]+)\/permissions$/;
const USER_ROLES = /^\/api\/v1\/hrm\/users\/([^/]+)\/roles$/;
const USER_ROLE_ITEM = /^\/api\/v1\/hrm\/users\/([^/]+)\/roles\/([^/]+)$/;
const USER_OVERRIDES = /^\/api\/v1\/hrm\/users\/([^/]+)\/overrides$/;
const USER_OVERRIDE_ITEM = /^\/api\/v1\/hrm\/users\/([^/]+)\/overrides\/([^/]+)$/;

function actorFromCtx(ctx, body) {
  return (
    String(ctx.url.searchParams.get('actorUserId') || '').trim()
    || String(body?.actorUserId || body?.userId || '').trim()
    || null
  );
}

function hasMatch(pathname) {
  return (
    ROLES_COLL.test(pathname)
    || ROLE_ITEM.test(pathname)
    || PERMS_COLL.test(pathname)
    || USER_PERMS.test(pathname)
    || USER_ROLES.test(pathname)
    || USER_ROLE_ITEM.test(pathname)
    || USER_OVERRIDES.test(pathname)
    || USER_OVERRIDE_ITEM.test(pathname)
  );
}

/**
 * @param {{
 *   req: import('http').IncomingMessage,
 *   res: import('http').ServerResponse,
 *   url: URL,
 *   pathname: string,
 *   method: string,
 *   prisma: import('@prisma/client').PrismaClient,
 *   parseBody: (req: any) => Promise<any>,
 *   json: (res: any, status: number, payload: unknown) => void,
 * }} ctx
 * @returns {Promise<boolean>}
 */
export async function handleHrmRbacRoutes(ctx) {
  const { method, pathname, prisma, parseBody, json, res } = ctx;
  if (!hasMatch(pathname)) return false;

  try {
    // --- /api/v1/hrm/permissions ---
    if (PERMS_COLL.test(pathname) && method === 'GET') {
      const groups = await listPermissions(prisma);
      json(res, 200, { modules: groups });
      return true;
    }

    // --- /api/v1/hrm/roles ---
    if (ROLES_COLL.test(pathname) && method === 'GET') {
      const roles = await listRoles(prisma);
      json(res, 200, { roles });
      return true;
    }
    if (ROLES_COLL.test(pathname) && method === 'POST') {
      const body = await parseBody(ctx.req);
      const role = await createRole(prisma, {
        code: body?.code,
        label: body?.label,
        description: body?.description,
        permissionIds: body?.permissionIds,
      });
      json(res, 201, { role });
      return true;
    }

    // --- /api/v1/hrm/roles/:id ---
    const roleItemMatch = pathname.match(ROLE_ITEM);
    if (roleItemMatch && method === 'GET') {
      const [, roleId] = roleItemMatch;
      const role = await getRole(prisma, roleId);
      json(res, 200, { role });
      return true;
    }
    if (roleItemMatch && method === 'PUT') {
      const [, roleId] = roleItemMatch;
      const body = await parseBody(ctx.req);
      const role = await updateRole(prisma, roleId, {
        label: body?.label,
        description: body?.description,
        permissionIds: body?.permissionIds,
      });
      json(res, 200, { role });
      return true;
    }
    if (roleItemMatch && method === 'DELETE') {
      const [, roleId] = roleItemMatch;
      const result = await deleteRole(prisma, roleId);
      json(res, 200, result);
      return true;
    }

    // --- /api/v1/hrm/users/:id/permissions ---
    const userPermsMatch = pathname.match(USER_PERMS);
    if (userPermsMatch && method === 'GET') {
      const [, userId] = userPermsMatch;
      const result = await listUserAssignments(prisma, userId);
      json(res, 200, result);
      return true;
    }

    // --- /api/v1/hrm/users/:id/roles ---
    const userRolesMatch = pathname.match(USER_ROLES);
    if (userRolesMatch && method === 'POST') {
      const [, userId] = userRolesMatch;
      const body = await parseBody(ctx.req);
      if (!body?.roleId) {
        json(res, 400, { error: 'roleId is required', code: 'BAD_REQUEST', field: 'roleId' });
        return true;
      }
      const assignment = await assignRoleToUser(prisma, userId, body.roleId, {
        assignedBy: actorFromCtx(ctx, body),
      });
      json(res, 201, { assignment });
      return true;
    }

    // --- /api/v1/hrm/users/:id/roles/:roleId ---
    const userRoleItemMatch = pathname.match(USER_ROLE_ITEM);
    if (userRoleItemMatch && method === 'DELETE') {
      const [, userId, roleId] = userRoleItemMatch;
      const result = await revokeUserRole(prisma, userId, roleId);
      json(res, 200, result);
      return true;
    }

    // --- /api/v1/hrm/users/:id/overrides ---
    const userOverridesMatch = pathname.match(USER_OVERRIDES);
    if (userOverridesMatch && method === 'POST') {
      const [, userId] = userOverridesMatch;
      const body = await parseBody(ctx.req);
      const override = await upsertUserOverride(prisma, userId, {
        permissionId: body?.permissionId,
        effect: body?.effect,
        reason: body?.reason,
        expiresAt: body?.expiresAt,
        assignedBy: actorFromCtx(ctx, body),
      });
      json(res, 200, { override });
      return true;
    }

    // --- /api/v1/hrm/users/:id/overrides/:permId ---
    const userOverrideItemMatch = pathname.match(USER_OVERRIDE_ITEM);
    if (userOverrideItemMatch && method === 'DELETE') {
      const [, userId, permissionId] = userOverrideItemMatch;
      const result = await removeUserOverride(prisma, userId, permissionId);
      json(res, 200, result);
      return true;
    }

    // hasMatch was true but no branch matched -> 405.
    json(res, 405, {
      error: `Method ${method} not allowed on ${pathname}`,
      code: 'METHOD_NOT_ALLOWED',
    });
    return true;
  } catch (err) {
    const status = err?.statusCode || 500;
    if (status >= 500) {
      console.error(`[handleHrmRbacRoutes] ${method} ${pathname} failed:`, err);
    }
    const payload = { error: err?.message || 'Internal error' };
    if (err?.code) payload.code = err.code;
    if (err?.field) payload.field = err.field;
    if (err?.existingRoleId) payload.existingRoleId = err.existingRoleId;
    if (err?.activeAssignments !== undefined) payload.activeAssignments = err.activeAssignments;
    if (err?.assignmentId) payload.assignmentId = err.assignmentId;
    if (err?.roleCode) payload.roleCode = err.roleCode;
    json(res, status, payload);
    return true;
  }
}
