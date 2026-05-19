# NEOX PM — Grille des permissions module `project`

> Référence technique. Sprint 3 Tâche 3.4. Source unique de vérité : `backend/services/access/universalAccess.service.mjs` → `getUserPermissionSet`.

## Endpoint

`GET /api/v1/access/permission-set?userId=<id>` → `PermissionSetPayload` (voir `src/types/access.ts`).

Retour : `{ userId, roles, departmentId, authorityLevel, projectMembershipCount, managedProjectCount, engineeringTeamProjectCount, modules, permissions }`.

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

Keys toujours émises par `getUserPermissionSet`, valeur calculée à la volée. `hasProjectFullAccess` = `isAdmin || roleCodes ∋ PROJECT_MANAGER || hasExplicitProjectPermission || managedProjectCount > 0 || engineeringTeamProjectCount > 0 || projectMembershipCount > 0`.

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
| `engineering_team_assignment` | `engineeringTeamProjectCount > 0` |
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

## Anti-patterns à ne pas réintroduire (cf. Sprint 3)

- Heuristique string sur `jobTitle` (`includes('project manager')`) — supprimée Tâche 3.1.
- Heuristique string sur `department.code|name` (`includes('eng')`) — supprimée Tâche 3.1.
- Filtre frontend `role.includes('manager'|'lead'|'director'|'head')` — remplacé par flag DB `canManageProjects` (Tâche 3.3).
- Recalcul local des heuristiques dans `projectCollaboration.service.mjs` — supprimé Tâche 3.2, délégué à `getUserPermissionSet`.

## Voir aussi

- `backend/services/access/universalAccess.service.mjs` — implémentation
- `src/hooks/usePermissions.ts` — consommation frontend
- `src/types/access.ts` — types `PermissionSetPayload`, `ModuleCapability`
- `docs/NEOX_PM_HANDOFF_SPRINT3.md` — contexte Sprint 3
