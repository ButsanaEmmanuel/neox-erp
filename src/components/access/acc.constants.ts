// Access Control Center — phase 2 constants.
//
// The left-side global section list and the per-role tab list. Pure data,
// no React, importable from any subcomponent.

export type AccSectionKey =
  | 'roles'
  | 'users'
  | 'page-access'
  | 'action-permissions'
  | 'data-scope'
  | 'approval-workflows'
  | 'cross-module-workflows'
  | 'field-level-security'
  | 'audit-log';

export interface AccSection {
  key: AccSectionKey;
  label: string;
  description: string;
  /** True when the section is the role-centred home (default landing). */
  isRoleCentred?: boolean;
}

export const ACC_SECTIONS: ReadonlyArray<AccSection> = [
  { key: 'roles',                  label: 'Roles',                  description: 'Browse roles, inspect their reach, manage members.', isRoleCentred: true },
  { key: 'users',                  label: 'Users',                  description: 'Search any user, view their role assignments.' },
  { key: 'page-access',            label: 'Page Access',            description: 'Which sidebar items each role can see.' },
  { key: 'action-permissions',     label: 'Action Permissions',     description: 'What each role can do on every page.' },
  { key: 'data-scope',             label: 'Data Scope',             description: 'Own / department / project / company perimeter per role.' },
  { key: 'approval-workflows',     label: 'Approval Workflows',     description: 'Configure who approves what at every threshold.' },
  { key: 'cross-module-workflows', label: 'Cross-Module Workflows', description: 'Purchase requests, expenses, payroll — visibility per role.' },
  { key: 'field-level-security',   label: 'Field-Level Security',   description: 'Hide sensitive columns from specific roles.' },
  { key: 'audit-log',              label: 'Audit Log',              description: 'Chronological history of every permission change.' },
];

export type AccRoleTabKey =
  | 'overview'
  | 'module-page-access'
  | 'actions'
  | 'data-scope'
  | 'cross-module-access'
  | 'approval-authority'
  | 'field-restrictions'
  | 'members'
  | 'audit-trail';

export interface AccRoleTab {
  key: AccRoleTabKey;
  label: string;
  /** One-sentence explanation rendered in the empty state for this tab. */
  preview: string;
}

export const ACC_ROLE_TABS: ReadonlyArray<AccRoleTab> = [
  { key: 'overview',            label: 'Overview',            preview: 'Role summary — module reach, approval authority, data scope, member count.' },
  { key: 'module-page-access',  label: 'Module & Page Access',preview: 'Tree of every sidebar item with a Visible/Hidden toggle per page.' },
  { key: 'actions',             label: 'Actions',             preview: 'Per-page list of business-readable actions: view, create, approve, settle payment, …' },
  { key: 'data-scope',          label: 'Data Scope',          preview: 'Per module/page perimeter: own, department, project, location, related, company, custom.' },
  { key: 'cross-module-access', label: 'Cross-Module Access', preview: 'Linked records visible across modules (Project Manager sees Finance payment status for own projects).' },
  { key: 'approval-authority',  label: 'Approval Authority',  preview: 'Workflows where the role is responsible at a given step.' },
  { key: 'field-restrictions',  label: 'Field Restrictions',  preview: 'Per-entity columns hidden from the role (salary, bank, internal notes, …).' },
  { key: 'members',             label: 'Members',             preview: 'Users currently assigned to this role.' },
  { key: 'audit-trail',         label: 'Audit Trail',         preview: 'Every change made to this role, chronologically.' },
];
