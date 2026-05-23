// HRM-1.2 — Resolution of effective RBAC permissions for a user.
//
// API:
//   getUserPermissions(userId)  -> Promise<Set<string>>
//   hasPermission(userId, key)  -> Promise<boolean>
//   invalidateCache(userId?)    -> void   (omit userId to clear all)
//   getCacheStats()             -> { size }  (debug only)
//
// Resolution rules (matches docs/NEOX_HRM_PLAN.md §HRM-1.2):
//   1. Load every UserRole where validTo IS NULL or validTo > now,
//      restricted to active, non-deleted roles.
//   2. Collect every Permission.key from those roles' RolePermission links
//      (only Permission.isActive = true).
//   3. Apply UserPermissionSet overrides where isActive = true and
//      (expiresAt IS NULL or expiresAt > now):
//        effect 'allow' -> add the key
//        effect 'deny'  -> remove the key (even if granted by a role)
//      Override key is resolved via the new Permission FK (permissionId)
//      when present, with a fallback to the legacy triplet
//      (module, resource, action) so pre-HRM-1.1 rows still work.
//
// Cache: in-process Map keyed by userId, TTL 5 minutes. Multi-process
// deployments will need a shared cache later (DH7? — out of scope here).
// Call invalidateCache(userId) after assigning/revoking a role or
// changing an override so the next read picks up the change.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CACHE_TTL_MS = 5 * 60 * 1000;
/** @type {Map<string, { permissions: Set<string>, expiresAt: number }>} */
const cache = new Map();

export async function getUserPermissions(userId) {
  if (!userId) return new Set();
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  const permissions = await resolveUserPermissions(userId);
  cache.set(userId, { permissions, expiresAt: now + CACHE_TTL_MS });
  return permissions;
}

export async function hasPermission(userId, key) {
  if (!userId || !key) return false;
  const perms = await getUserPermissions(userId);
  return perms.has(key);
}

export function invalidateCache(userId) {
  if (userId === undefined || userId === null) {
    cache.clear();
    return;
  }
  cache.delete(userId);
}

export function getCacheStats() {
  return { size: cache.size };
}

async function resolveUserPermissions(userId) {
  const now = new Date();

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ validTo: null }, { validTo: { gt: now } }],
      role: { isDeleted: false, isActive: true },
    },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const granted = new Set();
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission && rp.permission.isActive) {
        granted.add(rp.permission.key);
      }
    }
  }

  const overrides = await prisma.userPermissionSet.findMany({
    where: {
      userId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { permission: true },
  });

  for (const o of overrides) {
    const key =
      o.permission?.key
      ?? (o.module && o.resource && o.action ? `${o.module}.${o.resource}.${o.action}` : null);
    if (!key) continue;
    if (o.effect === 'allow') granted.add(key);
    else if (o.effect === 'deny') granted.delete(key);
  }

  return granted;
}
