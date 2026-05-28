// Access Control Center — phase 1 projection.
//
// Translates RolePageAccess + RoleActionPermission into legacy
// RolePermission rows so existing assertPermission(ctx, '<key>') checks
// keep working unchanged. Idempotent: re-runs replace the projected
// set in full for any role passed in.
//
// Key naming for projected permissions:
//   - Page view  → "page.<pageKey>.view"        (e.g. page.finance.payments.view)
//   - Action     → "page.<pageKey>.<actionKey>" (e.g. page.finance.payments.approve)
//
// The "page." prefix isolates ACC-projected keys from legacy keys
// (e.g. finance.entries.read), so we can scrub stale projections
// without touching pre-existing RolePermission entries.

import { invalidateCache } from '../auth/rbac.service.mjs';

const PROJECTED_PREFIX = 'page.';

function pageViewKey(pageKey) {
  return `${PROJECTED_PREFIX}${pageKey}.view`;
}

function pageActionKey(pageKey, actionKey) {
  return `${PROJECTED_PREFIX}${pageKey}.${actionKey}`;
}

function moduleFromPageKey(pageKey) {
  const idx = pageKey.indexOf('.');
  return idx >= 0 ? pageKey.slice(0, idx) : pageKey;
}

function resourceFromPageKey(pageKey) {
  const idx = pageKey.indexOf('.');
  return idx >= 0 ? pageKey.slice(idx + 1) : 'main';
}

// Ensure a Permission row exists for the key. Permissions are the
// authoritative catalogue; RolePermission references them by id.
//
// The Permission model has no `name` column — only key/module/resource/
// action/description. We encode the human label in `description` so the
// Advanced Matrix view in phase 4 still has a readable string.
async function ensurePermission(prisma, key, humanLabel, sourceTag) {
  const existing = await prisma.permission.findUnique({ where: { key } });
  const description = `${humanLabel} — ${sourceTag}`;
  if (existing) {
    if (existing.description !== description) {
      await prisma.permission.update({ where: { id: existing.id }, data: { description } });
    }
    return existing;
  }
  const stripped = key.slice(PROJECTED_PREFIX.length);
  const module = moduleFromPageKey(stripped);
  // resource = "<page>.<action>" or "<page>.view" — grouped by module
  // for the Advanced Matrix view, and keeps the @@unique([module,
  // resource, action]) constraint satisfied because each projected
  // key is unique on its own.
  const resource = resourceFromPageKey(stripped);
  return prisma.permission.create({
    data: {
      key,
      module,
      resource,
      action: 'access',
      description,
      isActive: true,
    },
  });
}

async function projectOne(prisma, role) {
  const [pageAccess, actionPermissions] = await Promise.all([
    prisma.rolePageAccess.findMany({
      where: { roleId: role.id, canView: true },
      include: { page: { select: { pageKey: true, pageName: true } } },
    }),
    prisma.roleActionPermission.findMany({
      where: { roleId: role.id, allowed: true },
      include: {
        page:   { select: { pageKey: true, pageName: true } },
        action: { select: { actionKey: true, actionName: true } },
      },
    }),
  ]);

  const wanted = new Set();

  for (const pa of pageAccess) {
    if (!pa.page?.pageKey) continue;
    const key = pageViewKey(pa.page.pageKey);
    await ensurePermission(prisma, key, `${pa.page.pageName} View`, 'RolePageAccess');
    wanted.add(key);
  }

  for (const ap of actionPermissions) {
    if (!ap.page?.pageKey || !ap.action?.actionKey) continue;
    const key = pageActionKey(ap.page.pageKey, ap.action.actionKey);
    await ensurePermission(
      prisma, key,
      `${ap.page.pageName} ${ap.action.actionName}`,
      'RoleActionPermission',
    );
    wanted.add(key);
  }

  // Reconcile RolePermission for this role's projected set. The
  // table's natural key is [roleId, permissionId, scopeType, scopeValue]
  // (composite, not a Prisma compound-id locator), so we can't use
  // upsert with `where: { roleId_permissionId: ... }`. findFirst +
  // create is the supported pattern.
  for (const key of wanted) {
    const perm = await prisma.permission.findUnique({ where: { key }, select: { id: true } });
    if (!perm) continue;
    const present = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: perm.id, scopeType: null, scopeValue: null },
      select: { id: true },
    });
    if (!present) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Remove stale projected RolePermission rows (only those with the
  // "page." prefix — legacy permissions are left untouched).
  const projectedExisting = await prisma.rolePermission.findMany({
    where: {
      roleId: role.id,
      permission: { key: { startsWith: PROJECTED_PREFIX } },
    },
    include: { permission: { select: { key: true, id: true } } },
  });
  for (const rp of projectedExisting) {
    if (!wanted.has(rp.permission.key)) {
      await prisma.rolePermission.delete({ where: { id: rp.id } });
    }
  }

  invalidateCache(role.id);
}

export async function projectRolePermissions(prisma, roleIdOrCodeOrNull = null) {
  let roles;
  if (!roleIdOrCodeOrNull) {
    roles = await prisma.role.findMany({
      where: { isDeleted: false, isActive: true },
      select: { id: true, code: true },
    });
  } else {
    const where = String(roleIdOrCodeOrNull).startsWith('cm')
      ? { id: roleIdOrCodeOrNull }
      : { code: roleIdOrCodeOrNull };
    const role = await prisma.role.findFirst({ where, select: { id: true, code: true } });
    roles = role ? [role] : [];
  }

  let projected = 0;
  for (const role of roles) {
    await projectOne(prisma, role);
    projected += 1;
  }
  // Global cache invalidation — covers users whose role membership
  // changed during projection.
  invalidateCache();
  return { projectedRoles: projected };
}

export const __ACC_PROJECTION_INTERNALS__ = {
  pageViewKey,
  pageActionKey,
  PROJECTED_PREFIX,
};
