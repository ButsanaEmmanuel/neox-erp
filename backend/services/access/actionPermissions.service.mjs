// Access Control Center — phase 4.
// "Action Permissions" service: read the action matrix per page for a
// role, save toggle diffs atomically + log + reproject. Pattern is
// symmetric to pageAccess.service.mjs (phase 3).
//
// Pages the role cannot view are still surfaced in the read response
// so the UI can render them disabled with a clear hint, but any
// PATCH attempt against those pages is silently filtered — the
// invariant "you can only do things on pages you can see" stays
// enforced at write time, not just at render.

import { projectRolePermissions } from './accessProjection.service.mjs';

const SUPER_ADMIN_CODE = 'super_admin';

// Return modules → pages → action toggles for a role. Includes:
//   - role.locked (super_admin)
//   - role.code, label
//   - global actions catalogue (ordered)
//   - module/page tree with each page's canView + per-action allowed
export async function readActionPermissionsForRole(prisma, roleId) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
    select: { id: true, code: true, label: true, isSystem: true, isActive: true },
  });
  if (!role) return null;

  const isSuperAdmin = role.code === SUPER_ADMIN_CODE;

  const [actions, modules, pageAccess, actionPerms] = await Promise.all([
    prisma.permissionAction.findMany({
      orderBy: { actionKey: 'asc' },
      select: { id: true, actionKey: true, actionName: true, description: true },
    }),
    prisma.appModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { moduleKey: 'asc' }],
      select: {
        id: true,
        moduleKey: true,
        moduleName: true,
        icon: true,
        sortOrder: true,
        pages: {
          orderBy: [{ sortOrder: 'asc' }, { pageKey: 'asc' }],
          select: {
            id: true,
            pageKey: true,
            pageName: true,
            route: true,
            icon: true,
            parentPageId: true,
            sortOrder: true,
          },
        },
      },
    }),
    prisma.rolePageAccess.findMany({
      where: { roleId },
      select: { pageId: true, canView: true },
    }),
    prisma.roleActionPermission.findMany({
      where: { roleId },
      select: { pageId: true, actionId: true, allowed: true },
    }),
  ]);

  const canViewByPageId = new Map(pageAccess.map((a) => [a.pageId, a.canView]));
  // Lookup map (pageId, actionId) → allowed.
  const allowedByPair = new Map();
  for (const ap of actionPerms) {
    allowedByPair.set(`${ap.pageId}::${ap.actionId}`, ap.allowed);
  }

  const tree = modules.map((m) => ({
    id: m.id,
    moduleKey: m.moduleKey,
    moduleName: m.moduleName,
    icon: m.icon,
    sortOrder: m.sortOrder,
    pages: m.pages.map((p) => {
      const canView = isSuperAdmin
        ? true
        : Boolean(canViewByPageId.get(p.id) ?? false);
      const actionStates = actions.map((a) => {
        const stored = allowedByPair.get(`${p.id}::${a.id}`);
        const allowed = isSuperAdmin
          ? true
          : Boolean(stored ?? false);
        return {
          actionId: a.id,
          actionKey: a.actionKey,
          actionName: a.actionName,
          allowed,
        };
      });
      return {
        id: p.id,
        pageKey: p.pageKey,
        pageName: p.pageName,
        route: p.route,
        icon: p.icon,
        parentPageId: p.parentPageId,
        sortOrder: p.sortOrder,
        canView,
        actions: actionStates,
      };
    }),
  }));

  return {
    role: {
      id: role.id,
      code: role.code,
      label: role.label,
      isSystem: role.isSystem,
      isActive: role.isActive,
      locked: isSuperAdmin,
    },
    actions, // global catalogue for column headers
    modules: tree,
  };
}

// SuperAdminLockedError mirrored from pageAccess.service.mjs.
// Kept local so this module stays drop-in independent.
export class SuperAdminLockedError extends Error {
  constructor() {
    super('super_admin action permissions are locked and cannot be modified.');
    this.statusCode = 409;
    this.code = 'SUPER_ADMIN_LOCKED';
  }
}

// Apply a list of (pageId, actionId, allowed) tuples for the given
// role. Invariants:
//   - super_admin is rejected wholesale (409 from the caller).
//   - Pages where the role has canView=false are dropped from the
//     payload — write-time enforcement of "no actions on hidden pages".
//   - Only tuples whose allowed flag actually changes are written +
//     logged. Idempotent re-runs produce zero writes.
//   - All writes happen in a single transaction with the audit log.
//   - Projection runs AFTER the transaction commits.
export async function saveActionPermissionsForRole(prisma, payload) {
  const { roleId, changes, actorUserId, actorDisplayName } = payload;
  if (!roleId) throw new Error('roleId is required');
  if (!Array.isArray(changes)) throw new Error('changes must be an array');

  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
    select: { id: true, code: true },
  });
  if (!role) {
    const err = new Error('Role not found.');
    err.statusCode = 404;
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }
  if (role.code === SUPER_ADMIN_CODE) throw new SuperAdminLockedError();

  if (changes.length === 0) {
    return { saved: 0, audited: 0, projected: 0, skippedHidden: 0 };
  }

  // Normalise + dedupe by (pageId, actionId). Last write wins for
  // duplicates in the same payload (the UI should never send these,
  // but the service must be defensive).
  const normalised = new Map();
  for (const c of changes) {
    const pageId = String(c.pageId || '').trim();
    const actionId = String(c.actionId || '').trim();
    if (!pageId || !actionId) continue;
    normalised.set(`${pageId}::${actionId}`, {
      pageId, actionId, allowed: Boolean(c.allowed),
    });
  }
  if (normalised.size === 0) {
    return { saved: 0, audited: 0, projected: 0, skippedHidden: 0 };
  }

  const pageIds = [...new Set([...normalised.values()].map((c) => c.pageId))];
  const actionIds = [...new Set([...normalised.values()].map((c) => c.actionId))];

  // Drop changes that target pages the role can't view. We don't
  // throw — silently skip and count so the UI can flag stale state.
  const visiblePages = await prisma.rolePageAccess.findMany({
    where: { roleId, pageId: { in: pageIds }, canView: true },
    select: { pageId: true },
  });
  const visiblePageIds = new Set(visiblePages.map((v) => v.pageId));
  let skippedHidden = 0;
  for (const key of [...normalised.keys()]) {
    const c = normalised.get(key);
    if (!visiblePageIds.has(c.pageId)) {
      skippedHidden += 1;
      normalised.delete(key);
    }
  }
  if (normalised.size === 0) {
    return { saved: 0, audited: 0, projected: 0, skippedHidden };
  }

  // Look up page + action metadata for the audit log payload.
  const [pages, actions, current] = await Promise.all([
    prisma.appPage.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, pageKey: true, pageName: true },
    }),
    prisma.permissionAction.findMany({
      where: { id: { in: actionIds } },
      select: { id: true, actionKey: true, actionName: true },
    }),
    prisma.roleActionPermission.findMany({
      where: {
        roleId,
        pageId: { in: pageIds },
        actionId: { in: actionIds },
      },
      select: { pageId: true, actionId: true, allowed: true },
    }),
  ]);
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const currentByPair = new Map(
    current.map((c) => [`${c.pageId}::${c.actionId}`, c.allowed]),
  );

  const realChanges = [];
  for (const c of normalised.values()) {
    if (!pageById.has(c.pageId) || !actionById.has(c.actionId)) continue;
    const prev = Boolean(currentByPair.get(`${c.pageId}::${c.actionId}`) ?? false);
    if (prev !== c.allowed) {
      realChanges.push({
        pageId: c.pageId,
        actionId: c.actionId,
        prev,
        next: c.allowed,
        page: pageById.get(c.pageId),
        action: actionById.get(c.actionId),
      });
    }
  }
  if (realChanges.length === 0) {
    return { saved: 0, audited: 0, projected: 0, skippedHidden };
  }

  await prisma.$transaction(async (tx) => {
    for (const ch of realChanges) {
      const existing = await tx.roleActionPermission.findUnique({
        where: {
          roleId_pageId_actionId: {
            roleId, pageId: ch.pageId, actionId: ch.actionId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.roleActionPermission.update({
          where: { id: existing.id },
          data: { allowed: ch.next },
        });
      } else {
        await tx.roleActionPermission.create({
          data: {
            roleId, pageId: ch.pageId, actionId: ch.actionId,
            allowed: ch.next,
          },
        });
      }
      await tx.permissionAuditLog.create({
        data: {
          roleId,
          changedBy: actorUserId || 'system',
          changeType: 'action_permission_changed',
          entityType: 'RoleActionPermission',
          entityId: `${ch.pageId}::${ch.actionId}`,
          previousValue: { allowed: ch.prev },
          newValue: {
            allowed: ch.next,
            pageKey: ch.page.pageKey,
            pageName: ch.page.pageName,
            actionKey: ch.action.actionKey,
            actionName: ch.action.actionName,
            actorDisplayName: actorDisplayName || null,
          },
        },
      });
    }
  });

  let projected = 0;
  try {
    const result = await projectRolePermissions(prisma, role.id);
    projected = result.projectedRoles ?? 0;
  } catch (err) {
    console.error('[actionPermissions.save] projection failed (non-fatal):', err);
  }

  return {
    saved: realChanges.length,
    audited: realChanges.length,
    projected,
    skippedHidden,
  };
}
