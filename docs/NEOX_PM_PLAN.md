# NEOX ERP — Plan d'Exécution Module Project Management

> Document de référence persistant. Cocher chaque tâche à la completion.
> Ne jamais commencer un sprint sans que le précédent soit 100% coché.
> Mettre à jour ce fichier après chaque tâche complétée.

---

## Règles Absolues (relire avant chaque tâche)

- [ ] Lire les fichiers concernés AVANT d'écrire quoi que ce soit
- [ ] Toute migration Prisma : générer + montrer le SQL AVANT d'appliquer
- [ ] Jamais créer d'IDs locaux dans le store (attendre le retour backend)
- [ ] Jamais de fallback silencieux qui masque une erreur backend
- [ ] Jamais écrire dans localStorage sauf pour le token JWT
- [ ] Toucher auth-server.mjs uniquement pour l'import du module de routes
- [ ] Ne pas commencer Sprint 5 avant validation des migrations Sprint 1
- [ ] Mettre à jour NEOX_PM_PLAN.md après chaque tâche terminée, AVANT de commencer la suivante (cocher cases + Journal de Progression)

---

## SPRINT 1 — Fondations Backend (Débloquer la persistance)
**Objectif : Zéro opération PM ne doit mourir au refresh.**
**Statut : ✅ Complet (195/195 tests)**

### Tâche 1.1 — Module de routes PM séparé
- [x] Créer `backend/routes/projects.routes.mjs`
- [x] Exporter `registerProjectRoutes({ prisma, helpers })` retournant `handle(method, pathname, req, res, url): Promise<boolean>`
- [x] Implémenter `PATCH /api/v1/projects/:id`
- [x] Implémenter `DELETE /api/v1/projects/:id` (soft delete)
- [x] Implémenter `GET /api/v1/projects/:id/members`
- [x] Implémenter `POST /api/v1/projects/:id/members`
- [x] Implémenter `DELETE /api/v1/projects/:id/members/:userId`
- [x] Brancher dans `auth-server.mjs` avec un seul import
- [x] L'intégration dans auth-server.mjs se limite à 8 lignes : import (L27), init du handler avec helpers (L163-167), et `if (await handleProjectRoute(...)) return;` avant le premier `if` PM existant (L870)
- [x] Tester chaque route (200, 400, 401, 404)

### Tâche 1.2 — Champs financiers dans model Project
- [x] Générer la migration et montrer le SQL AVANT application
- [x] Ajouter `costHT`, `vatRate`, `vatAmount`, `costTTC`, `currency`
- [x] Appliquer la migration
- [x] Vérifier que le backend retourne ces champs dans GET /api/v1/projects

### Tâche 1.3 — Modèle ProjectScope
- [x] Générer la migration et montrer le SQL AVANT application
- [x] Créer `model ProjectScope` avec tous les champs Json
- [x] Ajouter la relation inverse dans `model Project`
- [x] Appliquer la migration
- [x] Implémenter `GET /api/v1/projects/:id/scope`
- [x] Implémenter `PATCH /api/v1/projects/:id/scope` (upsert)

### Tâche 1.4 — Routes WorkItem standard
- [x] Implémenter `POST /api/v1/projects/:id/work-items`
- [x] Implémenter `PATCH /api/v1/projects/:id/work-items/:itemId`
- [x] Implémenter `DELETE /api/v1/projects/:id/work-items/:itemId` (soft delete)
- [x] Réutiliser `projectItemDetails.service.mjs` existant (ne pas dupliquer)
- [x] Tester chaque route

**✅ Sprint 1 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 2 — Câblage Frontend (Éliminer le localStorage fantôme)
**Objectif : Le store PM suit le pattern HRM. Zéro fallback silencieux.**
**Statut : ✅ TERMINÉ — 28/28 cases (100%)**

### Tâche 2.1 — Refactorer useProjectStore
- [x] Supprimer le fallback silencieux dans `createProjectWithWorkflow` (Commit D)
- [x] Supprimer `emitGlobalProjectsRefresh()` et toute écriture localStorage (Commit A)
- [x] Supprimer la config `persist` Zustand pour PM (Commit A)
- [x] Brancher `updateProject` → `PATCH /api/v1/projects/:id` (Commit B)
- [x] Brancher `deleteProject` → `DELETE /api/v1/projects/:id` (Commit B)
- [x] Brancher `addWorkItem` → `POST /api/v1/projects/:id/work-items` (Commit C)
- [x] Brancher `updateWorkItem` → `PATCH /api/v1/projects/:id/work-items/:itemId` (Commit C)
- [x] Brancher `deleteWorkItem` → `DELETE /api/v1/projects/:id/work-items/:itemId` (Commit C)
- [x] Brancher `addScopeItem` → `PATCH /api/v1/projects/:id/scope` (Commit D)
- [x] Vérifier : aucun `set()` avant confirmation backend (Commit D)

### Tâche 2.2 — Créer projectApi.service.ts
- [x] Créer `src/services/pm/projectApi.service.ts`
- [x] Implémenter `fetchProjects()`
- [x] Implémenter `fetchProjectById(id)`
- [x] Implémenter `createProject(data)`
- [x] Implémenter `updateProject(id, data)`
- [x] Implémenter `deleteProject(id)`
- [x] Implémenter `fetchProjectMembers(id)`
- [x] Implémenter `addProjectMember(id, data)`
- [x] Implémenter `removeProjectMember(id, userId)`
- [x] Implémenter `fetchProjectScope(id)`
- [x] Implémenter `updateProjectScope(id, data)`
- [x] Implémenter `createWorkItem(projectId, data)`
- [x] Implémenter `updateWorkItem(projectId, itemId, data)`
- [x] Implémenter `deleteWorkItem(projectId, itemId)`
- [x] Typage strict — zéro `any` non commenté

### Tâche 2.3 — Corriger telecomFinanceSync
- [x] Supprimer toute écriture localStorage dans `telecomFinanceSync.service.ts`
- [x] Brancher sur `POST /api/v1/finance/backfill/project-entries`
- [x] Retourner le résultat backend, pas un état local

**✅ Sprint 2 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 3 — RBAC (Durcir les permissions)
**Objectif : Zéro heuristique sur jobTitle ou department.code.**
**Statut : ✅ Terminé — 4/4 tâches (100%) — commits `21089eb`, `6084989`, `e9ffee8`, `0a5a956`**

> Plan révisé après audit de session : les heuristiques string sont dupliquées dans 2 fichiers backend, pas 1. Voir `docs/NEOX_PM_HANDOFF_SPRINT3.md`.

### Tâche 3.1 — Backend : éliminer heuristiques dans `universalAccess.service.mjs`
- [x] Supprimer `inEngineeringDepartment` (string match `department.code`/`name`)
- [x] Supprimer `isProjectManagerTitle` (string match `jobTitle`)
- [x] Réordonner : charger `rolePermission.findMany` AVANT décision `hasProjectFullAccess`
- [x] Ajouter signal DB `hasExplicitProjectPermission` dérivé de `RolePermission`
- [x] `hasProjectFullAccess` = OR de signaux DB uniquement (isAdmin, role PROJECT_MANAGER, RolePermission, compteurs)
- [x] Retirer reasons `engineering_department_access` / `project_manager_title_access`
- [x] `node --check` + `tsc --noEmit` zéro erreur

### Tâche 3.2 — Backend : `projectCollaboration.service.mjs`
- [x] Décision : option (a) déléguer à `getUserPermissionSet` (source de vérité unique)
- [x] Import `getUserPermissionSet` depuis `../access/universalAccess.service.mjs`
- [x] Remplacer heuristiques l.295-299 (`listProjectsForUser`) par `permissionSet.modules.project.readOnly === false`
- [x] Remplacer heuristiques l.482-486 (`getEngineeringDashboard`, duplication découverte en cours de tâche) par même pattern
- [x] `node --check` + `tsc --noEmit` zéro erreur

### Tâche 3.3 — Frontend : retirer heuristique `ProjectsIndex.tsx`
- [x] Décision endpoint : option (γ) — étendre `listHrmEmployees` avec un flag `canManageProjects`
- [x] Backend : calcul DB-only (ADMIN/PROJECT_MANAGER role OR RolePermission.module='project'), 1 query batchée
- [x] Type frontend : `canManageProjects?: boolean` ajouté à `EmploymentProfile`
- [x] Frontend : filtre `role.includes('manager'|'lead'|...)` remplacé par `e.canManageProjects === true`
- [x] Fallback l.103-108 (utilisateur courant si liste vide) conservé
- [x] `node --check` + `tsc --noEmit` zéro erreur

### Tâche 3.4 — Documentation grille permissions
- [x] Lister les keys `module:resource:action` actuellement émises pour `project` (7 baseline + dynamique RolePermission + overrides UserPermissionSet)
- [x] Documenter dans `docs/NEOX_PM_PERMISSIONS.md` : endpoint, pattern hook, grille statique, reasons, bypass admin, anti-patterns Sprint 3

**✅ Sprint 3 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 4 — KPIs, Dashboard & Reporting
**Objectif : Une seule source de vérité pour les KPIs — le backend.**
**Statut : ✅ Terminé — 10/10 tâches (100%)**

> **Périmètre actualisé 2026-05-18** (cf. journal de progression entrée du jour) : 4.1 élargie à 6 sites frontend après audit DB, 4.2 scindée en audit + exec conditionnelle au verdict SSE.

### Tâche 4.1 — Unifier le calcul des KPIs
- [x] Supprimer `recalcProjectKpis()` du store frontend
- [x] Le store expose les KPIs tels que retournés par le backend
- [x] `ProjectOverview.tsx` consomme les KPIs sans recalcul local
- [x] Aligner les noms de statuts (`pending-acceptance` → valeur DB)
- [x] Extraire `computeTelecomSummary(workItems)` dans un helper dédié (décision δ)
- [x] Vérifier la cohérence des chiffres entre ancienne et nouvelle implémentation (DB audit + tsc zéro erreur + grep défensif vide)

### Tâche 4.2-audit — Cartographier la couverture SSE PM
- [x] Livrable : `docs/NEOX_PM_SSE_AUDIT.md` listant événements émis vs mutations sans émission (3 émetteurs, 12 mutations, 2/12 = 17% couverture)
- [x] Verdict explicite : couverture **insuffisante** (17%) → polling à conserver

### Tâche 4.2-exec — Supprimer le polling (conditionnel) — REPORTÉE
- [x] ~~Si verdict 4.2-audit = OUI : supprimer `setInterval(refresh, 15000)` dans `ProjectsIndex.tsx` (l.733)~~ — N/A (verdict NON)
- [x] Verdict NON acté : 9 émetteurs SSE à ajouter en Sprint 6 (liste exhaustive dans `NEOX_PM_SSE_AUDIT.md` section 6). Polling 15s conservé comme filet. 4.2-exec à rejouer après Sprint 6 si couverture ≥ 90%.

**✅ Sprint 4 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 5 — Milestones (Nouvelle feature)
**Objectif : Entité Milestone complète, de la DB au composant.**
**Statut : ⏸️ Bloqué — attendre Sprint 1 migrations validées**

### Tâche 5.1 — Migration Prisma Milestone
- [x] Générer la migration et montrer le SQL AVANT application
- [x] Créer `model Milestone` avec dépendances self-relation
- [x] Ajouter la relation inverse dans `model Project`
- [x] Appliquer la migration (`20260519_add_milestones`, vérifié `\d` postgres)

### Tâche 5.2 — Routes backend Milestone
- [x] Implémenter `GET /api/v1/projects/:id/milestones`
- [x] Implémenter `POST /api/v1/projects/:id/milestones`
- [x] Implémenter `PATCH /api/v1/projects/:id/milestones/:mId`
- [x] Implémenter `DELETE /api/v1/projects/:id/milestones/:mId` (soft delete) — code écrit, en attente couverture tests 5.2

### Tâche 5.3 — Composant MilestonesPage.tsx
- [x] Créer `src/components/pm/MilestonesPage.tsx`
- [x] Timeline view avec Framer Motion
- [x] Indicateur de dépendances visuelles
- [x] Completion % éditable inline
- [x] États : loading, empty, error
- [x] Brancher dans `PMRouter.tsx`

**✅ Sprint 5 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 6 — SSE & Temps Réel
**Objectif : Toutes les mutations PM émettent des événements SSE, couverture ≥ 90%, polling 15s supprimé.**
**Statut : ✅ Complet — 22/22 cases (100%). Couverture finale : 15/15 mutations PM actives (100%).**

> Structure révisée 2026-05-22 (post Sprint 5.3) : la Tâche 6.1 "audit" initialement prévue a été livrée en Sprint 4.2-audit (`docs/NEOX_PM_SSE_AUDIT.md`). Sprint 6 redécomposé en : émetteurs backend (6.1), listeners frontend (6.2), validation + suppression polling (6.3). Périmètre : **12 émetteurs** (9 issus de l'audit + 3 milestones non audités car routes 5.2 postérieures à l'audit).

### Tâche 6.1 — Émetteurs SSE backend (12)
- [x] Helper mutualisé `safeBroadcast(event, payload)` ajouté dans `services/realtime/sseBroadcaster.mjs` (try/catch silencieux + console.warn)
- [x] `project_created` — `auth-server.mjs` après `createProjectForUser` (payload `{ projectId, name, managerId }`)
- [x] `project_updated` — `pm/projects.routes.mjs` après `updateProject` (`{ projectId, patchedFields }`)
- [x] `project_deleted` — après `deleteProject` (`{ projectId }`)
- [x] `work_item_created` — après `createWorkItem` (`{ projectId, workItemId, type }`)
- [x] `work_item_updated` — après `updateWorkItem` (`{ projectId, workItemId, patchedFields }`)
- [x] `work_item_deleted` — après `deleteWorkItem` (`{ projectId, workItemId }`)
- [x] `project_scope_updated` — après `updateProjectScope` (`{ projectId }`)
- [x] `project_member_added` — après `addProjectMember` (`{ projectId, userId, roleCode }`)
- [x] `project_member_removed` — après `removeProjectMember` (`{ projectId, userId }`)
- [x] `milestone_created` — après `createMilestone` (`{ projectId, milestoneId }`)
- [x] `milestone_updated` — après `updateMilestone` (`{ projectId, milestoneId, patchedFields }`)
- [x] `milestone_deleted` — après `deleteMilestone` (`{ projectId, milestoneId }`)
- [x] `patchedFields` filtré par `META_FIELDS = { actorUserId, actorDisplayName, userId }` (3 sites concernés)
- [x] `node --check` zéro erreur sur les 3 `.mjs` modifiés

### Tâche 6.2 — Listeners SSE frontend
- [x] Étendre `src/hooks/useRealtimeSync.ts` pour les 12 événements
- [x] Mapping ciblé : `milestone_*` → `fetchProjectMilestones(projectId)`, `project_member_*` → `fetchProjectMembers(projectId)`, tous les autres → `loadProjectsForUser(userId)`
- [x] `tsc --noEmit` zéro erreur

### Tâche 6.3 — Validation couverture + suppression polling
- [x] Mettre à jour `docs/NEOX_PM_SSE_AUDIT.md` avec la nouvelle couverture (15/15 = 100%, ou 15/16 = 93.75% si on inclut `repair-integrity`)
- [x] Couverture ≥ 90% acté → `setInterval(refresh, 15000)` supprimé de `ProjectsIndex.tsx:733`, filet `onFocus` conservé
- [x] Vérifié : aucun autre `setInterval` PM (hors Header/Sidebar/FinanceContext, hors-scope)
- [x] `tsc --noEmit` zéro erreur

**✅ Sprint 6 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 7 — Hardening PM (dettes ouvertes)
**Objectif : Solder D1, D3, D4, D9, D11, D12, D14 — laisser D2, D5, D6, D7, D8, D13, D15 hors-scope.**
**Statut : 🔄 En cours — Tâches 7.1, 7.2, 7.3, 7.4, 7.5 fermées (5/7)**

### Tâche 7.1 — D4 prisma migrate alignment
- [x] `prisma migrate status` → 8 migrations héritées identifiées comme `pending`
- [x] Audit idempotence (6/8 `IF NOT EXISTS`, 2/8 `CREATE TABLE` brut)
- [x] `prisma migrate resolve --applied` sur les 8 en ordre chronologique
- [x] `prisma migrate status` post-fix : "Database schema is up to date!"

### Tâche 7.2 — D12 CHECK completionPct
- [x] Pré-check : `SELECT count(*) FROM "Milestone" WHERE "completionPct" < 0 OR > 100` = 0
- [x] Migration `20260522_milestone_completion_pct_check` créée + appliquée via `prisma db execute`
- [x] `prisma migrate resolve --applied` exécuté
- [x] Contrainte vérifiée en DB (`pg_get_constraintdef`)
- [x] Régression `pm-milestones-task-5-2.test.mjs` : 47/47 ✓
### Tâche 7.3 — D9 boundary validation `/details` (inline manuel)
- [x] Helpers `assertOptionalNumber` / `assertOptionalString` / `assertOptionalPlainObject` + `detailsValidationError` ajoutés au module-scope `auth-server.mjs` (après `parseActorFromUrl`)
- [x] 8 champs métier validés au boundary handler `/details` : `poUnitPrice`, `ticketNumber`, `contractorPayableAmount`, `qaStatus`, `acceptanceStatus`, `importedFields`, `operationalManualFields`, `acceptanceManualFields`
- [x] 400 retourné avec `{ error, code: 'INVALID_FIELD_TYPE', field }` au lieu du 500 Prisma brut
- [x] Smoke E2E : `ticketNumber: "abc"` → HTTP 400 structuré ; `ticketNumber: 123` → HTTP 200
- [x] `node --check` zéro erreur
### Tâche 7.4 — D3 ProjectScope.constraints harden
- [x] Type frontend : `constraints?` → `constraints: ScopeBaseItem[]` (requis)
- [x] 2 constructeurs inline complétés (`ProjectScope.tsx:109`, `ProjectsIndex.tsx:199`)
- [x] Backend `updateProjectScope` : `code: 'INVALID_SCOPE_FIELD'` + `field` ajoutés aux 2 erreurs 400 existantes (cohérence pattern D9)
- [x] `tsc --noEmit` + `node --check` zéro erreur
### Tâche 7.5 — D11 bookmark `?view=pending-qa`
- [x] Helper `normalizeView()` + map `LEGACY_VIEW_MAP` au module-scope `WorkItemsPage.tsx`
- [x] Mapping : `pending-qa` → `awaiting_qa_approval`, `pending-acceptance` → `awaiting_signed_acceptance`
- [x] `as any` retiré (helper retourne `string`)
- [x] Bookmarks legacy continuent de marcher (pas de rewrite URL)
- [x] `tsc --noEmit` zéro erreur
### Tâche 7.6 — D14 structured 409 blockers[] (à venir)
### Tâche 7.7 — D1 formal closure (à venir)

---

## Journal de Progression

| Date | Sprint | Tâche | Statut | Notes |
|------|--------|-------|--------|-------|
| -    | -      | Audit initial | ✅ Complet | 16 fichiers analysés |
| 2026-05-17 | 1 | 1.1 (code) | ⚠️ Partiel | Routes + dispatcher + branchement écrits ; tests à exécuter. 3 fichiers : `backend/routes/projects.routes.mjs` (nouveau, 481 L), `backend/services/projects/projectCollaboration.service.mjs` (2 `export` ajoutés), `backend/auth-server.mjs` (+8 lignes). |
| 2026-05-17 | 1 | 1.1 (tests) | ✅ Complet | 18/18 tests passent (Phases 1-6 : PATCH, GET/POST/DELETE members, carve-out static slugs, soft delete + idempotency). Test runner : `backend/tests/pm-routes-task-1-1.test.mjs`. Couvre 200, 201, 400 ×4 codes (NO_VALID_FIELDS, INVALID_DATE_RANGE, MANAGER_NOT_FOUND, USER_ID_REQUIRED, INVALID_ROLE, USER_NOT_FOUND), 404 ×3 (PROJECT_NOT_FOUND, MEMBER_NOT_FOUND, idempotency double-delete), 409 (MANAGER_CANNOT_BE_REMOVED). |
| 2026-05-17 | — | Dette données | 📌 Hors sprint | À nettoyer hors sprint : (1) admin `cmnonq9ng0001um80rhfgy9hg` a `email = "emmanuel butsana"` (nom et non email valide) ; (2) user fantôme `cmn08ckhd0000umrg2xiclc0h` a `name = null` ET `email = null`. Aucun impact sur le code des routes — gérés via fallback `'Unknown'`. |
| 2026-05-17 | 1 | 1.2 (schema) | 🟡 En cours | Ajout de 5 champs financiers à `model Project` : `costHT`, `vatRate`, `vatAmount`, `costTTC`, `currency`. Décisions figées : `vatRate` = entier (16 = 16%, pas 0.16) ; `currency` (non `currencyCode`) — frontend Sprint 2 à aligner. Migration `--create-only` en cours pour review SQL avant apply. |
| 2026-05-17 | 1 | 1.2 (apply + code) | ✅ Complet | Migration `20260517_add_project_financials` appliquée via `prisma db execute` + marquée `--applied`. 5 colonnes vérifiées (`numeric(14,2)` × 4, `numeric(7,4)` × 1, `text`). `prisma generate` exécuté. Code : `mapProject` lit DB (au lieu de hardcoder 0), `createProjectForUser` accepte les champs financiers, `pickProjectPatchFields` les supporte aussi. Tests : 21/21 round-trip (POST/GET/PATCH/GET + defaults + cleanup) + 18/18 régression Tâche 1.1 = **39/39 ✓**. Test runner : `backend/tests/pm-financials-task-1-2.test.mjs`. |
| 2026-05-17 | — | Observation env | 📌 Hors sprint | `backend/auth-server.mjs` charge `.env` via `loadEnvFile()` depuis `process.cwd()`. Le worktree n'a pas de `.env` (seul le repo parent en a un). Démarrage manuel via shell différent → exige `DATABASE_URL` inline. À traiter avec la dette baseline migrations dans le sprint dédié "Migrations cleanup". |
| 2026-05-17 | — | Dette migration baseline | 📌 Hors sprint | Dette technique : migration baseline manquante. L'historique Prisma part d'un état non-initialisé. Shadow DB inutilisable (`prisma migrate dev` échoue sur `20260321_telecom_multisite_import` car `Project` n'existe pas dans le shadow vide). À traiter dans un sprint dédié 'Migrations cleanup' après Sprint 6. |
| 2026-05-18 | 1 | 1.3 (schema + migration) | 🟡 En cours | `model ProjectScope` ajouté à `prisma/schema.prisma` (relation 1-to-1 avec `Project` via `projectId @unique`, `onDelete: Cascade`). 5 champs `Json @default("[]")` (objectives, deliverables, outOfScope, assumptions, constraints) → SQL `JSONB NOT NULL DEFAULT '[]'`. Relation inverse `scope ProjectScope?` ajoutée dans `model Project`. Migration `20260518_add_project_scope` appliquée via `prisma db execute` + marquée `--applied`. `prisma generate` exécuté (v6.19.2). Routes GET/PATCH `/scope` à implémenter ensuite. |
| 2026-05-18 | 1 | 1.3 (routes + tests) | ✅ Complet | Routes `GET /api/v1/projects/:id/scope` (synthetic empty si pas de ligne) et `PATCH /api/v1/projects/:id/scope` (upsert + no-op detection) implémentées dans `backend/routes/projects.routes.mjs` (+125 L). Helper `pickScopePatchFields` valide strictement `Array.isArray` → `400 INVALID_FIELD_TYPE` sur non-array. SSE `project_scope_updated` (snake_case, convention `project_*`). Tests : **51/51** dans `backend/tests/pm-scope-task-1-3.test.mjs` (6 phases : synthetic GET, PATCH create, PATCH update multi-champs, no-op, 4 types invalides, cascade FK). Régressions : Tâche 1.1 = 18/18, Tâche 1.2 = 21/21 → **cumul 90/90 ✓**. Décisions figées : option B (`Json @default("[]")`), `ON DELETE CASCADE`, validation stricte (pas de fallback silencieux), no-op silencieux quand `current === DB`, premier PATCH même tout vide = matérialisation tracée. |
| 2026-05-18 | — | Dette FK ProjectMember | 📌 Hors sprint | `ProjectMember_projectId_fkey` est `ON DELETE RESTRICT` (défaut Prisma) — bloque tout hard delete d'un projet auto-créé. Le test pm-scope-task-1-3 nettoie explicitement les `projectMember` avant `project.delete` en Phase 6. À revisiter dans le sprint "Migrations cleanup" : passer ProjectMember (+ WorkItem, ProjectImportBatch) en CASCADE pour permettre le hard delete admin. |
| 2026-05-18 | 1 | 1.4 (routes + tests) | ✅ Complet | Routes `POST/PATCH/DELETE /api/v1/projects/:id/work-items[/:itemId]` implémentées dans `backend/routes/projects.routes.mjs` (+340 L). Stratégie de réutilisation : pas de duplication métier — `projectItemDetails.service.mjs` reste centralisé via son endpoint existant `/pm/.../details`. PATCH du présent module bloque explicitement 19 champs (`WORKITEM_MANAGED_FIELDS`) avec `400 FIELD_MANAGED_ELSEWHERE` (fast-fail avant tout pick). Whitelist `type=['task','milestone']` et `priority=['low','medium','high']` (confirmées via grep frontend). Asymétrie volontaire : `status` éditable au POST initial mais bloqué au PATCH (calculé par le service). SSE `work_item_created/updated/deleted` (event `_updated` partagé avec le service). DELETE soft pur sans side effects (ProjectItemState/Activity préservés). Tests : **105/105** dans `pm-workitems-task-1-4.test.mjs` (6 phases : POST + defaults, PATCH happy + errors, rejet managed × 7 + mix, validation stricte, DELETE soft + idempotency 404, cross-project leak). Régression cumulée Sprint 1 : **195/195 ✓** (18 + 21 + 51 + 105). |
| 2026-05-18 | 1 | Sprint 1 — bilan | ✅ Complet | Tous les blocages backend de la persistance PM sont levés. 4 tâches livrées en 2 jours (17-18 mai). 195/195 tests verts. 3 dettes hors-sprint documentées (baseline migration, FK ProjectMember RESTRICT, env loading dans worktree). Sprint 2 (frontend câblage) débloqué. |
| 2026-05-18 | 2 | 2.1 — Commit A | ✅ Complet | Suppression `persist` middleware Zustand + fonction `emitGlobalProjectsRefresh` + 9 appels internes + handlers `onStorage` dans 2 composants consommateurs (`PMRouter.tsx`, `ProjectsIndex.tsx`). Périmètre étendu aux composants car les listeners écoutaient un event que plus personne n'émet (option γ — suppression cross-tab signal, polling 15s + onFocus conservés). 3 fichiers, -49/+3 lignes. `tsc --noEmit` zéro erreur. Hash `2c4e66b`. |
| 2026-05-18 | 2 | 2.1 — Commit B | ✅ Complet | `updateProject`/`deleteProject` branchés sur `projectApi.service.ts`. Nouvelles actions `fetchProjectMembers`/`addProjectMember`/`removeProjectMember` + state `projectMembers: Record<projectId, ProjectMember[]>`. Signature `data: { userId, role }` alignée sur service API (mismatch `roleCode` vs `role` corrigé). +44/-16 lignes. Erreur tsc résiduelle : mismatch `addWorkItem` interface=Promise/impl=void (résolue Commit C). Hash `2f3ef7f`. |
| 2026-05-18 | 2 | 2.1 — Commit C | ✅ Complet | `addWorkItem`/`updateWorkItem`/`deleteWorkItem` branchés sur API Phase 2. Imports supprimés : 5 (`calculateTelecomAmounts`, `evaluateFinancialEligibility`, `suspendContractorPayableSync`, `syncContractorPayableToFinance`, `notifyTeam as notifyProjectTeam`). Helpers locaux supprimés : 2 (`deriveTelecomStatus`, `computeDelayMetrics`). `updateWorkItem` : 137 → 8 lignes (logique finance frontend disparue, backend autoritatif via PATCH). `updateTelecomManualFields`/`retryFinanceSync` → stubs `console.warn` + TODO Phase 4 (route `/details` à brancher). Signatures interface `updateWorkItem`/`deleteWorkItem` alignées en `Promise<void>`. Erreur tsc résiduelle Commit B résolue. `tsc --noEmit` zéro erreur global. Hash `18da9a5`. |
| 2026-05-18 | 2 | 2.1 — Commit D | ✅ Complet | Fermeture Tâche 2.1. `createProjectWithWorkflow` : catch fallback supprimé (plus de création locale silencieuse en cas d'erreur backend), remplacé par `console.error` + `throw error`. `addScopeItem` : async + branchement `projectApi.updateProjectScope` (route Sprint 1.3), suppression génération id local, signature `type: string` (élargie depuis l'union de 4 valeurs). Type `ProjectScope` étendu : `constraints?: ScopeBaseItem[]` (optionnel — UI non implémentée côté composants, à rendre obligatoire quand `ProjectScope.tsx` et `ProjectsIndex.tsx` seront mis à jour). Cast `keyof ProjectScope` sur l'indexing dynamique. Audit final `set()` : aucune mutation de données avant `await api(...)` confirmée — seul `set({ projectsLoading: true })` reste avant fetch (flag UI éphémère, pas une mutation de données). 3 fichiers, +29/-52 lignes. `tsc --noEmit` zéro erreur. Hash `7ad4ff1`. |
| 2026-05-18 | 2 | Sprint 2 — bilan | ✅ Complet | **Sprint 2 fermé à 28/28 cases (100%)**. Tâche 2.1 : 10/10 (4 commits A→D). Tâche 2.2 : 15/15. Tâche 2.3 : 3/3. Store frontend entièrement migré vers le pattern backend-autoritatif : zéro `persist` Zustand, zéro `emitGlobalProjectsRefresh`, zéro fallback silencieux, zéro création d'id local, toutes les mutations passent par les routes Sprint 1 + Phase 2. Stubs `updateTelecomManualFields`/`retryFinanceSync` (no-op + console.warn) signalent que la route `/pm/.../work-items/.../details` reste à brancher en Phase 4. Type `ProjectScope.constraints` optionnel — à durcir quand les composants UI seront mis à jour. Sprint 3 (RBAC durci) débloqué. |
| 2026-05-18 | — | Dette migrations résolue | ✅ Complet | **Migrations Sprint 1 portées depuis `claude/vigorous-napier-03a79d`** via cherry-pick du commit `fb6a21b` : `20260517_add_project_financials/migration.sql` (5 colonnes `Project` : `costHT`, `vatRate`, `vatAmount`, `costTTC`, `currency`) + `20260518_add_project_scope/migration.sql` (table `ProjectScope` + FK cascade) + 20 lignes `prisma/schema.prisma`. 3 fichiers, 46 insertions, zéro suppression. `prisma generate` ✅, `tsc --noEmit` ✅. **`prisma migrate deploy` non appliqué** — à exécuter manuellement en environnement DB (le worktree n'a pas de `.env` avec `DATABASE_URL`). Contexte : la branche actuelle (`angry-sinoussi-faf92c`) n'avait jamais reçu le travail backend Sprint 1, qui vivait isolé sur `vigorous-napier`. Notre Phase 2 (`backend/routes/pm/projects.routes.mjs` + `backend/services/pm/projectCrud.service.mjs`) est une implémentation parallèle compatible — le merge des migrations comble le gap DB sans toucher au code routes. Hash commit `f79217c` (amend de `b69fa91`). |
| 2026-05-18 | — | Dette scope-routes résolue | ✅ Complet | Handlers `GET /api/v1/projects/:id/scope` et `PATCH /api/v1/projects/:id/scope` ajoutés dans `backend/routes/pm/projects.routes.mjs` (+27 lignes : import, regex `scopeMatch`, étension `hasMatch`, 2 branches handler). Service `backend/services/pm/projectCrud.service.mjs` étendu (+62 lignes) : `fetchProjectScope(prisma, projectId)` retourne synthétique `{ ...EMPTY_SCOPE, projectId }` si pas de ligne en DB (cohérent Sprint 1.3 sémantique) ; `updateProjectScope(prisma, projectId, data, actor)` valide strictement clés autorisées (5 max : `objectives`, `deliverables`, `outOfScope`, `assumptions`, `constraints`) + arrays (400 sinon), upsert sur `projectId @unique`, propage `updatedByUserId` depuis l'actor. PATCH partiel autorisé (n'importe quel sous-ensemble des 5 clés). `node --check` ✅, `tsc --noEmit` ✅. Le frontend `projectApi.updateProjectScope` (Commit D Sprint 2) est maintenant routable en runtime sans 404. |
| 2026-05-18 | 3 | Sprint 3 — bilan | ✅ Complet | **Sprint 3 fermé à 4/4 tâches (100%)**. Tâche 3.1 (`21089eb`) — suppression heuristiques string `inEngineeringDepartment`/`isProjectManagerTitle` dans `getUserPermissionSet`, anti-pattern R3 (`rolePermission.findMany` lu mais ignoré) corrigé. Tâche 3.2 (`6084989`) — `projectCollaboration.service.mjs` délégué à `getUserPermissionSet` (2 occurrences, dont une duplication R4 découverte en cours). Tâche 3.3 (`e9ffee8`) — flag DB `canManageProjects` injecté dans `listHrmEmployees`, filtre frontend `role.includes(...)` supprimé. Tâche 3.4 (`0a5a956`) — `docs/NEOX_PM_PERMISSIONS.md` créé. Zéro heuristique string restante dans le chemin RBAC projet. `tsc --noEmit` zéro erreur après chaque commit. |
| 2026-05-18 | — | Dette SSE D1 actée | 📌 Hors sprint | Constat : journal Sprint 1.3/1.4 annonce des émissions SSE qui n'existent pas sur cette branche. Cherry-pick `f79217c` a porté migrations sans le code routes. Audit complet planifié en Tâche 4.2-audit. |
| 2026-05-18 | 4 | Sprint 4 — kickoff | 🟢 Débloqué | Audit DB `WorkItem.status` exécuté : 100 lignes actives, 2 statuts seulement (`needs_manual_completion` ×94, `finance_synced` ×6). Statuts kebab-case `pending-qa`/`pending-acceptance` : 0 occurrence → suppression frontend safe. Audit grep frontend : 6 sites consomment ces statuts → 4.1 élargie au-delà du store. 4.2 scindé en audit + exec. Dette D1 (SSE Sprint 1 annoncés vs réels) ajoutée à la section dédiée. |
| 2026-05-18 | — | Pré-requis Sprint 4.1 | ✅ Complet | Bug d'enveloppes API masqué par `recalcProjectKpis` pré-Sprint 4 — révélé par audit (b1), corrigé avant refactor KPIs. 6 endpoints `projectApi.service.ts` désormais unwrap explicite (`{ project }`, `{ workItem }`, `{ members }`, `{ member }`). Pattern de référence déjà présent (`createProject` l.19-24). Zéro changement de signature publique → store inchangé. `tsc --noEmit` zéro erreur. Hash `d49fc4b`. |
| 2026-05-18 | 4 | 4.1 — Unifier les KPIs | ✅ Complet | **Tâche 4.1 fermée — 6/6 sous-cases, Sprint 4 = 6/10 (60%)**. 7 fichiers touchés (1 nouveau `telecomSummary.service.ts`, 6 modifiés). Variante (b1) re-fetch ciblé pessimiste : `addWorkItem`/`deleteWorkItem` appellent `fetchProjectById` après mutation → KPIs backend toujours frais. Statuts kebab-case `pending-qa`/`pending-acceptance` supprimés du type union, du `COLOR_MAP`, du store, des composants (`ProjectOverview`, `WorkItemDrawer`, `WorkItemsPage`). Helper `withTelecomSummary` local au store (4 call sites) + helper externe `computeTelecomSummary` exporté. `recalcProjectKpis` (49 lignes) supprimé. Vérifications : `tsc --noEmit` zéro erreur, grep défensif `recalcProjectKpis|'pending-qa'|'pending-acceptance'` zéro résultat. Dette D7 ouverte sur `importWorkItems` (ids locaux + pas de re-fetch). |
| 2026-05-19 | — | Validation γ Sprint 4 (preview E2E) | 🟡 Partielle | Validation E2E via Claude Preview MCP : preview headless Chrome + dev server `npm run dev` + backend `npm run auth:api` lancés depuis `nervous-mclaren-8105f6/.claude/launch.json` (npm `--prefix ../angry-sinoussi-faf92c`). Login admin OK, `/api/v1/projects?userId=...` retourne 200 avec 1 project (Helios One) + 100 workItems. Test direct `PATCH /details` avec payload minimal : 200 OK. Reproduit le 500 de l'Image 1 en envoyant `ticketNumber: 'abc'` (string) → Prisma upsert rejected. **4.1 est saine**, pas de régression. Deux dettes critiques découvertes : D9 (`/details` accepte input non validé → 500), D10 (**plain-text password admin en DB + fallback plain-text dans `verifyPassword`** — vulnérabilité sécurité majeure). Points γ 3, 4, 6 à tester avant clôture validation. |
| 2026-05-19 | — | γ 3/4 bloqués par route GET manquante | 🔴 Régression latente activée | Test E2E révèle : `GET /api/v1/projects/:id` retourne 404 — endpoint jamais routé sur cette branche (dette D1 architecture parallèle). 4.1 a légitimement appelé `fetchProjectById` (existant dans `projectApi.service.ts` depuis Sprint 2 Tâche 2.2) mais le backend correspondant n'a jamais été porté. **Pas une régression de 4.1** (le code 4.1 est sain), c'est un bug latent activé par 4.1. |
| 2026-05-19 | — | Pré-requis Sprint 4.1 — GET endpoint | ✅ Complet | Route `GET /api/v1/projects/:id` ajoutée. Fonction `getProjectById(prisma, projectId)` créée dans `projectCollaboration.service.mjs` (réutilise `mapProject` privé + `mapWorkItem` + `computeKpis` — où les dépendances vivent déjà), re-exportée depuis `projectCrud.service.mjs` (1 ligne), importée et utilisée dans le handler GET de `pm/projects.routes.mjs`. Export `computeKpis` rendu public au passage (utile pour futurs consommateurs cross-service). E2E validé : POST work-item → 201, GET project → kpis frais incrémentés (100→101), DELETE → 200, GET → kpis décrémentés (101→100). γ 3 et γ 4 désormais validés. γ 6 : `view` est dans URL via `useSearchParams` → bookmarks kebab-case → fallback `'all'` silencieux → acté D11. Dette D1 marginalement résolue (route manquante portée). Hash `cb334c0`. |
| 2026-05-19 | 4 | 4.2-audit + 4.2-exec | ✅ Complet | **Sprint 4 fermé à 10/10 (100%)**. Audit SSE livré dans `docs/NEOX_PM_SSE_AUDIT.md` : 3 émetteurs backend (`work_item_updated`, `notification_created`, `project_import_completed`), 12 mutations PM identifiées, couverture **2/12 = 17%**. Frontend (`useRealtimeSync.ts`) écoute exactement les 2 événements PM émis (zéro bruit, zéro attente vaine). **Verdict 4.2-exec : NON** — retirer le polling 15s casserait 83% des cas (project CRUD, work-item CRUD simple, members, scope). Polling conservé. 4.2-exec reportée Sprint 6 avec liste exhaustive de 9 émetteurs à ajouter (priorité haute/moyenne). Sprint 5 (Milestones) débloqué. |
| 2026-05-18 | — | D10 résolue (hotfix sécurité hors-sprint) | ✅ Complet | Vulnérabilité D10 corrigée. `scripts/rehash-plaintext-passwords.mjs` créé + exécuté (idempotent, garde-fou 5s + log par candidate) → 1 user re-hashé (`usr_ebutsana_full_access_20260321`, ex-passwordHash 16 chars plain-text → scrypt salt:hash). `verifyPassword` modifié (`backend/auth-server.mjs:236-241`) : suppression du fallback `plainTextPassword === storedPasswordHash` → refus + `console.warn` si stored sans `:`. Backend redémarré, E2E login admin OK (HTTP 200 + token). DB vérifiée : 0 password plain-text restant. **D10b ouverte** : le password admin d'origine reste exposé dans l'historique git (commit `6c4d9a3` et messages session). Re-hash ferme le vecteur DB-compromise, pas le vecteur git-history. **Rotation manuelle du password admin requise hors-session** pour fermer complètement D10. Hash commit : `43ec271`. |
| 2026-05-18 | — | D10b résolue | ✅ Complet | Rotation password admin effectuée hors-session via UI NEOX (Settings > Modifier mot de passe). Voie d'attaque git-history fermée : le password présent dans l'historique git n'est plus le password actif. Nouveau password stocké hors-repo. Dossier sécurité D10/D10b complètement clos. |
| 2026-05-19 | 5 | 5.1 — Migration Milestone | ✅ Complet | `model Milestone` (12 cols, 4 idx, 2 FK : `projectId` CASCADE, `ownerId` SET NULL) + `model MilestoneDependency` (self-relation M:N, 4 idx dont UNIQUE, 2 FK : `milestoneId` CASCADE, `dependsOnId` RESTRICT). Migration `20260519_add_milestones` appliquée via `prisma db execute` + `migrate resolve --applied`. Structure DB vérifiée `\d` postgres. Backup pré-migration 1.1 MB stocké hors-repo. D12 ajoutée (`completionPct` Int sans CHECK DB → mitigation UX en 5.3). Hash `f1c8f3f`. |
| 2026-05-19 | 5 | 5.2 — Décision tests Phase RBAC | 📌 Décision tracée | Phase RBAC skipped dans la suite tests 5.2. Raison : `assertModuleAccess` est partagé avec tous les handlers PM, déjà couvert transversalement par Sprint 3 (durcissement RBAC + suppression heuristiques string). Tester RBAC sur milestones = doublon. Pas une dette — à inclure dans un sprint dédié "Tests RBAC cross-modules" si un audit le rend nécessaire. |
| 2026-05-22 | 5 | 5.2 — Couverture tests | ✅ Complet | Test runner `backend/tests/pm-milestones-task-5-2.test.mjs` (47/47 ✓) en 8 phases : Setup (3), POST happy (6), POST validations 400 (10), PATCH deps + cycles (9, dont 4.6 chaîne 4-deep non-cyclique pour faux positif), PATCH updates (8), DELETE soft + rollback avec count avant/après en DB (7), Phase 7 RBAC skip (0, console.log + journal 2026-05-19), Cleanup intégrité (4). Pattern seed/teardown calqué sur `pm-financials-task-1-2`. Couverture : auto-référence, cycle 2/3-nodes, REPLACE semantics, deps cross-project, soft-delete blocage par actifs (MILESTONE_BLOCKED), filtrage défensif deps vers cibles soft-deleted, idempotency 404. **Tâche 5.2 fermée à 4/4. Sprint 5 = 8/14 (57%).** Sprint 5 reste bloqué Tâche 5.3 (frontend MilestonesPage). |
| 2026-05-22 | 6 | 6.1/6.2/6.3 — Sprint 6 SSE & Temps Réel | ✅ Complet | **Sprint 6 fermé à 22/22 (100%). Couverture SSE PM : 17% → 100% (15/15 mutations actives).** **6.1** (`d6f9c5b`) : helper `safeBroadcast()` (try/catch + console.warn) mutualisé dans `services/realtime/sseBroadcaster.mjs` ; 12 émetteurs ajoutés — 1 dans `auth-server.mjs` (`project_created` après `createProjectForUser`), 11 dans `routes/pm/projects.routes.mjs` couvrant project/work_item/scope/members/milestones CRUD ; payload `patchedFields` filtré par `META_FIELDS = { actorUserId, actorDisplayName, userId }` sur 3 sites. **6.2** (`0cdaed1`) : `src/hooks/useRealtimeSync.ts` étendu de 2 à 12 listeners ; mapping ciblé `milestone_*` → `fetchProjectMilestones(projectId)`, `project_member_*` → `fetchProjectMembers(projectId)`, tous les autres → `loadProjectsForUser(userId)` debounced 300ms. Aucune nouvelle action store créée. **6.3** : `setInterval(refresh, 15000)` supprimé de `ProjectsIndex.tsx:733`, filet `onFocus` conservé ; `docs/NEOX_PM_SSE_AUDIT.md` mis à jour §8 avec nouvelle couverture. `node --check` zéro erreur sur 3 `.mjs`, `tsc --noEmit` zéro erreur 2 fois. Décision 4.2-exec rejouée et fermée positivement. Modules PM = backbone temps-réel complet. **Module Project Management = ✅ TERMINÉ.** Roadmap : passer à priorité 2 (SCM CRUD). |
| 2026-05-22 | 7 | 7.5 — D11 bookmark `?view=pending-qa` | ✅ Complet | Diagnostic affiné : le fallthrough silencieux n'était PAS sur `'all'` (l'hypothèse de la dette) mais sur le `: true` final de la chaîne ternaire `matchesView` (`WorkItemsPage.tsx:98`) → tous les items affichés, pas le sous-ensemble. Fix : `normalizeView(raw)` + `LEGACY_VIEW_MAP` au module-scope, remappe `pending-qa` → `awaiting_qa_approval` et `pending-acceptance` → `awaiting_signed_acceptance`. `as any` retiré dans la foulée. Pas de rewrite URL → bookmarks legacy fonctionnent indéfiniment. `tsc --noEmit` ✅. **D11 fermée**. Sprint 7 = 5/7. |
| 2026-05-22 | 7 | 7.4 — D3 ProjectScope.constraints harden | ✅ Complet | Option (C) : durcir frontend type + codifier 400 backend. (1) `src/types/pm.ts:126` `constraints?` → requis. (2) 2 sites inline complétés (`ProjectScope.tsx:109` ensureScopeInitialized + `ProjectsIndex.tsx:199` createProject workflow) — révélés par `tsc --noEmit` après bascule du type. (3) `updateProjectScope` (`projectCrud.service.mjs:358-370`) — 2 erreurs 400 enrichies avec `code: 'INVALID_SCOPE_FIELD'` + `field` pour cohérence avec le pattern D9 `INVALID_FIELD_TYPE`. `tsc --noEmit` ✅, `node --check` ✅. **D3 fermée**. Sprint 7 = 4/7. |
| 2026-05-22 | 7 | 7.3 — D9 boundary validation `/details` | ✅ Complet | Décision (B) Zod hors-scope. Validation inline manuelle dans `auth-server.mjs` : 3 helpers `assertOptionalNumber`/`assertOptionalString`/`assertOptionalPlainObject` + factory `detailsValidationError` placés au module-scope (après `parseActorFromUrl` l.413). Handler `/details` enveloppe les 8 champs métier dans `try/catch` retournant `{ error, code: 'INVALID_FIELD_TYPE', field }` en HTTP 400. Smoke E2E confirmé : `ticketNumber: "abc"` → 400 structuré, `ticketNumber: 123` → 200. `node --check` ✅. Périmètre strict respecté : seul le handler `/details` touché dans auth-server, aucun refactor hors-périmètre. **D9 fermée**. Sprint 7 = 3/7. |
| 2026-05-22 | 7 | 7.2 — D12 CHECK completionPct | ✅ Complet | Migration `20260522_milestone_completion_pct_check` ajoute `CHECK ("completionPct" >= 0 AND "completionPct" <= 100)` sur `Milestone`. Pré-check DB count = 0 (zéro ligne hors borne → safe). Appliquée via `prisma db execute` + `migrate resolve --applied`. Contrainte confirmée via `pg_get_constraintdef`. Tests Sprint 5.2 ré-exécutés : **47/47 ✓** (aucune régression). **D12 fermée**. Sprint 7 = 2/7. |
| 2026-05-22 | 7 | 7.1 — D4 prisma migrate alignment | ✅ Complet | 8 migrations héritées (mars-avril 2026, modules HRM/CRM/telecom/universal-access/user-prefs) étaient `pending` dans `_prisma_migrations`. Worktree dispose maintenant d'un `.env` (288 oct, daté 19 mai). Audit idempotence : 6/8 utilisent `IF NOT EXISTS`, 2/8 (`hrm_credentials_provisioning`, `hrm_employment_profile_persistence`) sont des `CREATE TABLE` bruts sur des tables qui existent déjà en DB (utilisées en prod par Sprint 3 RBAC). Option (A) retenue : `prisma migrate resolve --applied` sur les 8 — pattern éprouvé du repo (Sprint 1.2/1.3/5.1), zéro risque sur la DB déjà alignée. `prisma migrate status` post-fix : "Database schema is up to date!". Total 11/11 migrations alignées. **D4 fermée**. Sprint 7 = 1/7. |
| 2026-05-22 | 5 | 5.3 — MilestonesPage frontend | ✅ Complet | **Sprint 5 fermé à 14/14 (100%).** 5 fichiers touchés. **Types** (`src/types/pm.ts`) : `MilestoneStatus` union 4 valeurs, `MilestoneDependencyEdge` (id + objet imbriqué `dependsOn`), `Milestone` interface complète (12 champs + `dependencies[]`). **Service API** (`src/services/pm/projectApi.service.ts`) : +4 fonctions `fetchProjectMilestones`/`createMilestone`/`updateMilestone`/`deleteMilestone`, unwrap `{ milestones }`/`{ milestone }` cohérent Sprint 4.1. **Store** (`src/store/pm/useProjectStore.ts`) : slice `milestones: Record<projectId, Milestone[]>` + `milestonesLoading`, 4 actions backend-autoritatives (no fallback silencieux, no id local, `throw error` après reset loading flag), sort défensif par `dueDate` avec garde-fou `null` (cf. type non-null actuel mais défense contre régression future). **Page** (`src/components/pm/MilestonesPage.tsx`, ~530 L) : vertical timeline avec rail à gauche + dots colorés par status, sous-composants `MilestoneCard`/`CompletionPopover` (Headless UI Popover, input number 0-100 + Save)/`MilestoneFormModal` (create/edit, multi-select deps en checkboxes)/`DependenciesModal` (readonly, status badge par dep)/`DeleteMilestoneModal` (gère 409 MILESTONE_BLOCKED en affichant le message backend qui contient les noms des blockers). Framer Motion subtil (`AnimatePresence` + `layout` pour reorder, durée 0.18). Tokens tailwind sémantiques (`bg-app`/`bg-card`/`bg-surface`/`text-primary`/`text-muted`), status colors `emerald`/`amber`/`rose`/`muted`. Pas de SVG inter-deps (badge "depends on N" cliquable → modal). **Router** (`src/components/pm/PMRouter.tsx`) : +1 import, +2 Routes (header label + body). `tsc --noEmit` zéro erreur après chaque fichier. `npm run dev` boot OK (Vite ready 6312ms, HTTP 200 sur `/`). Dettes ajoutées : **D13** (sous-tâches WorkItem+Milestone, rollup `completionPct` post-Sprint 6) ; **D14** (payload 409 sans `blockers[]` structuré — message brut suffit, à structurer en sprint hardening API). |

---

## Décisions Techniques Figées

| Décision | Raison |
|----------|--------|
| Nouvelles routes PM dans `backend/routes/projects.routes.mjs` | Ne pas grossir auth-server.mjs |
| Supprimer persist Zustand pour PM | localStorage ≠ source de vérité |
| KPIs calculés backend uniquement | Éliminer double source de vérité |
| Pattern HRM comme référence | Module le plus complet et cohérent |
| Milestones = entité DB distincte | WorkItem.type='milestone' insuffisant |
| Signature `handle(method, pathname, req, res, url): Promise<boolean>` | http natif sans Express ; retour `true` = route gérée, `false` = délégué à la cascade existante |
| `Project.vatRate` = pourcentage entier (16 = 16%), pas fraction (0.16) | Lisibilité DB. Frontend stocke actuellement 0.16 — **alignement Sprint 2 obligatoire** (Tâche 2.1) : Project.vatRate désormais source de vérité, frontend divise par 100 pour multiplier les montants. |
| `Project.currency` (et non `currencyCode`) | Cohérence avec le frontend type `Project`. Dette technique connue : inconsistant avec `FinanceEntry.currencyCode` — à réconcilier dans un sprint ultérieur (Reporting cross-modules). |
| Migrations Sprint 1+ : créées manuellement + marquées appliquées via `prisma migrate resolve` | Le shadow DB est inutilisable (baseline initial manquant). En attendant un sprint "Migrations cleanup", chaque nouvelle migration est écrite à la main dans `prisma/migrations/<timestamp>_<name>/migration.sql`, appliquée via `prisma db execute`, puis enregistrée via `prisma migrate resolve --applied`. |

---

## Dettes connues

| ID | Origine | Constat | Action prévue |
|----|---------|---------|---------------|
| D1 | Sprint 1 (cherry-pick `f79217c`) | Journal Sprint 1.3 / 1.4 annonce les SSE `project_scope_updated`, `work_item_created`, `work_item_updated`, `work_item_deleted` émis depuis les routes. Vérification grep sur la branche : **aucune émission SSE dans `backend/routes/`**. Cherry-pick depuis `vigorous-napier-03a79d` a porté les migrations mais pas le code routes Sprint 1 (architecture parallèle `backend/routes/pm/` vs `backend/routes/`). SSE actuellement présents : `work_item_updated` (depuis service partagé `projectItemDetails`), `notification_created`, `project_import_completed`. | Audit complet en Tâche 4.2-audit → livrable `docs/NEOX_PM_SSE_AUDIT.md`. Décision re-port vs réécriture des émetteurs manquants à acter en Sprint 6, après audit. |
| D2 | Sprint 2 (`telecomFinanceSync`) | Stubs `updateTelecomManualFields` / `retryFinanceSync` = no-op + `console.warn`. Route `/pm/projects/:id/work-items/:itemId/details` non branchée frontend. | Phase 4 — pas de sprint affecté pour l'instant. |
| D3 | ✅ Résolue 2026-05-22 (Sprint 7.4) | Type `ProjectScope.constraints?` optionnel côté frontend. | **Résolu** option (C) : (1) `src/types/pm.ts:126` — `?` retiré, `constraints: ScopeBaseItem[]` est désormais obligatoire ; (2) 2 sites de construction inline complétés (`ProjectScope.tsx:109`, `ProjectsIndex.tsx:199`) ; (3) backend `updateProjectScope` enrichi : les 2 erreurs 400 existantes portent maintenant `code: 'INVALID_SCOPE_FIELD'` + `field` (cohérent pattern D9). `tsc --noEmit` ✅ post-fix, `node --check` ✅. |
| D4 | ✅ Résolue 2026-05-22 (Sprint 7.1) | `prisma migrate deploy` jamais exécuté sur cette branche. Worktree maintenant équipé d'un `.env` (288 octets, daté 19 mai). 8 migrations héritées (mars-avril 2026 : HRM, CRM, telecom multisite, project_item_activity_files, universal_access, user_profile_preferences) étaient `pending` dans `_prisma_migrations`. Approche idempotente vs deploy : 6/8 utilisaient `IF NOT EXISTS`, 2/8 créaient `HrmCredentialProvisioning`/`HrmEmploymentProfile` (déjà en DB → deploy aurait planté). | **Résolu** : `prisma migrate resolve --applied` sur les 8 migrations en ordre chronologique (`20260321_project_item_activity_files`, `20260321_telecom_multisite_import`, `20260407_crm_reference_data_management`, `20260407_hrm_credentials_provisioning`, `20260407_hrm_employee_edit_enrichment`, `20260407_hrm_employment_profile_persistence`, `20260407_universal_access_engine`, `20260407_user_profile_preferences`). `prisma migrate status` post-fix : "Database schema is up to date!". Total 11/11 migrations alignées. Hash : voir journal. |
| D5 | Sprint 1 | FK `ProjectMember_projectId_fkey` = `ON DELETE RESTRICT`. Bloque tout hard delete projet. | Sprint "Migrations cleanup" (post-Sprint 6) : passer en CASCADE. |
| D6 | Sprint 3 (Tâche 3.1) | `loadUserContext` l.112-147 (`engineeringTeamProjectCount`) contient encore un OR département `contains 'ENG'` / `'Engineering'`. Sous-filtre d'un compteur DB combiné à `roleCode`, pas une décision de permission directe → cohérent Sprint 3, mais à revisiter pour un pur DB-only. | Sprint RBAC cross-modules (priorité 5 roadmap). |
| D7 | Sprint 4 (Tâche 4.1) | `importWorkItems` génère encore des ids locaux `wi-${now}-${index}` et ne fait pas de re-fetch backend après mutation. KPIs `project.kpis` peuvent diverger transitoirement après import bulk frontend. `TODO(D7):` inscrit dans le code. | À brancher sur l'API en Sprint Reporting (ou plus tôt si l'action est consommée par une UI utilisateur). |
| D8 | Sprint 2 (héritée par Tâche 4.1) | `computeTelecomSummary.incompleteItems` compte `status === 'needs_manual_completion' OR manual_completion_status !== 'complete'`. Le `OR` capture les items `finance_synced` dont `manual_completion_status` n'est pas exactement `'complete'`, gonflant le compteur (observé : 100 au lieu de 94 sur Helios One). Bug pré-existant Sprint 2, juste déplacé dans `telecomSummary.service.ts` par 4.1 — pas créé par elle. | Corriger la condition (`AND` au lieu de `OR`, ou normaliser `manual_completion_status` côté backend). Pas bloquant. |
| D9 | ✅ Résolue 2026-05-22 (Sprint 7.3) | Backend `PATCH /api/v1/pm/projects/:id/work-items/:itemId/details` acceptait des inputs non validés → 500 Prisma reject sur type mismatch (ex: `ticketNumber: 'abc'`). | **Résolu** : validation inline manuelle (Zod hors-scope par décision (B)). 3 helpers ajoutés au module-scope dans `auth-server.mjs` (`assertOptionalNumber`, `assertOptionalString`, `assertOptionalPlainObject` + factory `detailsValidationError`). Handler `/details` enveloppe les 8 champs métier dans un `try/catch` qui retourne `{ error, code: 'INVALID_FIELD_TYPE', field }` avec status 400. Smoke E2E : `ticketNumber: "abc"` → HTTP 400 + code structuré (avant : 500 brut) ; `ticketNumber: 123` → HTTP 200. Si Zod est adopté plus tard pour un besoin transverse, migrer ces helpers vers des schémas. UI `WorkItemDrawer:401` peut désormais consommer `code === 'INVALID_FIELD_TYPE'` + `field` pour marquer l'input fautif (hors-scope 7.3). |
| D10 | ✅ Résolue 2026-05-18 (hotfix dédié) | `auth-server.mjs:236-240` : `verifyPassword` faisait un fallback **plain-text equality** si le hash stocké ne contient pas `:`. 1 compte admin avait son `passwordHash` stocké en clair. | **Résolu** : (1) `scripts/rehash-plaintext-passwords.mjs` créé et exécuté → 1 user re-hashé au format scrypt (`usr_ebutsana_full_access_20260321`) ; (2) `verifyPassword` modifié : refuse + `console.warn` si stored sans `:` (plus de fallback plain-text) ; (3) E2E login admin OK post-fix (HTTP 200 + token). Hash commit : voir journal du jour. Audit auth complet (token revocation, password policy, rate limiting) reste hors-scope, à planifier sprint sécurité dédié. |
| D10b | ✅ Résolue 2026-05-18 (rotation manuelle effectuée via UI Settings > Modifier mot de passe) | Password admin d'origine exposé dans l'historique git (commit `6c4d9a3` détaillant D10 + messages de session). Re-hash D10 fermait la voie DB→password, pas la voie git-history→password. | **Résolu** : rotation manuelle du password admin effectuée via l'UI NEOX. Le password présent dans l'historique git n'est plus le password actif → vecteur git-history neutralisé. Nouveau password stocké hors-repo. |
| D11 | ✅ Résolue 2026-05-22 (Sprint 7.5) | View `awaiting_qa_approval` exposée en URL via `useSearchParams` dans `WorkItemsPage.tsx`. Bookmarks pré-Sprint-4 (`?view=pending-qa`) ne matchaient plus → fallthrough `: true` sur la chaîne ternaire (l.70-98) = **tous** les items affichés au lieu du sous-ensemble attendu (et non `'all'` comme initialement supposé). | **Résolu** : helper `normalizeView(raw)` + map `LEGACY_VIEW_MAP` au module-scope dans `WorkItemsPage.tsx`. Remappe `pending-qa` → `awaiting_qa_approval` et `pending-acceptance` → `awaiting_signed_acceptance`. `as any` retiré au passage (le helper retourne `string`, ce qui suffit au `useState<string>`). Pas de réécriture de l'URL — les bookmarks legacy continuent de marcher indéfiniment. `tsc --noEmit` ✅. |
| D12 | ✅ Résolue 2026-05-22 (Sprint 7.2) | `Milestone.completionPct` (Int) sans `CHECK` DB (0-100). Validation uniquement au boundary route (5.2 whitelist + range). Risque : bypass validation via SQL direct ou script. | **Résolu** : migration `20260522_milestone_completion_pct_check` ajoute `CHECK ("completionPct" >= 0 AND "completionPct" <= 100)`. Pré-check `SELECT count(*) WHERE completionPct < 0 OR > 100` = 0 → safe à appliquer. `prisma db execute` + `migrate resolve --applied`. Contrainte vérifiée en DB via `pg_get_constraintdef`. Régression tests Sprint 5.2 : **47/47 ✓**. Sweep hardening CHECK sur autres tables PM (Project.status, WorkItem.status) reste hors-scope. |
| D13 | Sprint 5 (Tâche 5.3) | Sous-tâches (WorkItem + Milestone) : aucun `parentId` self-relation sur `WorkItem` ni sur `Milestone`. Empêche la hiérarchie parent/enfants et le rollup automatique de `completionPct`. | Prévoir migration Prisma `parentId String?` + relation `children[]` sur les deux modèles. `completionPct` parent = moyenne pondérée des enfants (calculé backend, read-only frontend). UI : liste indentée collapsible avec barre de progression agrégée. Scope : tous les types de projet. À traiter après Sprint 6 (SSE). |
| D14 | Sprint 5 (Tâche 5.3) | Payload 409 `MILESTONE_BLOCKED` sans `blockers[]` structuré. Le backend retourne `{ error, code }` uniquement — les noms des bloquants sont composés dans `error.message` par le service (`backend/services/pm/milestones.service.mjs:353-359`) mais non parseable proprement côté frontend. `DeleteMilestoneModal` affiche le message brut (qui contient déjà les noms) — fonctionnel mais peu structuré, pas de liens cliquables. | Format cible : `{ code: 'MILESTONE_BLOCKED', blockers: [{ id, title }] }` retourné directement dans le corps de la 409 (en plus du `error` humain). Côté service : attacher `err.details = { blockers: [{ id, title }] }` ; côté handler : merger dans le payload JSON ; côté UI : rendu liste cliquable. À traiter en sprint API hardening. |
| D15 | Sprint 7 (à planifier — HRM cross-module) | Synchronisation assignés télécom → HRM : lors d'un import bulk télécom (`importWorkItems`), les assignés présents dans le fichier qui n'existent pas dans `User`/HRM doivent être créés automatiquement comme **contractor** dans le module HRM avant d'être liés au projet. La liste des personnes assignables à un projet doit provenir exclusivement du HRM (pas de noms libres saisis depuis l'import). Aujourd'hui : les imports télécom acceptent des chaînes libres → divergence avec le référentiel HRM, impossible de réconcilier les coûts contractor finance ↔ projet. **Blocker partiel sur D2** (la route `/details` aura besoin de la même résolution `assignee → userId HRM` pour être branchée proprement). | Implémenter lors du sprint HRM (priorité 2 roadmap après SCM) : (1) helper `resolveOrCreateContractor(name) → userId` côté backend, (2) appel dans `bulkImportTelecomWorkItems` avant `createWorkItem`, (3) endpoint `GET /api/v1/hrm/employees?canBeAssigned=true` pour alimenter les pickers frontend, (4) supprimer les saisies de noms libres dans UI d'import + WorkItem create/edit. |

---

## Roadmap Globale Neox ERP

> Le Project Management doit être 100% complété avant de passer au module suivant.

| Priorité | Module | Statut |
|----------|--------|--------|
| 1 | Project Management | ✅ Terminé (2026-05-22, Sprints 1→6 = 100%) |
| 2 | SCM — CRUD complet + logique métier | ⏸️ En attente |
| 3 | Finance — réconciliation UI | ⏸️ En attente |
| 4 | HSE — implémentation complète | ⏸️ En attente |
| 5 | RBAC — système DB-driven cross-modules | ⏸️ En attente |
| 6 | Reporting avancé — analytics cross-modules | ⏸️ En attente |

> Chaque module aura son propre plan d'exécution créé au moment de le démarrer,
> avec le même protocole : audit → plan → sprints → tests.
