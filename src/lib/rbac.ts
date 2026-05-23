// HRM-1.2 — Frontend RBAC, DB-driven via GET /api/auth/me/permissions.
//
// Public API (new):
//   PERMISSION_KEYS       readonly string[] — single source of truth for
//                         the 97 catalogue keys (keep in sync with
//                         prisma/seed/rbac.seed.mjs).
//   PermissionKey         union type derived from PERMISSION_KEYS.
//   usePermissions()      React hook → { permissions, has, isReady }.
//   hasPermission(perms, key)  pure helper (Set-based O(1) lookup).
//
// Legacy API (deprecated, kept for HRM-1.3 migration):
//   can(employee, action, resource), canAccess(employee, resource)
//   ModuleName, Action, Resource
//   These are NOT used by the new permission resolution — they still
//   contain the historical role/authority-level mappings until each
//   page is migrated to <PermissionGuard> or usePermissions().
//
// D6 closure note: the runtime permission resolution no longer relies
// on hardcoded role strings — it comes from the backend
// /api/auth/me/permissions endpoint, which reads UserRole +
// RolePermission + UserPermissionSet. The hardcoded strings inside
// can()/canAccess() are confined to the deprecated shim and will be
// removed page-by-page in HRM-1.3.

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EmploymentProfile, AuthorityLevel, HRMRole } from '../types/hrm';

// ============================================================
// Catalogue of permission keys — keep in sync with the backend
// prisma/seed/rbac.seed.mjs catalogue. Each entry must exactly
// match a Permission.key in the DB.
// ============================================================

export const PERMISSION_KEYS = [
  // --- HRM ---
  'hrm.directory.read',
  'hrm.directory.write',
  'hrm.directory.delete',
  'hrm.employees.read',
  'hrm.employees.write',
  'hrm.employees.delete',
  'hrm.departments.read',
  'hrm.departments.write',
  'hrm.contractors.read',
  'hrm.contractors.write',
  'hrm.leave.read',
  'hrm.leave.write',
  'hrm.leave.execute',
  'hrm.leave.admin',
  'hrm.timesheets.read',
  'hrm.timesheets.write',
  'hrm.timesheets.execute',
  'hrm.recruitment.read',
  'hrm.recruitment.write',
  'hrm.recruitment.execute',
  'hrm.onboarding.read',
  'hrm.onboarding.write',
  'hrm.onboarding.execute',
  'hrm.offboarding.read',
  'hrm.offboarding.write',
  'hrm.offboarding.execute',
  'hrm.training.read',
  'hrm.training.write',
  'hrm.training.execute',
  'hrm.policies.read',
  'hrm.policies.write',
  'hrm.policies.execute',
  'hrm.cases.read',
  'hrm.cases.write',
  'hrm.cases.execute',
  'hrm.payroll.read',
  'hrm.payroll.write',
  'hrm.payroll.execute',
  'hrm.configuration.read',
  'hrm.configuration.write',

  // --- PM ---
  'pm.projects.read',
  'pm.projects.write',
  'pm.projects.delete',
  'pm.projects.execute',
  'pm.workItems.read',
  'pm.workItems.write',
  'pm.workItems.delete',
  'pm.workItems.execute',
  'pm.milestones.read',
  'pm.milestones.write',
  'pm.milestones.execute',
  'pm.documents.read',
  'pm.documents.write',
  'pm.documents.delete',
  'pm.scope.read',
  'pm.scope.write',
  'pm.import.execute',
  'pm.finance.read',
  'pm.finance.execute',

  // --- Finance ---
  'finance.ledger.read',
  'finance.ledger.write',
  'finance.ledger.execute',
  'finance.payroll.read',
  'finance.payroll.execute',
  'finance.expenses.read',
  'finance.expenses.write',
  'finance.expenses.execute',
  'finance.advances.read',
  'finance.advances.write',
  'finance.advances.execute',
  'finance.reports.read',
  'finance.reports.execute',

  // --- SCM ---
  'scm.suppliers.read',
  'scm.suppliers.write',
  'scm.suppliers.delete',
  'scm.purchaseOrders.read',
  'scm.purchaseOrders.write',
  'scm.purchaseOrders.execute',
  'scm.inventory.read',
  'scm.inventory.write',
  'scm.contracts.read',
  'scm.contracts.write',
  'scm.contracts.execute',

  // --- HSE ---
  'hse.incidents.read',
  'hse.incidents.write',
  'hse.incidents.execute',
  'hse.inspections.read',
  'hse.inspections.write',
  'hse.inspections.execute',
  'hse.reports.read',
  'hse.reports.execute',

  // --- Système ---
  'system.rbac.read',
  'system.rbac.write',
  'system.rbac.execute',
  'system.audit.read',
  'system.settings.read',
  'system.settings.write',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

// ============================================================
// New API — DB-driven permission resolution
// ============================================================

/**
 * Pure permission lookup against a snapshot of permission keys.
 * Accepts either a Set<string> (preferred — O(1) lookup) or string[]
 * (will be wrapped in a Set for the duration of the call).
 *
 * The PermissionKey type guard guarantees compile-time correctness
 * against the catalogue. Passing an arbitrary string is allowed at
 * runtime but rejected by TypeScript.
 */
export function hasPermission(
  permissions: Set<string> | readonly string[] | string[] | null | undefined,
  key: PermissionKey,
): boolean {
  if (!permissions) return false;
  if (permissions instanceof Set) return permissions.has(key);
  return new Set(permissions).has(key);
}

/**
 * React hook reading the current user's effective permissions from
 * AuthContext. The returned `has` function uses an internal Set memo
 * so repeated calls within the same render are O(1).
 *
 * `isReady` is true once the user is known (logged in OR explicitly
 * anonymous). It does NOT block on the API call — by HRM-1.2 contract,
 * a missing permission set degrades to an empty list, never to a crash
 * or a loading spinner that blocks the UI.
 */
export function usePermissions() {
  const { user, permissions, refreshPermissions } = useAuth();
  const permissionSet = useMemo(() => new Set(permissions ?? []), [permissions]);
  return {
    permissions,
    permissionSet,
    has: (key: PermissionKey) => permissionSet.has(key),
    isReady: user !== null,
    refresh: refreshPermissions,
  };
}

// ============================================================
// Legacy API — kept for backward compat with pages not yet migrated.
// Remove in HRM-1.3 once every consumer uses <PermissionGuard> or
// usePermissions() directly.
// ============================================================

export type ModuleName = 'hrm' | 'crm' | 'scm' | 'project' | 'finance';

export type Action =
    | 'view' | 'create' | 'edit' | 'delete'
    | 'approve' | 'submit' | 'acknowledge'
    | 'manage_templates' | 'manage_settings'
    | 'approve_transaction' | 'qa_verify' | 'approve_milestone'
    | 'view_costs' | 'manage_costs'
    | 'all';

export type Resource =
    | 'directory' | 'own_profile'
    | 'onboarding' | 'offboarding'
    | 'recruitment' | 'candidates'
    | 'timesheets' | 'team_timesheets'
    | 'leave' | 'team_leave'
    | 'training' | 'policies' | 'cases'
    | 'all';

// NOTE: hardcoded mappings below are confined to this deprecated shim.
// The runtime permission resolution no longer goes through them — it
// reads from the DB-seeded catalogue via /api/auth/me/permissions.
// These mappings stay only so that pages calling can(role, action, resource)
// keep functioning identically until they are migrated in HRM-1.3.

const MODULE_OWNER_DEPARTMENTS: Record<string, string> = {
    hrm: 'dept-hr',
    project: 'dept-eng',
    crm: 'dept-sales',
    scm: 'dept-ops',
    finance: 'dept-finance',
};

const OWNER_PERMISSIONS: Record<AuthorityLevel, Action[]> = {
    ADMIN: ['all'],
    MANAGER: ['view', 'create', 'edit', 'approve', 'submit', 'manage_templates', 'qa_verify', 'approve_milestone', 'view_costs', 'manage_costs'],
    CONTRIBUTOR: ['view', 'create', 'edit', 'submit', 'acknowledge'],
    OBSERVER: ['view'],
};

const TIERS_PERMISSIONS: Record<string, Action[]> = {
    hrm: ['view', 'create', 'submit'],
    scm: ['view', 'create', 'submit'],
    project: ['view'],
    crm: [],
    finance: [],
};

const TIERS_RESOURCE_ALLOWLIST: Record<string, string[]> = {
    hrm: ['own_profile', 'timesheets', 'leave', 'training', 'policies'],
    scm: ['all'],
    project: ['all'],
    crm: [],
    finance: [],
};

/** @deprecated Use usePermissions().has(key) or <PermissionGuard /> instead. Removed in HRM-1.3. */
export function can(
    employee: EmploymentProfile | HRMRole | undefined,
    action: Action,
    resource: Resource | ModuleName,
): boolean {
    if (typeof employee === 'string') {
        const roleMap: Record<HRMRole, EmploymentProfile> = {
            hr: {
                id: 'role-hr',
                personId: 'role-hr',
                employeeCode: 'ROLE-HR',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'HR',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'MANAGER',
                departmentId: MODULE_OWNER_DEPARTMENTS.hrm,
            },
            manager: {
                id: 'role-manager',
                personId: 'role-manager',
                employeeCode: 'ROLE-MANAGER',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'Manager',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'MANAGER',
                departmentId: MODULE_OWNER_DEPARTMENTS.project,
            },
            staff: {
                id: 'role-staff',
                personId: 'role-staff',
                employeeCode: 'ROLE-STAFF',
                employmentType: 'employee',
                status: 'active',
                roleTitle: 'Staff',
                startDate: new Date().toISOString().slice(0, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasSystemAccess: true,
                authorityLevel: 'CONTRIBUTOR',
                departmentId: MODULE_OWNER_DEPARTMENTS.hrm,
            },
        };
        employee = roleMap[employee];
    }

    if (!employee || !employee.hasSystemAccess) return false;

    const level = employee.authorityLevel || 'OBSERVER';
    const deptId = employee.departmentId;

    if (level === 'ADMIN') return true;

    const resourceKey = String(resource);
    const parentModule = getParentModule(resourceKey);
    const isOwner = deptId === MODULE_OWNER_DEPARTMENTS[parentModule];

    const isCostRelated = action === 'view_costs' || action === 'manage_costs' || parentModule === 'finance';
    if (isCostRelated && !isOwner) return false;

    if (isOwner) {
        const allowed = OWNER_PERMISSIONS[level];
        if (allowed.includes('all')) return true;
        return allowed.includes(action);
    }

    const serviceActions = TIERS_PERMISSIONS[parentModule] || [];
    const allowlist = TIERS_RESOURCE_ALLOWLIST[parentModule] || [];
    if (resourceKey !== parentModule && !allowlist.includes('all') && !allowlist.includes(resourceKey)) {
        return false;
    }

    if (action === 'approve' || action === 'edit' || action === 'delete') {
        return false;
    }

    return serviceActions.includes(action);
}

function getParentModule(resource: string): string {
    const mapping: Record<string, string> = {
        directory: 'hrm',
        own_profile: 'hrm',
        onboarding: 'hrm',
        offboarding: 'hrm',
        recruitment: 'hrm',
        candidates: 'hrm',
        timesheets: 'hrm',
        team_timesheets: 'hrm',
        leave: 'hrm',
        team_leave: 'hrm',
        training: 'hrm',
        policies: 'hrm',
        cases: 'hrm',
    };
    return mapping[resource] || resource;
}

/** @deprecated Use usePermissions().has(key) or <PermissionGuard /> instead. Removed in HRM-1.3. */
export function canAccess(employee: EmploymentProfile | HRMRole | undefined, resource: Resource | ModuleName): boolean {
    return can(employee, 'view', resource);
}
