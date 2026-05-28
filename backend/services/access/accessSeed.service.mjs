// Access Control Center — phase 1 seeds.
//
// Boots a baseline for the new business-layer tables so the ACC UI
// has something to render when phase 2 lands. Idempotent: every entity
// is upserted by stable natural key (moduleKey / pageKey / actionKey /
// role code). Re-running is safe and self-healing.
//
// All seeded artefacts are marked as system defaults where the schema
// supports it (Role.isSystem = true). The ACC UI must guard against
// deletion of system rows in phase 2.

const DEFAULT_ROLES = [
  { code: 'super_admin',         name: 'Super Admin',          label: 'Super Admin' },
  { code: 'ceo',                 name: 'CEO',                  label: 'CEO' },
  { code: 'deputy_ceo',          name: 'Deputy CEO',           label: 'Deputy CEO' },
  { code: 'finance_manager',     name: 'Finance Manager',      label: 'Finance Manager' },
  { code: 'accountant',          name: 'Accountant',           label: 'Accountant' },
  { code: 'scm_manager',         name: 'SCM Manager',          label: 'SCM Manager' },
  { code: 'procurement_officer', name: 'Procurement Officer',  label: 'Procurement Officer' },
  { code: 'project_manager',     name: 'Project Manager',      label: 'Project Manager' },
  { code: 'hr_manager',          name: 'HR Manager',           label: 'HR Manager' },
  { code: 'hr_officer',          name: 'HR Officer',           label: 'HR Officer' },
  { code: 'hse_manager',         name: 'HSE Manager',          label: 'HSE Manager' },
  { code: 'hse_officer',         name: 'HSE Officer',          label: 'HSE Officer' },
  { code: 'crm_manager',         name: 'CRM Manager',          label: 'CRM Manager' },
  { code: 'sales_officer',       name: 'Sales Officer',        label: 'Sales Officer' },
  { code: 'department_manager',  name: 'Department Manager',   label: 'Department Manager' },
  { code: 'employee',            name: 'Employee',             label: 'Employee' },
  { code: 'auditor',             name: 'Auditor (Read-Only)',  label: 'Auditor' },
];

// Module + page registry. Mirrors src/config/sidebar.config.json and
// the user-provided page-key list. Stable keys, never renamed.
const MODULE_REGISTRY = [
  { key: 'dashboard', name: 'Dashboard', sortOrder: 10, icon: 'LayoutDashboard',
    pages: [
      { key: 'dashboard.main', name: 'Dashboard', route: '/dashboard' },
    ],
  },
  { key: 'crm', name: 'CRM', sortOrder: 20, icon: 'Target',
    pages: [
      { key: 'crm.overview',     name: 'Overview',     route: '/crm' },
      { key: 'crm.contacts',     name: 'Contacts',     route: '/crm/contacts' },
      { key: 'crm.companies',    name: 'Companies',    route: '/crm/companies' },
      { key: 'crm.deals',        name: 'Deals',        route: '/crm/deals' },
      { key: 'crm.activities',   name: 'Activities',   route: '/crm/activities' },
      { key: 'crm.clients',      name: 'Clients',      route: '/crm/clients' },
      { key: 'crm.opportunities',name: 'Opportunities',route: '/crm/opportunities' },
    ],
  },
  { key: 'finance', name: 'Finance', sortOrder: 30, icon: 'BarChart3',
    pages: [
      { key: 'finance.overview', name: 'Overview',    route: '/finance' },
      { key: 'finance.expenses', name: 'Expenses',    route: '/finance/expenses' },
      { key: 'finance.invoices', name: 'Invoices',    route: '/finance/invoices' },
      { key: 'finance.payments', name: 'Payments',    route: '/finance/payments' },
      { key: 'finance.receipts', name: 'Receipts',    route: '/finance/receipts' },
      { key: 'finance.payroll',  name: 'Payroll',     route: '/finance/payroll' },
      { key: 'finance.ledger',   name: 'Ledger',      route: '/finance/ledger' },
      { key: 'finance.budgets',  name: 'Budgets',     route: '/finance/budgets' },
      { key: 'finance.reports',  name: 'Reports',     route: '/finance/reports' },
    ],
  },
  { key: 'scm', name: 'SCM', sortOrder: 40, icon: 'Truck',
    pages: [
      { key: 'scm.overview',         name: 'Overview',          route: '/scm' },
      { key: 'scm.suppliers',        name: 'Suppliers',         route: '/scm/suppliers' },
      { key: 'scm.products',         name: 'Products',          route: '/scm/products' },
      { key: 'scm.purchase_requests',name: 'Purchase Requests', route: '/scm/purchase-requests' },
      { key: 'scm.purchase_orders',  name: 'Purchase Orders',   route: '/scm/purchase-orders' },
      { key: 'scm.inventory',        name: 'Inventory',         route: '/scm/inventory' },
      { key: 'scm.deliveries',       name: 'Deliveries',        route: '/scm/deliveries' },
    ],
  },
  { key: 'projects', name: 'Projects', sortOrder: 50, icon: 'FileText',
    pages: [
      { key: 'projects.overview',  name: 'Overview',   route: '/projects' },
      { key: 'projects.list',      name: 'Projects',   route: '/projects/list' },
      { key: 'projects.tasks',     name: 'Tasks',      route: '/projects/tasks' },
      { key: 'projects.milestones',name: 'Milestones', route: '/projects/milestones' },
      { key: 'projects.budgets',   name: 'Budgets',    route: '/projects/budgets' },
      { key: 'projects.reports',   name: 'Reports',    route: '/projects/reports' },
      { key: 'projects.documents', name: 'Documents',  route: '/projects/documents' },
    ],
  },
  { key: 'hrm', name: 'HRM', sortOrder: 60, icon: 'Users',
    pages: [
      { key: 'hrm.overview',     name: 'Overview',     route: '/hrm' },
      { key: 'hrm.directory',    name: 'Directory',    route: '/hrm/directory' },
      { key: 'hrm.onboarding',   name: 'Onboarding',   route: '/hrm/onboarding' },
      { key: 'hrm.offboarding',  name: 'Offboarding',  route: '/hrm/offboarding' },
      { key: 'hrm.recruitment',  name: 'Recruitment',  route: '/hrm/recruitment' },
      { key: 'hrm.timesheets',   name: 'Timesheets',   route: '/hrm/timesheets' },
      { key: 'hrm.leave',        name: 'Leave',        route: '/hrm/leave' },
      { key: 'hrm.training',     name: 'Training',     route: '/hrm/training' },
      { key: 'hrm.policies',     name: 'Policies',     route: '/hrm/policies' },
      { key: 'hrm.cases',        name: 'Cases',        route: '/hrm/cases' },
      { key: 'hrm.configuration',name: 'Configuration',route: '/hrm/configuration' },
    ],
  },
  { key: 'hse', name: 'HSE', sortOrder: 70, icon: 'ShieldCheck',
    pages: [
      { key: 'hse.overview',          name: 'Overview',          route: '/hse' },
      { key: 'hse.incidents',         name: 'Incidents',         route: '/hse/incidents' },
      { key: 'hse.inspections',       name: 'Inspections',       route: '/hse/inspections' },
      { key: 'hse.risk_assessments',  name: 'Risk Assessments',  route: '/hse/risk-assessments' },
      { key: 'hse.corrective_actions',name: 'Corrective Actions',route: '/hse/corrective-actions' },
      { key: 'hse.training',          name: 'Training',          route: '/hse/training' },
      { key: 'hse.compliance',        name: 'Compliance',        route: '/hse/compliance' },
      { key: 'hse.reports',           name: 'Reports',           route: '/hse/reports' },
    ],
  },
  { key: 'reports', name: 'Reports', sortOrder: 80, icon: 'BarChart',
    pages: [
      { key: 'reports.main',     name: 'Global Reports',  route: '/reports' },
      { key: 'reports.finance',  name: 'Finance Reports', route: '/reports/finance' },
      { key: 'reports.hrm',      name: 'HRM Reports',     route: '/reports/hrm' },
      { key: 'reports.scm',      name: 'SCM Reports',     route: '/reports/scm' },
      { key: 'reports.projects', name: 'Project Reports', route: '/reports/projects' },
      { key: 'reports.hse',      name: 'HSE Reports',     route: '/reports/hse' },
      { key: 'reports.crm',      name: 'CRM Reports',     route: '/reports/crm' },
    ],
  },
  { key: 'settings', name: 'Settings', sortOrder: 90, icon: 'Settings',
    pages: [
      { key: 'settings.main',                   name: 'Company Settings',     route: '/settings' },
      { key: 'settings.users',                  name: 'Users',                route: '/settings/users' },
      { key: 'settings.roles',                  name: 'Roles',                route: '/settings/roles' },
      { key: 'settings.access_control_center',  name: 'Access Control Center',route: '/settings/access-control-center' },
      { key: 'settings.system_configuration',   name: 'System Configuration', route: '/settings/system' },
    ],
  },
];

// Business-readable action verbs. Stay small and stable; phase 2 will
// surface them in the Actions tab grouped per page.
const ACTION_REGISTRY = [
  { key: 'view',                 name: 'View',                 description: 'Read records visible to the role' },
  { key: 'create',               name: 'Create',               description: 'Create a new record' },
  { key: 'edit',                 name: 'Edit',                 description: 'Modify existing records' },
  { key: 'delete',               name: 'Delete',               description: 'Soft-delete or archive records' },
  { key: 'submit',               name: 'Submit',               description: 'Submit a draft into an approval flow' },
  { key: 'approve',              name: 'Approve',              description: 'Approve a submitted record' },
  { key: 'reject',               name: 'Reject',               description: 'Reject a submitted record' },
  { key: 'upload',               name: 'Upload',               description: 'Attach evidence or documents' },
  { key: 'export',               name: 'Export',               description: 'Export to CSV/Excel/PDF' },
  { key: 'archive',              name: 'Archive',              description: 'Move records to archive' },
  { key: 'assign',               name: 'Assign',               description: 'Assign records to users' },
  { key: 'manage',               name: 'Manage',               description: 'Administer settings within the page' },
  { key: 'settle_payment',       name: 'Settle Payment',       description: 'Mark a finance entry as settled' },
  { key: 'validate',             name: 'Validate',             description: 'Confirm a record before downstream steps' },
  { key: 'request_clarification',name: 'Request Clarification',description: 'Send the record back for more info' },
];

// Default data scopes per role. Conservative — Phase 2 will let admins
// refine. scopeType ∈ own | department | project | location | related |
// company | custom.
const DEFAULT_SCOPES = [
  { roleCode: 'super_admin',         moduleKey: '*',        scopeType: 'company' },
  { roleCode: 'ceo',                 moduleKey: '*',        scopeType: 'company' },
  { roleCode: 'deputy_ceo',          moduleKey: '*',        scopeType: 'company' },
  { roleCode: 'auditor',             moduleKey: '*',        scopeType: 'company' },
  { roleCode: 'finance_manager',     moduleKey: 'finance',  scopeType: 'company' },
  { roleCode: 'finance_manager',     moduleKey: 'projects', scopeType: 'related' },
  { roleCode: 'accountant',          moduleKey: 'finance',  scopeType: 'company' },
  { roleCode: 'scm_manager',         moduleKey: 'scm',      scopeType: 'company' },
  { roleCode: 'scm_manager',         moduleKey: 'projects', scopeType: 'related' },
  { roleCode: 'procurement_officer', moduleKey: 'scm',      scopeType: 'company' },
  { roleCode: 'project_manager',     moduleKey: 'projects', scopeType: 'project' },
  { roleCode: 'project_manager',     moduleKey: 'finance',  scopeType: 'related' },
  { roleCode: 'project_manager',     moduleKey: 'scm',      scopeType: 'related' },
  { roleCode: 'hr_manager',          moduleKey: 'hrm',      scopeType: 'company' },
  { roleCode: 'hr_officer',          moduleKey: 'hrm',      scopeType: 'company' },
  { roleCode: 'hse_manager',         moduleKey: 'hse',      scopeType: 'company' },
  { roleCode: 'hse_officer',         moduleKey: 'hse',      scopeType: 'company' },
  { roleCode: 'crm_manager',         moduleKey: 'crm',      scopeType: 'company' },
  { roleCode: 'sales_officer',       moduleKey: 'crm',      scopeType: 'own' },
  { roleCode: 'department_manager',  moduleKey: 'hrm',      scopeType: 'department' },
  { roleCode: 'department_manager',  moduleKey: 'projects', scopeType: 'department' },
  { roleCode: 'employee',            moduleKey: 'hrm',      scopeType: 'own' },
];

// Default field-level restrictions. Phase 2 will surface these in the
// Field Restrictions tab. Restricted = canView=false unless caller
// holds an explicit allow. dot-paths supported for JSON fields.
const DEFAULT_FIELD_RESTRICTIONS = [
  // Salary data — visible only to finance/hr managers + super_admin.
  { entity: 'HrmEmploymentProfile', field: 'compensation.amount',        sensitiveFor: ['employee', 'sales_officer', 'procurement_officer', 'hr_officer', 'crm_manager', 'scm_manager', 'project_manager', 'department_manager', 'accountant', 'hse_officer', 'hse_manager'] },
  { entity: 'HrmEmploymentProfile', field: 'compensation.currency',      sensitiveFor: ['employee'] },
  { entity: 'PayrollRunEmployee',   field: 'netAmount',                  sensitiveFor: ['employee', 'project_manager', 'department_manager', 'scm_manager', 'procurement_officer', 'hse_officer', 'crm_manager', 'sales_officer'] },
  // Bank details — finance + super_admin only.
  { entity: 'User',                 field: 'metadata.bankDetails.accountNumber', sensitiveFor: ['employee', 'sales_officer', 'procurement_officer', 'hr_officer', 'hr_manager', 'crm_manager', 'scm_manager', 'project_manager', 'department_manager', 'hse_officer', 'hse_manager', 'auditor'] },
  { entity: 'ClientAccount',        field: 'metadata.bankDetails.accountNumber', sensitiveFor: ['employee', 'sales_officer', 'project_manager', 'hr_officer', 'hr_manager', 'crm_manager', 'scm_manager', 'procurement_officer', 'department_manager', 'hse_officer', 'hse_manager'] },
  // Ledger account — accounting + finance manager + super_admin.
  { entity: 'FinanceEntry',         field: 'accountCode',                sensitiveFor: ['employee', 'project_manager', 'sales_officer', 'hse_officer', 'hse_manager', 'department_manager', 'hr_officer', 'hr_manager', 'crm_manager', 'scm_manager', 'procurement_officer'] },
  // Internal finance notes.
  { entity: 'FinanceEntry',         field: 'metadata.finance.internalNote', sensitiveFor: ['employee', 'project_manager', 'sales_officer', 'hse_officer', 'hse_manager', 'department_manager', 'hr_officer', 'hr_manager', 'crm_manager', 'scm_manager', 'procurement_officer'] },
  // Internal margin.
  { entity: 'CrmDeal',              field: 'metadata.finance.internalMargin', sensitiveFor: ['employee', 'project_manager', 'sales_officer', 'hr_officer', 'hr_manager', 'scm_manager', 'procurement_officer', 'department_manager', 'hse_officer', 'hse_manager'] },
  // Disciplinary case content.
  { entity: 'HrmCase',              field: 'metadata.hr.disciplinaryDetails', sensitiveFor: ['employee', 'project_manager', 'sales_officer', 'scm_manager', 'procurement_officer', 'crm_manager', 'finance_manager', 'accountant', 'hse_officer', 'hse_manager'] },
  // Confidential payment references.
  { entity: 'PaymentDisbursement',  field: 'metadata.payment.proofReference', sensitiveFor: ['employee', 'project_manager', 'sales_officer', 'hr_officer', 'crm_manager', 'scm_manager', 'procurement_officer', 'department_manager', 'hse_officer', 'hse_manager'] },
];

function nowIso() { return new Date(); }

async function upsertModules(prisma) {
  for (const m of MODULE_REGISTRY) {
    const existing = await prisma.appModule.findUnique({ where: { moduleKey: m.key } });
    if (existing) {
      await prisma.appModule.update({
        where: { id: existing.id },
        data: { moduleName: m.name, sortOrder: m.sortOrder, icon: m.icon },
      });
    } else {
      await prisma.appModule.create({
        data: { moduleKey: m.key, moduleName: m.name, sortOrder: m.sortOrder, icon: m.icon, updatedAt: nowIso() },
      });
    }
  }
}

async function upsertPages(prisma) {
  for (const m of MODULE_REGISTRY) {
    const moduleRow = await prisma.appModule.findUnique({ where: { moduleKey: m.key } });
    if (!moduleRow) continue;
    let order = 0;
    for (const p of m.pages) {
      order += 10;
      const existing = await prisma.appPage.findUnique({ where: { pageKey: p.key } });
      if (existing) {
        await prisma.appPage.update({
          where: { id: existing.id },
          data: {
            moduleId: moduleRow.id,
            pageName: p.name,
            route: p.route || null,
            sortOrder: order,
            isSidebarVisible: true,
          },
        });
      } else {
        await prisma.appPage.create({
          data: {
            moduleId: moduleRow.id,
            pageKey: p.key,
            pageName: p.name,
            route: p.route || null,
            sortOrder: order,
            isSidebarVisible: true,
            updatedAt: nowIso(),
          },
        });
      }
    }
  }
}

async function upsertActions(prisma) {
  for (const a of ACTION_REGISTRY) {
    const existing = await prisma.permissionAction.findUnique({ where: { actionKey: a.key } });
    if (existing) {
      await prisma.permissionAction.update({
        where: { id: existing.id },
        data: { actionName: a.name, description: a.description },
      });
    } else {
      await prisma.permissionAction.create({
        data: { actionKey: a.key, actionName: a.name, description: a.description },
      });
    }
  }
}

async function upsertRoles(prisma) {
  for (const r of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        label: r.label,
        isSystem: true,
        isActive: true,
        isDeleted: false,
      },
      create: {
        code: r.code,
        name: r.name,
        label: r.label,
        isSystem: true,
        isActive: true,
        isDeleted: false,
      },
    });
  }
}

async function upsertScopes(prisma) {
  for (const s of DEFAULT_SCOPES) {
    const role = await prisma.role.findUnique({ where: { code: s.roleCode } });
    if (!role) continue;
    const existing = await prisma.roleDataScope.findFirst({
      where: { roleId: role.id, moduleKey: s.moduleKey, pageKey: null },
    });
    if (existing) {
      if (existing.scopeType !== s.scopeType) {
        await prisma.roleDataScope.update({
          where: { id: existing.id },
          data: { scopeType: s.scopeType },
        });
      }
    } else {
      await prisma.roleDataScope.create({
        data: {
          roleId: role.id,
          moduleKey: s.moduleKey,
          pageKey: null,
          scopeType: s.scopeType,
          updatedAt: nowIso(),
        },
      });
    }
  }
}

async function upsertFieldRestrictions(prisma) {
  for (const f of DEFAULT_FIELD_RESTRICTIONS) {
    for (const roleCode of f.sensitiveFor) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      if (!role) continue;
      const moduleKey = f.entity.startsWith('Hrm') || f.entity === 'PayrollRunEmployee'
        ? 'hrm'
        : f.entity.startsWith('Finance') || f.entity === 'PaymentDisbursement'
          ? 'finance'
          : f.entity.startsWith('Crm') || f.entity === 'ClientAccount'
            ? 'crm'
            : 'core';
      const existing = await prisma.fieldPermission.findUnique({
        where: {
          roleId_entityName_fieldName: {
            roleId: role.id,
            entityName: f.entity,
            fieldName: f.field,
          },
        },
      });
      if (existing) {
        if (existing.canView !== false) {
          await prisma.fieldPermission.update({
            where: { id: existing.id },
            data: { canView: false, canEdit: false },
          });
        }
      } else {
        await prisma.fieldPermission.create({
          data: {
            roleId: role.id,
            moduleKey,
            entityName: f.entity,
            fieldName: f.field,
            canView: false,
            canEdit: false,
            updatedAt: nowIso(),
          },
        });
      }
    }
  }
}

// Super-admin gets every page and every action by default. Other roles
// start with everything denied — phase 2 surfaces toggles to grant.
async function seedSuperAdminBaseline(prisma) {
  const role = await prisma.role.findUnique({ where: { code: 'super_admin' } });
  if (!role) return;
  const pages = await prisma.appPage.findMany({ select: { id: true } });
  const actions = await prisma.permissionAction.findMany({ select: { id: true } });
  for (const p of pages) {
    await prisma.rolePageAccess.upsert({
      where: { roleId_pageId: { roleId: role.id, pageId: p.id } },
      update: { canView: true },
      create: { roleId: role.id, pageId: p.id, canView: true, updatedAt: nowIso() },
    });
    for (const a of actions) {
      await prisma.roleActionPermission.upsert({
        where: {
          roleId_pageId_actionId: {
            roleId: role.id,
            pageId: p.id,
            actionId: a.id,
          },
        },
        update: { allowed: true },
        create: { roleId: role.id, pageId: p.id, actionId: a.id, allowed: true, updatedAt: nowIso() },
      });
    }
  }
}

export async function seedAccessControlBaseline(prisma) {
  await upsertRoles(prisma);
  await upsertModules(prisma);
  await upsertPages(prisma);
  await upsertActions(prisma);
  await upsertScopes(prisma);
  await upsertFieldRestrictions(prisma);
  await seedSuperAdminBaseline(prisma);
}

export const __ACC_SEED_INTERNALS__ = {
  DEFAULT_ROLES,
  MODULE_REGISTRY,
  ACTION_REGISTRY,
  DEFAULT_SCOPES,
  DEFAULT_FIELD_RESTRICTIONS,
};
