# NEOX PM — Grille des permissions module `project`

> Référence technique. Sprint 3 Tâche 3.4. Source unique de vérité : `backend/services/access/universalAccess.service.mjs` → `getUserPermissionSet`.

## Endpoint

`GET /api/v1/access/permission-set?userId=<id>` → `PermissionSetPayload` (voir `src/types/access.ts`).

Retour : `{ userId, roles, departmentId, authorityLevel, projectMembershipCount, managedProjectCount, modules, permissions }`.

## Consommation frontend (`src/hooks/usePermissions.ts`)

```ts
const { canViewModule, isReadOnlyModule, hasPermission, moduleCapabilities } = usePermissions();
canViewModule('project');                         // bool — modules.project.visible
isReadOnlyModule('project');                      // bool — modules.project.readOnly
hasPermission('project', 'scope', 'write');       // bool — permissions['project:scope:write']
moduleCapabilities.project.reason;                // string — voir tableau "Reasons" ci-dessous
```

Bypass implicite : admin (`user.role === 'ADMIN'` OU `permissions['global:all:all_access']`) → toute permission retourne `true`.

## Grille statique `baselineGrants`

Keys toujours émises par `getUserPermissionSet`, valeur calculée à la volée. `hasProjectFullAccess` = `isAdmin || roleCodes ∋ PROJECT_MANAGER || hasExplicitProjectPermission || managedProjectCount > 0 || projectMembershipCount > 0`.

| Key | Condition d'octroi |
|---|---|
| `project:overview:read` | `hasProjectFullAccess` OU `roleCodes ∋ SALES \| SALES_ACCOUNT_MANAGER` |
| `project:scope:read` | `hasProjectFullAccess` |
| `project:scope:write` | `hasProjectFullAccess` |
| `project:work_items:read` | `hasProjectFullAccess` |
| `project:work_items:write` | `hasProjectFullAccess` |
| `project:milestones:read` | `hasProjectFullAccess` |
| `project:milestones:write` | `hasProjectFullAccess` |
| `project:documents:read` | `hasProjectFullAccess` |
| `project:documents:write` | `hasProjectFullAccess` |

## Grille dynamique — `RolePermission` × `Permission` (DB)

Toute ligne en DB avec `permission.module = 'project'` injecte `project:<resource>:<action> = true` dans `permissions`. **Liste non bornée par le code** — auditer via :

```sql
SELECT DISTINCT p."module", p."resource", p."action"
FROM "Permission" p
JOIN "RolePermission" rp ON rp."permissionId" = p.id
WHERE p."module" = 'project';
```

## Registry PM — keys atomiques (Permission table)

Source unique de vérité : `prisma/seed/rbac.seed.mjs` (bloc `PERMISSIONS` filtre `module === 'pm'`). 20 keys au total après DR1 (Sprint RBAC+D5 — DR1 a ajouté `pm.milestones.delete`).

| Key | Action gardée |
|---|---|
| `pm.projects.read` | `GET /api/v1/projects`, `GET /api/v1/projects/:id` |
| `pm.projects.write` | `POST /api/v1/projects`, `PATCH /api/v1/projects/:id`, members write |
| `pm.projects.delete` | `DELETE /api/v1/projects/:id` (soft) |
| `pm.projects.execute` | Clôture/archivage projet |
| `pm.workItems.read` | `GET /api/v1/projects/:id/work-items` |
| `pm.workItems.write` | `POST/PATCH /api/v1/projects/:id/work-items[/:itemId]`, sub-tasks |
| `pm.workItems.delete` | `DELETE /api/v1/projects/:id/work-items/:itemId` (soft) |
| `pm.workItems.execute` | Soumission QA, approbation, signature |
| `pm.milestones.read` | `GET /api/v1/projects/:id/milestones` |
| `pm.milestones.write` | `POST/PATCH /api/v1/projects/:id/milestones[/:mId]` |
| `pm.milestones.delete` | `DELETE /api/v1/projects/:id/milestones/:mId` (soft) — DR1 |
| `pm.milestones.execute` | Marquer un jalon complet |
| `pm.documents.read` | Lecture documents projet |
| `pm.documents.write` | Upload documents projet |
| `pm.documents.delete` | Suppression documents projet |
| `pm.scope.read` | `GET /api/v1/projects/:id/scope` |
| `pm.scope.write` | `PATCH /api/v1/projects/:id/scope` (upsert) |
| `pm.import.execute` | `POST /api/v1/projects/:id/import` (bulk télécom) |
| `pm.finance.read` | Lecture entrées finance liées au projet |
| `pm.finance.execute` | Push sync finance |

Note : `pm.scope` n'a **pas** d'action `delete` (aucune route DELETE existe ; le scope vit avec son projet, supprimé via cascade soft).

## Grille rôles → keys PM

| Rôle | PM keys (via `prisma/seed/rbac.seed.mjs`) |
|---|---|
| `super_admin` | Toutes les 20 (via `ALL_KEYS`) |
| `project_manager` | Toutes les 20 (via `...PM_KEYS`) |
| `project_member` | `pm.projects.read`, `pm.workItems.{read,write,execute}`, `pm.milestones.read`, `pm.documents.{read,write}`, `pm.scope.read` (8 keys) |
| `readonly` | Toutes les `pm.*.read` (6 keys via `...READ_KEYS` : projects, workItems, milestones, documents, scope, finance) |

## Overrides utilisateur — `UserPermissionSet`

`prisma.userPermissionSet.findMany({ where: { userId, isActive: true } })` est lu après `RolePermission`. Effet `allow` → `true`, effet `deny` → `false`. **Précédence : override > baseline > rolePermission > false implicite.**

## Signal premier niveau — `modules.project`

```ts
{ visible: boolean, readOnly: boolean, reason: string }
```

| `reason` | Source |
|---|---|
| `omni_admin` | `isAdmin` (backend) |
| `omni_admin_frontend` | bypass admin côté hook |
| `project_manager_role` | `roleCodes ∋ PROJECT_MANAGER` |
| `role_permission_grant` | `RolePermission.module === 'project'` |
| `project_manager_assignment` | `managedProjectCount > 0` |
| `project_membership` | `projectMembershipCount > 0` |
| `role_grant` | `DEFAULT_ROLE_MODULE_ACCESS[roleCode] ∋ 'project'` |
| `sales_client_progress_readonly` | `roleCodes ∋ SALES \| SALES_ACCOUNT_MANAGER`, lecture seule |
| `no_membership` | aucun signal — `visible: false` |
| `role_restricted` | rôle sans le module |
| `fallback` / `self_service_fallback` | hook frontend, `payload === null` |

## Bypass admin

Si `isAdmin` :
- `modules.*` forcés à `{ visible: true, readOnly: false, reason: 'omni_admin' }`
- `permissions['global:all:all_access'] = true`
- Le hook frontend court-circuite `hasPermission` et `canViewModule` à `true` sans consulter la map.

## Anti-patterns à ne pas réintroduire

- (Sprint 3.1) Heuristique string sur `jobTitle` (`includes('project manager')`).
- (Sprint 3.1) Heuristique string sur `department.code|name` (`includes('eng')`) dans la décision `hasProjectFullAccess`.
- (Sprint 3.3) Filtre frontend `role.includes('manager'|'lead'|'director'|'head')` — remplacé par flag DB `canManageProjects`.
- (Sprint 3.2) Recalcul local des heuristiques dans `projectCollaboration.service.mjs` — délégué à `getUserPermissionSet`.
- (Sprint RBAC+D5 — DR3) Compteur `engineeringTeamProjectCount` couplant la décision RBAC à une whitelist `roleCode ∈ [LEAD, CONTRIBUTOR, VIEWER, ENGINEERING]` + string match `department.code|name contains 'ENG'/'Engineering'`. Le champ a été retiré ; le membership est désormais signalé exclusivement par `projectMembershipCount` (DB-only, sans filtre).
- (Sprint Dettes — D6) Hardcode `src/lib/rbac.ts` (shim `can()`/tables `MODULE_OWNER_DEPARTMENTS`/etc.) supprimé. Toute nouvelle gate passe par `usePermissions()` côté frontend et `assertPermission(ctx, key)` côté backend.

## Changelog

| Sprint | Date | Modifications |
|---|---|---|
| Sprint 3 (Tâches 3.1-3.4) | 2026-05-18 | Création initiale du document. Suppression des heuristiques string `jobTitle`/`department`. Signal DB `hasExplicitProjectPermission` via `RolePermission`. Flag `canManageProjects` frontend. |
| Sprint Dettes Techniques (D6) | 2026-05-24 | Bascule de `assertModuleAccess` legacy vers `assertPermission(ctx, key)` sur 18 routes PM (15 dans `routes/pm/projects.routes.mjs` + 3 inline `auth-server.mjs`). Shim frontend `can()`/`canAccess()` supprimé. |
| Sprint RBAC+D5 — DR1 | 2026-05-24 | Ajout de `pm.milestones.delete` au registry. Route `DELETE /milestones/:mId` migrée de `pm.milestones.write` → `pm.milestones.delete`. Registry PM passe de 19 à 20 keys. |
| Sprint RBAC+D5 — DR2 | 2026-05-24 | 10 permissions `finance.*` legacy (`finance.entries.*`, `finance.evidence.upload`, `finance.reconciliation.resolve`, `finance.settings.manage`) intégrées au seed → `super_admin` couvre 100% du registry (109/109) via `RolePermission`. Script one-shot `scripts/grant-admin-full-perms.mjs` supprimé. |
| Sprint RBAC+D5 — DR3 | 2026-05-24 | Suppression de `engineeringTeamProjectCount` (string heuristic `ENG`/`Engineering` + whitelist roleCode). Redondant avec `projectMembershipCount`. Reason `engineering_team_assignment` retirée. |

## Voir aussi

- `backend/services/access/universalAccess.service.mjs` — implémentation `getUserPermissionSet`
- `backend/services/auth/rbac.service.mjs` — `assertPermission`, `getUserPermissions`
- `prisma/seed/rbac.seed.mjs` — source unique du registry (`PERMISSIONS`) et des rôles (`ROLES`)
- `src/hooks/usePermissions.ts` — consommation frontend
- `src/types/access.ts` — types `PermissionSetPayload`, `ModuleCapability`
- `docs/NEOX_PM_HANDOFF_SPRINT3.md` — contexte Sprint 3
