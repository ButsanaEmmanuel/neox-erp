// Access Control Center — phase 3.
// "Module & Page Access" service: read the page tree with each role's
// visibility flags, save toggles atomically + log + reproject.
//
// Idempotent everywhere. The save endpoint accepts only the pages
// whose visibility actually changed — recomputed by diffing the
// incoming payload against the current row set. Unchanged toggles
// produce zero writes and zero audit rows.

import { projectRolePermissions } from './accessProjection.service.mjs';

const SUPER_ADMIN_CODE = 'super_admin';

// Return modules → pages with the role's canView flag.
// Used by the Module & Page Access tab to render the toggle tree.
export async function readPageAccessForRole(prisma, roleId) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
    select: { id: true, code: true, label: true, isSystem: true, isActive: true },
  });
  if (!role) return null;

  const modules = await prisma.appModule.findMany({
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
          isSidebarVisible: true,
          sortOrder: true,
        },
      },
    },
  });

  const access = await prisma.rolePageAccess.findMany({
    where: { roleId },
    select: { pageId: true, canView: true },
  });
  const canViewByPageId = new Map(access.map((a) => [a.pageId, a.canView]));

  // For super_admin, force-true everywhere so the UI cannot represent
  // a partial state. The DB still reflects whatever's stored, but the
  // shape returned here matches the locked invariant.
  const isSuperAdmin = role.code === SUPER_ADMIN_CODE;

  const tree = modules.map((m) => ({
    id: m.id,
    moduleKey: m.moduleKey,
    moduleName: m.moduleName,
    icon: m.icon,
    sortOrder: m.sortOrder,
    pages: m.pages.map((p) => ({
      id: p.id,
      pageKey: p.pageKey,
      pageName: p.pageName,
      route: p.route,
      icon: p.icon,
      parentPageId: p.parentPageId,
      sortOrder: p.sortOrder,
      isSidebarVisible: p.isSidebarVisible,
      canView: isSuperAdmin ? true : Boolean(canViewByPageId.get(p.id) ?? false),
    })),
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
    modules: tree,
  };
}

// Apply a list of page-access changes for the given role.
//
// Input shape: { changes: [{ pageId, canView }, ...] }
// Returns { saved, audited, projected }.
//
// Invariants enforced:
//   - super_admin can NEVER be restricted via this endpoint (returns
//     409 from the caller; service throws SuperAdminLockedError).
//   - Only pages whose canView actually changes are written + logged.
//   - All writes happen in a single transaction with the audit log,
//     so a partial failure leaves nothing half-applied.
//   - Projection runs AFTER the transaction commits — it touches
//     RolePermission rows and must not see in-flight RolePageAccess.

export class SuperAdminLockedError extends Error {
  constructor() {
    super('super_admin page access is locked and cannot be modified.');
    this.statusCode = 409;
    this.code = 'SUPER_ADMIN_LOCKED';
  }
}

export async function savePageAccessForRole(prisma, payload) {
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

  // Pull the current row set so we can compute the actual diff —
  // payload entries with no real change become no-ops.
  const pageIds = changes.map((c) => String(c.pageId || '').trim()).filter(Boolean);
  if (pageIds.length === 0) {
    return { saved: 0, audited: 0, projected: 0 };
  }
  const [pages, current] = await Promise.all([
    prisma.appPage.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, pageKey: true, pageName: true },
    }),
    prisma.rolePageAccess.findMany({
      where: { roleId, pageId: { in: pageIds } },
      select: { pageId: true, canView: true },
    }),
  ]);
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const currentByPage = new Map(current.map((c) => [c.pageId, c.canView]));

  const realChanges = [];
  for (const c of changes) {
    const pageId = String(c.pageId || '').trim();
    const next = Boolean(c.canView);
    if (!pageId || !pageById.has(pageId)) continue;
    const prev = Boolean(currentByPage.get(pageId) ?? false);
    if (prev !== next) {
      realChanges.push({ pageId, prev, next, page: pageById.get(pageId) });
    }
  }
  if (realChanges.length === 0) {
    return { saved: 0, audited: 0, projected: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const ch of realChanges) {
      const existing = await tx.rolePageAccess.findUnique({
        where: { roleId_pageId: { roleId, pageId: ch.pageId } },
        select: { id: true },
      });
      if (existing) {
        await tx.rolePageAccess.update({
          where: { id: existing.id },
          data: { canView: ch.next },
        });
      } else {
        await tx.rolePageAccess.create({
          data: { roleId, pageId: ch.pageId, canView: ch.next },
        });
      }
      await tx.permissionAuditLog.create({
        data: {
          roleId,
          changedBy: actorUserId || 'system',
          changeType: 'page_access_changed',
          entityType: 'RolePageAccess',
          entityId: ch.pageId,
          previousValue: { canView: ch.prev },
          newValue: {
            canView: ch.next,
            pageKey: ch.page.pageKey,
            pageName: ch.page.pageName,
            actorDisplayName: actorDisplayName || null,
          },
        },
      });
    }
  });

  // Re-project AFTER commit so RolePermission reflects the new tree.
  // Failure here is non-fatal — the source-of-truth is RolePageAccess;
  // projection is a denormalised cache.
  let projected = 0;
  try {
    const result = await projectRolePermissions(prisma, role.id);
    projected = result.projectedRoles ?? 0;
  } catch (err) {
    console.error('[pageAccess.save] projection failed (non-fatal):', err);
  }

  return { saved: realChanges.length, audited: realChanges.length, projected };
}
