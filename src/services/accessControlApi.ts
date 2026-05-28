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

// Phase 3 — Module & Page Access tab.
export interface AccPageNode {
  id: string;
  pageKey: string;
  pageName: string;
  route: string | null;
  icon: string | null;
  parentPageId: string | null;
  sortOrder: number;
  isSidebarVisible: boolean;
  canView: boolean;
}

export interface AccModuleNode {
  id: string;
  moduleKey: string;
  moduleName: string;
  icon: string | null;
  sortOrder: number;
  pages: AccPageNode[];
}

export interface AccPageAccessTree {
  role: {
    id: string;
    code: string;
    label: string;
    isSystem: boolean;
    isActive: boolean;
    locked: boolean;
  };
  modules: AccModuleNode[];
}

export interface AccPageAccessChange {
  pageId: string;
  canView: boolean;
}

export interface AccPageAccessSaveResult {
  saved: number;
  audited: number;
  projected: number;
}

// Phase 4 — Action Permissions tab.
export interface AccActionDef {
  id: string;
  actionKey: string;
  actionName: string;
  description: string | null;
}

export interface AccActionStateOnPage {
  actionId: string;
  actionKey: string;
  actionName: string;
  allowed: boolean;
}

export interface AccActionPageNode {
  id: string;
  pageKey: string;
  pageName: string;
  route: string | null;
  icon: string | null;
  parentPageId: string | null;
  sortOrder: number;
  canView: boolean;
  actions: AccActionStateOnPage[];
}

export interface AccActionModuleNode {
  id: string;
  moduleKey: string;
  moduleName: string;
  icon: string | null;
  sortOrder: number;
  pages: AccActionPageNode[];
}

export interface AccActionPermissionsTree {
  role: {
    id: string;
    code: string;
    label: string;
    isSystem: boolean;
    isActive: boolean;
    locked: boolean;
  };
  actions: AccActionDef[];
  modules: AccActionModuleNode[];
}

export interface AccActionPermissionChange {
  pageId: string;
  actionId: string;
  allowed: boolean;
}

export interface AccActionPermissionsSaveResult {
  saved: number;
  audited: number;
  projected: number;
  skippedHidden: number;
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
  async getPageAccess(roleId: string, userId?: string): Promise<AccPageAccessTree> {
    return apiRequest<AccPageAccessTree>(
      `/api/v1/access-control/roles/${encodeURIComponent(roleId)}/page-access${actorQs(userId)}`,
    );
  },
  async savePageAccess(
    roleId: string,
    changes: AccPageAccessChange[],
    userId?: string,
    actorDisplayName?: string,
  ): Promise<AccPageAccessSaveResult> {
    return apiRequest<AccPageAccessSaveResult>(
      `/api/v1/access-control/roles/${encodeURIComponent(roleId)}/page-access${actorQs(userId)}`,
      {
        method: 'PATCH',
        body: { changes, actorDisplayName: actorDisplayName ?? null },
      },
    );
  },
  async getActionPermissions(roleId: string, userId?: string): Promise<AccActionPermissionsTree> {
    return apiRequest<AccActionPermissionsTree>(
      `/api/v1/access-control/roles/${encodeURIComponent(roleId)}/action-permissions${actorQs(userId)}`,
    );
  },
  async saveActionPermissions(
    roleId: string,
    changes: AccActionPermissionChange[],
    userId?: string,
    actorDisplayName?: string,
  ): Promise<AccActionPermissionsSaveResult> {
    return apiRequest<AccActionPermissionsSaveResult>(
      `/api/v1/access-control/roles/${encodeURIComponent(roleId)}/action-permissions${actorQs(userId)}`,
      {
        method: 'PATCH',
        body: { changes, actorDisplayName: actorDisplayName ?? null },
      },
    );
  },
};
