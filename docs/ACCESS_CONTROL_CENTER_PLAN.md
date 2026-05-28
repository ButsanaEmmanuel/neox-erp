# NEOX Access Control Center — Architecture & Phased Plan

> **Status**: design — not yet implemented.
> **Scope**: global ERP-wide RBAC moved out of HRM Configuration into
> `Settings → Access Control Center`. Backend enforcement at every API
> endpoint, not just frontend hiding.

## 0. Premise: what exists today

The current system has the **storage primitives** in place but the
**business layer** missing.

Already in place (do not throw away):
- `Permission` / `Role` / `RolePermission` / `UserRole` / `UserPermissionSet`
  Prisma tables.
- `assertPermission(ctx, key)` middleware reading from
  `parseActorFromUrl(url)` and resolving via `getUserPermissions(userId)`.
- `super_admin` role bypass (commit `3dca59a`).
- Permission keys in dotted form `<module>.<resource>.<action>` (e.g.
  `finance.entries.read`).
- HRM Configuration → User Permissions tab (recently fixed in `7942f1b`
  to resolve `HrmEmploymentProfile.id` → `User.id`).

Missing — what this plan adds:
- A **business-readable** UI layer: pages, actions, scope, field
  restrictions, approval flows.
- **Data scope** (own / department / project / location / company).
- **Field-level security** stripping sensitive columns from DTOs.
- **Generic approval workflow engine** beyond the bespoke finance approvals.
- **Cross-module linked record permissions** (PM sees Finance payment
  status without full Finance access).
- **Permission audit log**.
- A **page/module registry** the sidebar derives from.

## 1. Information architecture

```
Settings
└── Access Control Center
    ├── Roles                   (CRUD + tabs per role)
    ├── Users                   (search → assign roles)
    ├── Page Access             (matrix: role × module/page)
    ├── Action Permissions      (matrix: role × page × action)
    ├── Data Scope              (per role × module/page)
    ├── Cross-Module Workflows  (Purchase Request, Expense, Payroll, …)
    ├── Approval Workflows      (configurable steps + thresholds)
    ├── Field-Level Security    (per role × entity × field)
    └── Audit Log               (chronological changes)
```

**HRM Configuration** is reduced to: Departments, Onboarding/Offboarding
Templates, Leave Rules, Training Settings, Automation Rules. The current
"Roles" and "User Permissions" tabs become deep-links into the Access
Control Center, so existing muscle memory still works.

## 2. Data model (Prisma)

Keep `Permission`/`Role`/`RolePermission`/`UserRole`/`UserPermissionSet`
as the **low-level storage** — they drive `assertPermission` and the
super-admin bypass. Add the following **higher-level entities** that
the new UI manipulates. A nightly job (or change hook) projects them
back into the low-level `RolePermission` table so the existing
middleware keeps working untouched.

```prisma
model AppModule {
  id             String   @id @default(cuid())
  moduleKey      String   @unique   // "finance", "hrm", "pm"…
  moduleName     String
  sortOrder      Int      @default(0)
  icon           String?
  pages          AppPage[]
}

model AppPage {
  id                String   @id @default(cuid())
  moduleId          String
  parentPageId      String?
  pageKey           String   @unique // "finance.payments", "hrm.leave"
  pageName          String
  route             String?         // "/finance/payments"
  icon              String?
  sortOrder         Int      @default(0)
  isSidebarVisible  Boolean  @default(true)
  module            AppModule @relation(fields: [moduleId], references: [id])
  parent            AppPage?  @relation("PageChildren", fields: [parentPageId], references: [id])
  children          AppPage[] @relation("PageChildren")
  rolePageAccess    RolePageAccess[]
  roleActionPermissions RoleActionPermission[]
}

model RolePageAccess {
  id        String   @id @default(cuid())
  roleId    String
  pageId    String
  canView   Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id])
  page      AppPage  @relation(fields: [pageId], references: [id])
  @@unique([roleId, pageId])
}

model PermissionAction {
  id          String   @id @default(cuid())
  actionKey   String   @unique  // "view", "create", "approve"…
  actionName  String
  description String?
  rolePermissions RoleActionPermission[]
}

model RoleActionPermission {
  id        String   @id @default(cuid())
  roleId    String
  pageId    String
  actionId  String
  allowed   Boolean  @default(false)
  role      Role     @relation(fields: [roleId], references: [id])
  page      AppPage  @relation(fields: [pageId], references: [id])
  action    PermissionAction @relation(fields: [actionId], references: [id])
  @@unique([roleId, pageId, actionId])
}

model RoleDataScope {
  id          String   @id @default(cuid())
  roleId      String
  moduleKey   String
  pageKey     String?  // null = applies to whole module
  scopeType   String   // own | department | project | location | related | company | custom
  customRule  Json?    // shape: { field, operator, value } when scopeType=custom
  role        Role     @relation(fields: [roleId], references: [id])
  @@index([roleId, moduleKey])
}

model FieldPermission {
  id          String   @id @default(cuid())
  roleId      String
  moduleKey   String
  entityName  String   // "FinanceEntry", "User", "HrmEmploymentProfile"
  fieldName   String   // "bankAccount", "passwordHash", "compensation.amount"
  canView     Boolean  @default(true)
  canEdit     Boolean  @default(false)
  role        Role     @relation(fields: [roleId], references: [id])
  @@unique([roleId, entityName, fieldName])
  @@index([roleId, moduleKey])
}

model CrossModuleWorkflow {
  id            String   @id @default(cuid())
  workflowKey   String   @unique
  name          String
  sourceModule  String
  description   String?
  isActive      Boolean  @default(true)
  modules       CrossModuleWorkflowModule[]
  steps         CrossModuleWorkflowStep[]
}

model CrossModuleWorkflowModule {
  id              String  @id @default(cuid())
  workflowId      String
  moduleKey       String
  relationshipType String  // primary | secondary | observer
  workflow        CrossModuleWorkflow @relation(fields: [workflowId], references: [id])
}

model CrossModuleWorkflowStep {
  id                String  @id @default(cuid())
  workflowId        String
  stepOrder         Int
  stepName          String
  responsibleRoleId String?
  actionRequired    String  // "submit" | "approve" | "validate" | "settle"
  conditionType     String? // "always" | "amount_gte" | "amount_lte" | …
  conditionValue    String?
  escalationRoleId  String?
  workflow          CrossModuleWorkflow @relation(fields: [workflowId], references: [id])
}

model LinkedRecordPermission {
  id              String   @id @default(cuid())
  roleId          String
  sourceModule    String
  targetModule    String
  sourceRecordType String  // "Project"
  targetRecordType String  // "FinanceEntry", "PurchaseOrder"
  visibilityLevel String   // "summary" | "limited" | "full"
  allowedActions  String[] // ["view", "comment"]
  role            Role     @relation(fields: [roleId], references: [id])
  @@unique([roleId, sourceRecordType, targetRecordType])
}

model ApprovalWorkflow {
  id          String   @id @default(cuid())
  workflowKey String   @unique
  name        String
  moduleKey   String
  description String?
  isActive    Boolean  @default(true)
  steps       ApprovalStep[]
}

model ApprovalStep {
  id              String   @id @default(cuid())
  workflowId      String
  stepOrder       Int
  approverRoleId  String
  conditionType   String?  // "always" | "amount_gte"
  conditionValue  String?
  workflow        ApprovalWorkflow @relation(fields: [workflowId], references: [id])
}

model PermissionAuditLog {
  id            String   @id @default(cuid())
  roleId        String?
  userId        String?
  changedBy     String
  changeType    String   // role_created | page_access_changed | …
  entityType    String   // "RolePageAccess", "FieldPermission", …
  entityId      String?
  previousValue Json?
  newValue      Json?
  createdAt     DateTime @default(now())
  @@index([roleId, createdAt])
  @@index([userId, createdAt])
}
```

**Why two layers?** The high-level tables are what the Access Control
Center UI reads/writes (business-readable). A **projection service**
denormalises them into `RolePermission` rows on every change so
`assertPermission()` keeps working at the route level with zero new
plumbing. This is the same pattern Notion / Linear use — "computed
permissions" that derive from a higher-level config.

## 3. Backend enforcement layers

Every API endpoint must pass through this stack, in order:

1. **Auth** → resolves `userId` from `?userId=` query param (current
   pattern) or future JWT.
2. **Page access gate** → `assertPageAccess(ctx, 'finance.payments')`
   resolves the user's roles, looks up `RolePageAccess`, denies if no
   row with `canView=true`. Replaces the ad-hoc `system.dashboard.read`
   style keys with module/page names tied to the sidebar.
3. **Action gate** → `assertAction(ctx, 'finance.payments', 'approve')`
   on every mutating route.
4. **Scope filter** → list endpoints accept the user's resolved
   `DataScope` and inject WHERE clauses (`projectId IN userProjects`,
   `userId = currentUser`, `departmentId = userDept`, …). A
   `applyScope(query, scope, currentUser)` helper.
5. **Field stripper** → DTO mappers run `stripFields(dto, role, entity)`
   before serialising. Sensitive columns drop or null out.
6. **Linked record check** for cross-module reads: if a Project Manager
   asks `GET /api/v1/finance/payments?projectId=X`, return only
   payments where the project is in his scope, even if he doesn't have
   global `finance.payments.read`.
7. **Approval threshold** for state-machine routes: the resolved
   `ApprovalStep` must match the action and amount.

Implementation: add `backend/services/access/accessGate.service.mjs`
exposing `assertPageAccess`, `assertAction`, `applyScope`, `stripFields`.
Existing `assertPermission` stays for raw permission-key sites that
haven't migrated yet.

## 4. Default seeded roles

Seed at boot (idempotent upsert, like the existing super_admin seed):

| code | label | scope | notes |
|------|-------|-------|-------|
| `super_admin` | Super Admin | company | existing — wildcard bypass |
| `ceo` | CEO | company | exec dashboards, approval authority above thresholds |
| `deputy_ceo` | Deputy CEO | company | same as CEO minus org-fatal mutations |
| `finance_manager` | Finance Manager | company | full Finance, project budget read |
| `accountant` | Accountant | company | Finance entries + ledger, no approvals |
| `scm_manager` | SCM Manager | company | full SCM, linked project context |
| `procurement_officer` | Procurement Officer | company | SCM create/edit, no approvals |
| `project_manager` | Project Manager | own_projects | own projects + linked SCM/Finance |
| `hr_manager` | HR Manager | company | full HRM, payroll prep |
| `hr_officer` | HR Officer | company | HRM CRUD, no approvals |
| `hse_manager` | HSE Manager | company | full HSE |
| `hse_officer` | HSE Officer | company | HSE CRUD, no closure |
| `crm_manager` | CRM Manager | company | full CRM |
| `sales_officer` | Sales Officer | own | own deals/contacts |
| `department_manager` | Department Manager | department | dept HRM + dept projects |
| `employee` | Employee | own | own leave/timesheet/training/payslip |
| `auditor` | Auditor | company (read-only) | full read, zero write |

## 5. Page registry (seed)

Mirror the current sidebar exactly. One row per `AppPage`. The
sidebar config (`src/config/sidebar.config.json`) becomes the source
of truth; a one-time migration imports its tree into `AppModule` /
`AppPage`. Going forward the sidebar reads from API
`GET /api/v1/access/sidebar?userId=` which already filters by
`RolePageAccess`.

## 6. UI — Access Control Center

Route: `/settings/access-control-center`. Component tree:

```
AccessControlCenter
├── ACCSidebar             (left, lists Roles + Users + global sections)
├── ACCRoleHeader          (role name, type, description, members count)
└── ACCRoleTabs
    ├── OverviewTab        (summary cards + recent audit)
    ├── PageAccessTab      (tree of modules → pages with Visible/Hidden toggles)
    ├── ActionsTab         (expandable per-page action checklists, business names only)
    ├── DataScopeTab       (per module/page scope picker)
    ├── CrossModuleTab     (workflow-by-workflow visibility config)
    ├── ApprovalAuthorityTab (workflow steps where the role is responsible)
    ├── FieldRestrictionsTab (entity → field grid with view/edit toggles)
    ├── MembersTab         (assigned users with revoke + assign)
    └── AuditTrailTab      (chronological log filtered by this role)
```

UX rules:
- **Default view is business-readable**. No raw permission codes.
- **Advanced Matrix View** toggle in the top-right shows the raw
  `<module>.<resource>.<action>` matrix for power users.
- Every mutation is **stage-then-confirm**: changes accumulate in a
  pending tray, "Apply" button commits everything in one transaction
  and writes a single `PermissionAuditLog` row.
- Cross-module read access is rendered as **business sentences**:
  > _Project Manager can view Finance payment status for purchase
  > requests linked to assigned projects._

## 7. Phased delivery

Each phase = 1 PR, mergeable independently, no flag required to keep
running. Order matters — later phases assume earlier ones.

| # | Phase | Files | Why this order |
|---|-------|-------|----------------|
| 1 | **Schema + projection service** | Prisma migration + `accessProjection.service.mjs` (denormalises new tables → `RolePermission`) + seed of default roles, modules, pages | Foundation; everything else reads/writes these tables. Stays dormant if no UI calls it. |
| 2 | **Access Control Center shell** | New route `/settings/access-control-center`, sidebar entry under Settings, tab scaffold with empty Overview + Members tabs working against existing data | Visible win in 1 commit; proves wiring; no behaviour change elsewhere. |
| 3 | **Page Access tab** | Backend `GET/PATCH /api/v1/access/role-page-access`, frontend tree of modules with toggles, sidebar API now derives from `RolePageAccess` | Replaces the existing ad-hoc permission keys for sidebar visibility. Migration path: ad-hoc keys keep working; new keys take precedence. |
| 4 | **Actions tab** | `RoleActionPermission` CRUD, expandable per-page action checklists, backend `assertAction()` helper, retro-fit on Finance + HRM routes first | Highest-value module pair first. Other modules pulled in piecemeal. |
| 5 | **Data Scope tab** | `RoleDataScope` CRUD, `applyScope()` helper, retro-fit on the 5 noisiest list endpoints (`/projects`, `/finance/entries`, `/hrm/employees`, `/hrm/leave-requests`, `/crm/deals`) | Biggest user-visible payoff (Project Manager finally sees only his projects). |
| 6 | **HRM Configuration cleanup** | Remove "Roles" + "User Permissions" tabs from HRM Configuration; replace with link cards pointing at ACC; deep-links preserved via redirect | Closes the conceptual loop the user described. Tiny PR. |
| 7 | **Cross-Module + Linked Records** | `CrossModuleWorkflow*` + `LinkedRecordPermission` CRUD, UI workflow viewer, backend enforcement on cross-module GETs (PM seeing Finance payment status for his project) | Solves the Purchase Request / Expense Claim / Timesheet→Payroll examples. |
| 8 | **Approval Workflows** | `ApprovalWorkflow` + `ApprovalStep` CRUD, generic engine, retro-fit the existing finance approval routes onto it | Replaces ad-hoc thresholds scattered across `financeEntries.service.mjs`. |
| 9 | **Field-Level Security** | `FieldPermission` CRUD, `stripFields()` helper, retro-fit on the 6 entities that actually have sensitive fields (User, HrmEmploymentProfile, FinanceEntry, PayrollRunEmployee, ClientAccount, Project) | Last because it touches every DTO mapper. |
| 10 | **Audit Log tab** | `PermissionAuditLog` UI, tail-style infinite scroll, filterable | Tail end — needs the other phases to have written rows. |

Estimated effort, conservatively:

- Phase 1: 1 day (mostly schema + seeds)
- Phase 2-3: 1 day each
- Phase 4-5: 2 days each
- Phase 6: half day
- Phase 7-8: 2 days each
- Phase 9: 2 days
- Phase 10: half day

**Total: ~14 working days** at sustained pace, assuming each phase
ships behind no flag (the user can keep working in the meantime).

## 8. Open decisions before phase 1

1. **Roles list** — confirm the 17 seeded roles above, or trim. Some
   orgs don't have a Deputy CEO or Auditor; we should not seed roles
   nobody uses (they pollute the picker).
2. **Page registry source of truth** — `sidebar.config.json` once,
   then DB? Or DB primary and the config file becomes a fixture? My
   recommendation: **DB primary** so admins can disable sidebar items
   without redeploying.
3. **Scope semantics** — when a Project Manager has scope
   `own_projects`, what defines "own"? Membership in `ProjectMember`?
   Being the project's `managerId`? Both? Decide once, codify in
   `applyScope`.
4. **Field-level for nested JSON** — `compensation.amount` lives inside
   a JSON column. Strip via DTO mapper (clean) or via Prisma `omit`
   (limited)? Lean DTO mapper.
5. **Approval threshold currency** — multi-currency in same workflow?
   Convert at evaluation time or store amount + currency on the step?
   Convert at evaluation time, log the rate used.

## 9. Migration safety

- Existing `assertPermission` calls keep working — they read
  `RolePermission`, which phase 1's projection populates from the
  new tables. Old hard-coded permission keys remain valid forever.
- Existing `UserPermissionSet` overrides remain — they layer on top
  of role-derived permissions exactly as today.
- No destructive migration. New tables added; nothing removed until
  phase 10.
- The current HRM `User Permissions` tab keeps working through phase
  5. Phase 6 redirects it to ACC.

## 10. Out of scope (explicit non-goals)

- ABAC (attribute-based, conditional like "after 6pm only"). RBAC is
  the right level for an ERP at this size; ABAC adds complexity nobody
  asked for.
- Multi-tenant. The whole codebase is single-tenant and this plan does
  not change that.
- External identity providers (Okta, Azure AD). Local Postgres auth
  stays; SSO is a separate plan.
- Time-bound roles (validFrom/validTo already exist on `UserRole`
  but the UI does not surface them; postponed to a later UX pass).

---

**Next action**: pick the phase to start with. Default recommendation
is **phase 1 (schema + projection)** because every other phase depends
on it and it lands invisibly behind no flag.
