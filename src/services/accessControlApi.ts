// Access Control Center — phase 2 read-only client.
//
// Pairs with backend/routes/access/accessControl.routes.mjs. Nothing
// here mutates; phase 3 will add the assign/toggle calls.

import { apiRequest } from '../lib/apiClient';

export interface AccSummary {
  roles: number;
  systemRoles: number;
  modules: number;
  pages: number;
  actions: number;
  auditEvents: number;
  approvalWorkflows: number;
  crossModuleWorkflows: number;
}

export interface AccRoleCounts {
  members: number;
  pages: number;
  actions: number;
  dataScopes: number;
  fieldRestrictions: number;
  linkedRecords: number;
}

export interface AccRole {
  id: string;
  code: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  counts: AccRoleCounts;
}

export interface AccRoleScope {
  moduleKey: string;
  pageKey: string | null;
  scopeType: string;
}

export interface AccRoleDetail extends AccRole {
  scopes: AccRoleScope[];
}

function actorQs(userId?: string): string {
  return userId ? `?userId=${encodeURIComponent(userId)}` : '';
}

export const accessControlApi = {
  async getSummary(userId?: string): Promise<AccSummary> {
    const { summary } = await apiRequest<{ summary: AccSummary }>(
      `/api/v1/access-control/summary${actorQs(userId)}`,
    );
    return summary;
  },
  async listRoles(userId?: string): Promise<AccRole[]> {
    const { roles } = await apiRequest<{ roles: AccRole[] }>(
      `/api/v1/access-control/roles${actorQs(userId)}`,
    );
    return roles;
  },
  async getRole(roleId: string, userId?: string): Promise<AccRoleDetail> {
    const { role } = await apiRequest<{ role: AccRoleDetail }>(
      `/api/v1/access-control/roles/${encodeURIComponent(roleId)}${actorQs(userId)}`,
    );
    return role;
  },
};
