// HRM-1.3 — Client wrappers around /api/v1/hrm/roles, /permissions,
// /users/:id/permissions, /users/:id/roles, /users/:id/overrides.

import { apiRequest } from '../lib/apiClient';

export interface RbacPermission {
  id: string;
  key: string;
  module: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RbacPermissionGroup {
  module: string;
  permissions: RbacPermission[];
}

export interface RbacRoleSummary {
  id: string;
  code: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { permissions: number; userRoles: number };
}

export interface RbacRoleDetail extends Omit<RbacRoleSummary, '_count'> {
  permissions: RbacPermission[];
}

export interface RbacUserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string | null;
  validFrom: string;
  validTo: string | null;
  role: { id: string; code: string; label: string; isSystem: boolean };
}

export interface RbacUserOverride {
  id: string;
  userId: string;
  module: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  reason: string | null;
  expiresAt: string | null;
  assignedBy: string | null;
  isActive: boolean;
  permission: { id: string; key: string; module: string; resource: string; action: string } | null;
}

export interface RbacUserAssignments {
  user: { id: string; name: string | null; email: string | null };
  roles: RbacUserRoleAssignment[];
  overrides: RbacUserOverride[];
}

function actorParam(actorUserId?: string | null) {
  return actorUserId ? `?actorUserId=${encodeURIComponent(actorUserId)}` : '';
}

export const rbacAdminApi = {
  listPermissions(): Promise<{ modules: RbacPermissionGroup[] }> {
    return apiRequest('/api/v1/hrm/permissions');
  },

  listRoles(): Promise<{ roles: RbacRoleSummary[] }> {
    return apiRequest('/api/v1/hrm/roles');
  },

  getRole(roleId: string): Promise<{ role: RbacRoleDetail }> {
    return apiRequest(`/api/v1/hrm/roles/${encodeURIComponent(roleId)}`);
  },

  createRole(payload: {
    code: string;
    label: string;
    description?: string;
    permissionIds: string[];
  }): Promise<{ role: RbacRoleDetail }> {
    return apiRequest('/api/v1/hrm/roles', { method: 'POST', body: payload });
  },

  updateRole(
    roleId: string,
    payload: { label?: string; description?: string | null; permissionIds?: string[] },
  ): Promise<{ role: RbacRoleDetail }> {
    return apiRequest(`/api/v1/hrm/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteRole(roleId: string): Promise<{ id: string; deleted: boolean }> {
    return apiRequest(`/api/v1/hrm/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
  },

  getUserAssignments(userId: string): Promise<RbacUserAssignments> {
    return apiRequest(`/api/v1/hrm/users/${encodeURIComponent(userId)}/permissions`);
  },

  assignRole(
    userId: string,
    roleId: string,
    actorUserId?: string | null,
  ): Promise<{ assignment: RbacUserRoleAssignment }> {
    return apiRequest(
      `/api/v1/hrm/users/${encodeURIComponent(userId)}/roles${actorParam(actorUserId)}`,
      { method: 'POST', body: { roleId, actorUserId: actorUserId ?? undefined } },
    );
  },

  revokeRole(userId: string, roleId: string): Promise<{ id: string; revoked: boolean }> {
    return apiRequest(
      `/api/v1/hrm/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'DELETE' },
    );
  },

  upsertOverride(
    userId: string,
    payload: {
      permissionId: string;
      effect: 'allow' | 'deny';
      reason?: string;
      expiresAt?: string | null;
    },
    actorUserId?: string | null,
  ): Promise<{ override: RbacUserOverride }> {
    return apiRequest(
      `/api/v1/hrm/users/${encodeURIComponent(userId)}/overrides${actorParam(actorUserId)}`,
      { method: 'POST', body: { ...payload, actorUserId: actorUserId ?? undefined } },
    );
  },

  removeOverride(userId: string, permissionId: string): Promise<{ id: string; removed: boolean }> {
    return apiRequest(
      `/api/v1/hrm/users/${encodeURIComponent(userId)}/overrides/${encodeURIComponent(permissionId)}`,
      { method: 'DELETE' },
    );
  },
};
