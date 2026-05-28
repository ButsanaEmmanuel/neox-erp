import { safeBroadcast } from '../realtime/sseBroadcaster.mjs';

// HRM-1.3 — CRUD service for RBAC administration UI.
//
// Used by backend/routes/hrm/rbac.routes.mjs. Every mutation calls
// invalidateCache() on rbac.service so the next /api/auth/me/permissions
// or hasPermission() call picks up the change.
//
// Rules enforced here (not in routes, so the rules can't be bypassed
// by a different transport):
//   - Soft-delete only: roles use isDeleted/deletedAt, UserRole uses
//     validTo = now() to revoke, UserPermissionSet uses isActive = false
//     (we never DELETE rows).
//   - System roles (isSystem = true) are read-only via this API: their
//     name/label/permissions cannot be edited and they cannot be deleted.
//     They CAN still be assigned to users.
//   - UserRole assignments respect the existing temporal pattern
//     @@unique([userId, roleId, validFrom]) — see HRM-1.1 notes.
//   - UserPermissionSet upserts target the (userId, module, resource,
//     action) unique constraint and ALSO link permissionId for the
//     post-HRM-1.1 resolution path.

import { invalidateCache } from '../auth/rbac.service.mjs';

// ============================================================
// Errors
// ============================================================

class HttpError extends Error {
  constructor(statusCode, code, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, extra);
  }
}

function badRequest(message, extra) {
  return new HttpError(400, 'BAD_REQUEST', message, extra);
}
function notFound(message) {
  return new HttpError(404, 'NOT_FOUND', message);
}
function conflict(message, extra) {
  return new HttpError(409, 'CONFLICT', message, extra);
}
function forbidden(message, extra) {
  return new HttpError(403, 'FORBIDDEN', message, extra);
}

// The UI picker reads from the HRM employees list, where each row's `id`
// is the HrmEmploymentProfile.id — NOT the User.id. RBAC tables (UserRole,
// UserPermissionSet) FK to User.id, so we have to resolve the canonical
// User row before any lookup or mutation. We accept either form: a real
// User.id or an HrmEmploymentProfile.id. Profiles are 1:1 with users
// (HrmEmploymentProfile.userId is @unique), so the mapping is exact.
async function resolveUserId(prisma, idOrProfileId) {
  const candidate = String(idOrProfileId || '').trim();
  if (!candidate) return null;
  const direct = await prisma.user.findFirst({
    where: { id: candidate, isDeleted: false },
    select: { id: true },
  });
  if (direct) return direct.id;
  const profile = await prisma.hrmEmploymentProfile.findUnique({
    where: { id: candidate },
    select: { userId: true },
  });
  return profile?.userId || null;
}

// ============================================================
// Catalog reads
// ============================================================

export async function listPermissions(prisma) {
  const perms = await prisma.permission.findMany({
    where: { isActive: true },
    orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    select: {
      id: true, key: true, module: true, resource: true, action: true, description: true,
    },
  });

  const byModule = new Map();
  for (const p of perms) {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module).push(p);
  }
  return Array.from(byModule.entries()).map(([module, permissions]) => ({ module, permissions }));
}

export async function listRoles(prisma) {
  const roles = await prisma.role.findMany({
    where: { isDeleted: false },
    orderBy: [{ isSystem: 'desc' }, { label: 'asc' }],
    select: {
      id: true, code: true, name: true, label: true, description: true,
      isSystem: true, isActive: true, createdAt: true, updatedAt: true,
      _count: { select: { permissions: true, userRoles: true } },
    },
  });
  return roles;
}

export async function getRole(prisma, roleId) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, key: true, module: true, resource: true, action: true, description: true },
          },
        },
      },
    },
  });
  if (!role) throw notFound('Role not found');
  return {
    ...role,
    permissions: role.permissions.map((rp) => rp.permission),
  };
}

// ============================================================
// Role mutations
// ============================================================

function validateRoleCode(code) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw badRequest('Role code is required', { field: 'code' });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(code)) {
    throw badRequest('Role code must be lowercase letters, digits and underscores, starting with a letter', { field: 'code' });
  }
}

export async function createRole(prisma, { code, label, description, permissionIds }) {
  validateRoleCode(code);
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw badRequest('Role label is required', { field: 'label' });
  }
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) {
    if (existing.isDeleted) {
      throw conflict('A soft-deleted role with this code already exists. Restore it instead.', {
        existingRoleId: existing.id,
      });
    }
    throw conflict('A role with this code already exists', { existingRoleId: existing.id });
  }

  const permIds = Array.isArray(permissionIds) ? permissionIds.filter((x) => typeof x === 'string') : [];

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        code,
        name: code,
        label: label.trim(),
        description: description?.trim() || null,
        isSystem: false,
        isActive: true,
      },
    });
    if (permIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  invalidateCache();
  return getRole(prisma, role.id);
}

export async function updateRole(prisma, roleId, { label, description, permissionIds }) {
  const role = await prisma.role.findFirst({ where: { id: roleId, isDeleted: false } });
  if (!role) throw notFound('Role not found');
  if (role.isSystem) throw forbidden('System roles cannot be modified', { roleCode: role.code });

  const data = {};
  if (label !== undefined) {
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw badRequest('Role label cannot be empty', { field: 'label' });
    }
    data.label = label.trim();
  }
  if (description !== undefined) {
    data.description = description === null ? null : String(description).trim() || null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.role.update({ where: { id: roleId }, data });
    }
    if (Array.isArray(permissionIds)) {
      const next = new Set(permissionIds.filter((x) => typeof x === 'string'));
      const current = await tx.rolePermission.findMany({
        where: { roleId, scopeType: null, scopeValue: null },
        select: { id: true, permissionId: true },
      });
      const currentSet = new Set(current.map((rp) => rp.permissionId));
      const toAdd = [...next].filter((pid) => !currentSet.has(pid));
      const toRemoveIds = current.filter((rp) => !next.has(rp.permissionId)).map((rp) => rp.id);

      if (toRemoveIds.length > 0) {
        await tx.rolePermission.deleteMany({ where: { id: { in: toRemoveIds } } });
      }
      if (toAdd.length > 0) {
        await tx.rolePermission.createMany({
          data: toAdd.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    }
  });

  invalidateCache();
  return getRole(prisma, roleId);
}

export async function deleteRole(prisma, roleId) {
  const role = await prisma.role.findFirst({ where: { id: roleId, isDeleted: false } });
  if (!role) throw notFound('Role not found');
  if (role.isSystem) throw forbidden('System roles cannot be deleted', { roleCode: role.code });

  const activeAssignments = await prisma.userRole.count({
    where: { roleId, validTo: null },
  });
  if (activeAssignments > 0) {
    throw conflict('Role still has active user assignments — revoke them first', {
      activeAssignments,
    });
  }

  await prisma.role.update({
    where: { id: roleId },
    data: { isDeleted: true, deletedAt: new Date(), isActive: false },
  });

  invalidateCache();
  return { id: roleId, deleted: true };
}

// ============================================================
// User assignments
// ============================================================

export async function listUserAssignments(prisma, userIdOrProfileId) {
  const userId = await resolveUserId(prisma, userIdOrProfileId);
  if (!userId) throw notFound('User not found');
  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!user) throw notFound('User not found');

  const now = new Date();
  const [roles, overrides] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      include: {
        role: { select: { id: true, code: true, label: true, isSystem: true } },
      },
      orderBy: { validFrom: 'desc' },
    }),
    prisma.userPermissionSet.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        permission: { select: { id: true, key: true, module: true, resource: true, action: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { user: { id: user.id, name: user.name, email: user.email }, roles, overrides };
}

export async function assignRoleToUser(prisma, userIdOrProfileId, roleId, { assignedBy } = {}) {
  const userId = await resolveUserId(prisma, userIdOrProfileId);
  if (!userId) throw notFound('User not found');
  const [user, role] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, isDeleted: false } }),
    prisma.role.findFirst({ where: { id: roleId, isDeleted: false } }),
  ]);
  if (!user) throw notFound('User not found');
  if (!role) throw notFound('Role not found');

  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, validTo: null },
  });
  if (existing) {
    throw conflict('User already has an active assignment for this role', {
      assignmentId: existing.id,
    });
  }

  const created = await prisma.userRole.create({
    data: {
      userId,
      roleId,
      assignedBy: assignedBy || null,
      validFrom: new Date(),
      validTo: null,
    },
    include: {
      role: { select: { id: true, code: true, label: true, isSystem: true } },
    },
  });

  invalidateCache(userId);
  safeBroadcast('hrm.role.assigned', {
    userId,
    roleId,
    roleCode: created.role?.code ?? null,
    assignedBy: assignedBy ?? null,
    assignmentId: created.id,
  });
  return created;
}

export async function revokeUserRole(prisma, userIdOrProfileId, roleId) {
  const userId = await resolveUserId(prisma, userIdOrProfileId);
  if (!userId) throw notFound('User not found');
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, validTo: null },
  });
  if (!existing) throw notFound('No active assignment to revoke');

  await prisma.userRole.update({
    where: { id: existing.id },
    data: { validTo: new Date() },
  });

  invalidateCache(userId);
  return { id: existing.id, revoked: true };
}

// ============================================================
// User overrides (UserPermissionSet)
// ============================================================

export async function upsertUserOverride(prisma, userIdOrProfileId, { permissionId, effect, reason, expiresAt, assignedBy }) {
  const userId = await resolveUserId(prisma, userIdOrProfileId);
  if (!userId) throw notFound('User not found');
  if (!permissionId || typeof permissionId !== 'string') {
    throw badRequest('permissionId is required', { field: 'permissionId' });
  }
  if (effect !== 'allow' && effect !== 'deny') {
    throw badRequest('effect must be "allow" or "deny"', { field: 'effect' });
  }
  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!user) throw notFound('User not found');
  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) throw notFound('Permission not found');

  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAtDate.getTime())) {
    throw badRequest('expiresAt must be a valid ISO date', { field: 'expiresAt' });
  }

  const upserted = await prisma.userPermissionSet.upsert({
    where: {
      userId_module_resource_action: {
        userId,
        module: permission.module,
        resource: permission.resource,
        action: permission.action,
      },
    },
    update: {
      effect,
      permissionId,
      reason: reason?.trim() || null,
      expiresAt: expiresAtDate,
      assignedBy: assignedBy || null,
      isActive: true,
    },
    create: {
      userId,
      module: permission.module,
      resource: permission.resource,
      action: permission.action,
      effect,
      permissionId,
      reason: reason?.trim() || null,
      expiresAt: expiresAtDate,
      assignedBy: assignedBy || null,
      isActive: true,
    },
    include: {
      permission: { select: { id: true, key: true, module: true, resource: true, action: true } },
    },
  });

  invalidateCache(userId);
  return upserted;
}

export async function removeUserOverride(prisma, userIdOrProfileId, permissionId) {
  const userId = await resolveUserId(prisma, userIdOrProfileId);
  if (!userId) throw notFound('User not found');
  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) throw notFound('Permission not found');

  const existing = await prisma.userPermissionSet.findFirst({
    where: {
      userId,
      module: permission.module,
      resource: permission.resource,
      action: permission.action,
      isActive: true,
    },
  });
  if (!existing) throw notFound('No active override to remove');

  await prisma.userPermissionSet.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  invalidateCache(userId);
  return { id: existing.id, removed: true };
}
