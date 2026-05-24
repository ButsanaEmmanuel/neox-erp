// Frontend RBAC, DB-driven via GET /api/auth/me/permissions.
//
// Public API:
//   PERMISSION_KEYS       readonly string[] — single source of truth for
//                         the 97 catalogue keys (keep in sync with
//                         prisma/seed/rbac.seed.mjs).
//   PermissionKey         union type derived from PERMISSION_KEYS.
//   usePermissions()      React hook → { permissions, has, isReady }.
//   hasPermission(perms, key)  pure helper (Set-based O(1) lookup).
//
// D6 closure (Sprint Dettes Techniques 2026-05-24): the legacy can() /
// canAccess() shim and its hardcoded role/authority/department tables
// (MODULE_OWNER_DEPARTMENTS, OWNER_PERMISSIONS, TIERS_PERMISSIONS,
// TIERS_RESOURCE_ALLOWLIST, ModuleName, Action, Resource) have been
// removed. All runtime permission resolution now goes through the DB
// catalogue, the backend `/api/auth/me/permissions` endpoint, and the
// `usePermissions()` hook above.

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  'hrm.departments.delete',
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

