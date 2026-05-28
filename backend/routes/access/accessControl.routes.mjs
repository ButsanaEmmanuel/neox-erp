// Access Control Center — phase 2 read-only routes.
//
// Three endpoints, all GET, all gated by `system.rbac.read` (which the
// legacy ADMIN role already holds via the seeded UserPermissionSet and
// which the super_admin wildcard bypass also covers). Nothing mutates
// from this module — phase 2 is the visual shell only.
//
//   GET /api/v1/access-control/summary    → counts for top cards
//   GET /api/v1/access-control/roles      → list of roles (read-only)
//   GET /api/v1/access-control/roles/:id  → single role + per-tab counters

import { assertPermission } from '../../services/auth/rbac.service.mjs';

const ROLE_DETAIL = /^\/api\/v1\/access-control\/roles\/([^/]+)$/;

export function hasMatch(pathname) {
  return (
    pathname === '/api/v1/access-control/summary'
    || pathname === '/api/v1/access-control/roles'
    || ROLE_DETAIL.test(pathname)
  );
}

function parseActorFromUrl(url) {
  return { actorUserId: String(url.searchParams.get('userId') || '').trim() };
}

export async function handleAccessControlRoutes(ctx) {
  const { method, pathname, url, res, json, prisma } = ctx;
  if (method !== 'GET' || !hasMatch(pathname)) return false;

  const actor = parseActorFromUrl(url);
  if (!(await assertPermission({ userId: actor.actorUserId, res }, 'system.rbac.read'))) return true;

  try {
    if (pathname === '/api/v1/access-control/summary') {
      const [roles, systemRoles, modules, pages, actions, auditEvents, approvalWorkflows, crossWorkflows] = await Promise.all([
        prisma.role.count({ where: { isDeleted: false } }),
        prisma.role.count({ where: { isDeleted: false, isSystem: true } }),
        prisma.appModule.count(),
        prisma.appPage.count(),
        prisma.permissionAction.count(),
        prisma.permissionAuditLog.count(),
        prisma.approvalWorkflow.count(),
        prisma.crossModuleWorkflow.count(),
      ]);
      json(res, 200, {
        summary: {
          roles,
          systemRoles,
          modules,
          pages,
          actions,
          auditEvents,
          approvalWorkflows,
          crossModuleWorkflows: crossWorkflows,
        },
      });
      return true;
    }

    if (pathname === '/api/v1/access-control/roles') {
      const rows = await prisma.role.findMany({
        where: { isDeleted: false },
        orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          label: true,
          description: true,
          isSystem: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              userRoles: { where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] } },
              pageAccess: { where: { canView: true } },
              actionPermissions: { where: { allowed: true } },
              dataScopes: true,
              fieldPermissions: true,
              linkedRecordPermissions: true,
            },
          },
        },
      });
      const roles = rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        counts: {
          members: r._count.userRoles,
          pages: r._count.pageAccess,
          actions: r._count.actionPermissions,
          dataScopes: r._count.dataScopes,
          fieldRestrictions: r._count.fieldPermissions,
          linkedRecords: r._count.linkedRecordPermissions,
        },
      }));
      json(res, 200, { roles });
      return true;
    }

    const detailMatch = pathname.match(ROLE_DETAIL);
    if (detailMatch) {
      const [, roleId] = detailMatch;
      const role = await prisma.role.findFirst({
        where: { id: roleId, isDeleted: false },
        select: {
          id: true,
          code: true,
          name: true,
          label: true,
          description: true,
          isSystem: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              userRoles: { where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] } },
              pageAccess: { where: { canView: true } },
              actionPermissions: { where: { allowed: true } },
              dataScopes: true,
              fieldPermissions: true,
              linkedRecordPermissions: true,
            },
          },
        },
      });
      if (!role) {
        json(res, 404, { error: 'Role not found.' });
        return true;
      }
      // Surface the role's data-scope summary (module → scopeType) so
      // the Overview tab can render a human sentence per module without
      // a follow-up request.
      const scopes = await prisma.roleDataScope.findMany({
        where: { roleId: role.id },
        select: { moduleKey: true, pageKey: true, scopeType: true },
        orderBy: { moduleKey: 'asc' },
      });

      json(res, 200, {
        role: {
          id: role.id,
          code: role.code,
          name: role.name,
          label: role.label,
          description: role.description,
          isSystem: role.isSystem,
          isActive: role.isActive,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
          counts: {
            members: role._count.userRoles,
            pages: role._count.pageAccess,
            actions: role._count.actionPermissions,
            dataScopes: role._count.dataScopes,
            fieldRestrictions: role._count.fieldPermissions,
            linkedRecords: role._count.linkedRecordPermissions,
          },
          scopes,
        },
      });
      return true;
    }
  } catch (err) {
    console.error('[handleAccessControlRoutes] failed:', err);
    json(res, 500, { error: err?.message || 'Internal error' });
    return true;
  }
  return false;
}
