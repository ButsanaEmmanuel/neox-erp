# NEOX PM — Handoff Sprint 3 (RBAC)

> Document de reprise. À lire en entier AVANT la première action Sprint 3.
> Sprint 3 touche le pivot de toutes les permissions (`universalAccess.service.mjs`) — pas d'écriture sans avoir relu ce document + le plan principal `NEOX_PM_PLAN.md`.

---

## 1. Branche active + commits clés de la session

**Branche :** `claude/angry-sinoussi-faf92c`
**Base de divergence :** `862094e publish current project updates`

**14 commits livrés dans cette session** (du plus ancien au plus récent) :

### Phase 1 — Préparation services frontend

| Hash | Description |
|------|-------------|
| `77e2dcc` | refactor(pm): move ProjectMember type to types/pm.ts |
| `6b3a546` | feat(pm): add projectApi.service.ts (Task 2.2) |
| `e8fb1ce` | refactor(pm): deprecate telecomFinanceSync (Task 2.3) — finance sync now backend-driven |
| `d31b8f0` | docs(pm): mark Tasks 2.2 and 2.3 complete |

### Phase 2 — Backend routes PM (architecture parallèle)

| Hash | Description |
|------|-------------|
| `4a8f7bc` | feat(pm): add projectCrud.service.mjs — 8 Prisma business functions (Phase 2, Commit 1/3) |
| `72a70a7` | feat(pm): add projects.routes.mjs — 8 HTTP handlers for project CRUD (Phase 2, Commit 2/3) |
| `d862c48` | feat(pm): wire handlePmProjectRoutes into auth-server + add parseActorFromUrl (Phase 2, Commit 3/3) |

### Phase 3 — Refactor store frontend (Sprint 2 Tâche 2.1)

| Hash | Description |
|------|-------------|
| `2c4e66b` | refactor(pm): remove persist middleware, emitGlobalProjectsRefresh + storage listeners (Commit A) |
| `2f3ef7f` | feat(pm): wire updateProject/deleteProject/members to API (Commit B) |
| `18da9a5` | feat(pm): wire addWorkItem/updateWorkItem/deleteWorkItem to API, drop telecom stubs (Commit C) |
| `7ad4ff1` | feat(pm): wire addScopeItem to API, fix ProjectScope type, remove fallback catch (Commit D) |
| `6e47ec1` | docs(pm): journal entry for Commit D + Sprint 2 bilan (28/28) |

### Post-Sprint 2 — Comblement des dettes

| Hash | Description |
|------|-------------|
| `f79217c` | chore(db): port ProjectScope + project financials migrations from Sprint 1 (cherry-pick fb6a21b) |
| `46ab35b` | feat(pm): add fetchProjectScope + updateProjectScope handlers (scope debt) |

---

## 2. État Sprint 2 final + dettes résolues

**Sprint 2 — 28/28 cases (100%)**

| Tâche | Cases | Statut |
|-------|-------|--------|
| 2.1 Refactorer useProjectStore | 10/10 | ✅ 4 commits A→D |
| 2.2 Créer projectApi.service.ts | 15/15 | ✅ |
| 2.3 Corriger telecomFinanceSync | 3/3 | ✅ (stubs throw, sync backend-driven) |

**Dettes post-Sprint 2 résolues :**

- **Dette migrations Prisma** (`f79217c`) — `20260517_add_project_financials` + `20260518_add_project_scope` + schema portés depuis `claude/vigorous-napier-03a79d`. Schema aligné. `prisma generate` ✅, `tsc --noEmit` ✅. **`prisma migrate deploy` non exécuté** (worktree sans `.env`/DATABASE_URL) — à appliquer en environnement DB.
- **Dette scope-routes** (`46ab35b`) — handlers `GET/PATCH /api/v1/projects/:id/scope` ajoutés dans `backend/routes/pm/projects.routes.mjs` + service correspondant. `projectApi.updateProjectScope` (utilisé par `addScopeItem` Commit D) maintenant routable.

**Dettes résiduelles connues (hors-scope Sprint 3) :**

- Stubs `updateTelecomManualFields` / `retryFinanceSync` → no-op + `console.warn`. À brancher sur `PATCH /api/v1/pm/projects/:id/work-items/:itemId/details` en Phase 4.
- `ProjectScope.constraints?` optionnel côté frontend — à rendre obligatoire quand les composants UI rendent ce champ.
- `prisma migrate deploy` à exécuter manuellement (action irréversible, validation utilisateur requise).
- Tests Sprint 1 (`pm-*-task-*.test.mjs`) restent sur `vigorous-napier`, jamais portés ici — architecture parallèle (`backend/routes/pm/` vs `backend/routes/`) les rend non-applicables tels quels.

---

## 3. Plan Sprint 3 révisé

L'audit de session a révélé que **les heuristiques string sont dupliquées dans 2 fichiers backend**, pas dans 1 seul comme le plan initial le supposait. Sprint 3 est donc plus large que prévu.

### Tâche 3.1 — Backend : éliminer heuristiques dans `universalAccess.service.mjs`

**Périmètre exact :** lignes 197–245 de `backend/services/access/universalAccess.service.mjs`, fonction `getUserPermissionSet`.

**Heuristiques string à supprimer :**
- `inEngineeringDepartment` = `department.code` OU `department.name` `.includes('eng' | 'engineering')`
- `isProjectManagerTitle` = `jobTitle.includes('project manager')`
- Le bloc `hasProjectFullAccess` qui OR ces deux conditions avec d'autres signaux DB

**Signaux DB à conserver/renforcer :**
- `context.isAdmin` (via `resolveOmniAdmin`)
- `context.roleCodes.includes('PROJECT_MANAGER')`
- `context.managedProjectCount > 0`
- `context.engineeringTeamProjectCount > 0`
- `context.projectMembershipCount > 0`
- Permissions explicites via `prisma.rolePermission.findMany` (déjà lu plus bas dans la fonction l.247+ — **résultat actuellement non utilisé pour décider `hasProjectFullAccess`**, c'est l'anti-pattern à corriger)

### Tâche 3.2 — Backend : `projectCollaboration.service.mjs:290-310`

Une fois 3.1 fait, le bloc l.290–310 (`listProjectsForUser`) devient une duplication. Deux options :

- **(a)** Supprimer la duplication, appeler `getUserPermissionSet(prisma, userId)` au début et lire `permissionSet.modules.project.visible` + flags pour décider
- **(b)** Garder calcul local mais sur les mêmes signaux DB que 3.1 (cohérence sans appel supplémentaire)

À trancher en début Sprint 3 après benchmark/lecture du contexte d'appel.

### Tâche 3.3 — Frontend : retirer heuristique `ProjectsIndex.tsx`

**Périmètre exact :** `src/components/pm/ProjectsIndex.tsx` lignes 91–105.

**Bloc à éliminer :**
```typescript
const managerOptions = employees
  .filter((emp) => {
    const role = String(emp.role || '').toLowerCase();
    return role.includes('manager') || role.includes('lead')
        || role.includes('director') || role.includes('head');
  });
```

**Solution recommandée :** créer/réutiliser un endpoint backend qui retourne les utilisateurs "managers" selon `RolePermission` ou `roleCodes.includes('PROJECT_MANAGER')`. Décision sur l'endpoint à prendre après lecture de ce qui existe :
- `(α)` Réutiliser `GET /api/v1/projects?userId=...` et filtrer côté frontend sur `roleCodes`
- `(β)` Créer `GET /api/v1/users?role=PROJECT_MANAGER` (route neuve)
- `(γ)` Étendre la réponse existante `GET /api/v1/users` avec un flag

### Tâche 3.4 — Documentation grille permissions

Le bloc `prisma.rolePermission.findMany` dans `universalAccess.service.mjs` suggère que des entrées `RolePermission` existent en DB. Sprint 3 doit livrer dans `docs/` la liste exhaustive des keys `module:resource:action` actuellement émises pour le module `project`, afin que les futurs call sites frontend (`usePermissions().hasPermission('project', ...)`) sachent quoi appeler.

### Hors-scope Sprint 3 (à documenter explicitement)

- `src/lib/rbac.ts` — utilisé par **10 fichiers HRM uniquement**, zéro consommateur PM/SCM/CRM/Finance. **Reste pour HRM, ne pas y toucher en Sprint 3.**
- Audit RBAC modules SCM, CRM, Finance, HSE — hors-scope du module Project Management.

---

## 4. Risques identifiés

### R1 — Régression accès Engineering (critique)

**Scénario :** si on supprime `inEngineeringDepartment` sans avoir d'abord peuplé `RolePermission` ou vérifié que les utilisateurs Engineering ont déjà `roleCodes.includes('PROJECT_MANAGER')`, **ils perdent l'accès au module Project silencieusement**.

**Mitigation requise avant le code change :**
1. Script audit DB : combien d'utilisateurs ont `department.code/name` matchant "eng"/"engineering" ?
2. Parmi eux, combien ont `roleCodes.includes('PROJECT_MANAGER')` ?
3. Parmi eux, combien ont au moins un signal DB positif (`managedProjectCount > 0`, `projectMembershipCount > 0`, etc.) ?
4. Pour ceux qui n'ont aucun signal — peupler `RolePermission` ou créer une migration de données avant suppression heuristiques.

### R2 — Fixtures de tests sur autre branche

Les fixtures de tests Sprint 1 (`backend/tests/pm-*-task-*.test.mjs`) sont **sur `claude/vigorous-napier-03a79d`, pas ici**. Question critique :
- Les fixtures peuplent-elles `RolePermission` explicitement ?
- Ou bien reposent-elles sur `department.code = 'engineering'` et espèrent que les heuristiques passent ?

Si **(b)**, les tests Sprint 1 vont casser après suppression des heuristiques — mais comme les tests ne sont **pas portés ici**, on ne le verra pas. Risque d'angle mort.

### R3 — Anti-pattern : `rolePermission.findMany` lu mais ignoré

Lignes 247–250 de `universalAccess.service.mjs` lisent `RolePermission` de la DB, **mais le résultat n'est jamais utilisé pour décider `hasProjectFullAccess`** (qui reste OR d'heuristiques string).

**Implication :** la table existe et est consultée, mais ne sert à rien pour les décisions critiques. C'est l'inverse du design propre. Sprint 3 doit changer ça.

### R4 — Plan original sous-estimait la dette

Le plan initial Sprint 3 ne mentionnait qu'**une** des deux duplications heuristiques (`projectCollaboration.service.mjs:295-299`). La vraie source (`universalAccess.service.mjs:197-245`) n'était pas dans le plan. Sprint 3 est donc plus long que le plan ne le laissait croire.

---

## 5. Première action à la reprise

**AVANT toute écriture Sprint 3, lire les fixtures backend Sprint 1 via `git show` (elles ne sont pas dans cette branche) :**

```bash
git show claude/vigorous-napier-03a79d:backend/tests/pm-routes-task-1-1.test.mjs | head -150
```

**Question binaire à trancher :**
- ✅ Les fixtures peuplent `RolePermission` explicitement → on peut supprimer les heuristiques sans casser Sprint 1 (si on porte les tests un jour)
- ❌ Les fixtures reposent sur `department.code = 'engineering'` → Sprint 3 doit inclure une étape **migration de données** ou **adaptation des fixtures** avant le code change

Le résultat de cette lecture **détermine si Tâche 3.1 peut démarrer directement, ou si elle doit attendre une étape de préparation DB**.

**Suite de lecture après réponse à la question :**
1. Lire `backend/services/access/universalAccess.service.mjs` en entier (pour comprendre le contexte de `getUserPermissionSet`)
2. Lire `loadUserContext` (la fonction qui produit `context` consommé par les heuristiques)
3. Vérifier la structure de `RolePermission` en DB : `grep -n "model RolePermission\|model Role" prisma/schema.prisma`
4. Lister les permissions actuelles : `grep -rn "rolePermission.findMany\|setPermissionValue" backend/services/ --include="*.mjs"`

---

## 6. Références rapides

### Fichiers backend Sprint 3 (cibles)
- `backend/services/access/universalAccess.service.mjs` (l.197–245 critique)
- `backend/services/projects/projectCollaboration.service.mjs` (l.290–310)
- `backend/routes/pm/projects.routes.mjs` (zone de routes existantes — extension possible)

### Fichiers frontend Sprint 3 (cibles)
- `src/components/pm/ProjectsIndex.tsx` (l.91–105 critique)
- `src/hooks/usePermissions.ts` (asset — déjà DB-driven, consomme `/api/v1/access/permission-set`)
- `src/types/access.ts` (types alignés backend)

### Fichiers hors-scope (à ne PAS toucher en Sprint 3)
- `src/lib/rbac.ts` (HRM-only)
- `src/components/hrm/**` (consommateurs `rbac.ts`)

### Documentation
- `docs/NEOX_PM_PLAN.md` — plan principal à jour Sprint 2 + dettes
- `docs/NEOX_PM_HANDOFF_SPRINT3.md` — ce document
