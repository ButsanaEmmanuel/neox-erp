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
- [ ] Implémenter `GET /api/v1/projects/:id/milestones`
- [ ] Implémenter `POST /api/v1/projects/:id/milestones`
- [ ] Implémenter `PATCH /api/v1/projects/:id/milestones/:mId`
- [ ] Implémenter `DELETE /api/v1/projects/:id/milestones/:mId` (soft delete)

### Tâche 5.3 — Composant MilestonesPage.tsx
- [ ] Créer `src/components/pm/MilestonesPage.tsx`
- [ ] Timeline view avec Framer Motion
- [ ] Indicateur de dépendances visuelles
- [ ] Completion % éditable inline
- [ ] États : loading, empty, error
- [ ] Brancher dans `PMRouter.tsx`

**✅ Sprint 5 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 6 — SSE & Temps Réel
**Objectif : Toutes les mutations PM émettent des événements SSE.**
**Statut : ⏸️ Bloqué — attendre Sprint 2 complet**

### Tâche 6.1 — Auditer useRealtimeSync
- [ ] Lister tous les événements PM émis côté backend
- [ ] Lister tous les événements PM consommés côté frontend
- [ ] Documenter les gaps dans ce fichier

### Tâche 6.2 — Émettre les événements depuis les nouvelles routes
- [ ] `project:updated` depuis PATCH /projects/:id
- [ ] `project:deleted` depuis DELETE /projects/:id
- [ ] `workitem:created` depuis POST /work-items
- [ ] `workitem:updated` depuis PATCH /work-items/:id
- [ ] `workitem:deleted` depuis DELETE /work-items/:id
- [ ] `scope:updated` depuis PATCH /scope
- [ ] `milestone:updated` depuis PATCH /milestones/:id

**✅ Sprint 6 terminé quand : toutes les cases ci-dessus sont cochées**

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
| D3 | Sprint 2 (Commit D) | Type `ProjectScope.constraints?` optionnel côté frontend. Doit devenir obligatoire quand `ProjectScope.tsx` rendra ce champ. | À durcir au moment de l'implémentation UI. |
| D4 | Sprint 1 | `prisma migrate deploy` jamais exécuté sur cette branche (worktree sans `.env`). Migrations marquées appliquées via `prisma migrate resolve --applied` uniquement. | Validation utilisateur explicite requise avant exécution. |
| D5 | Sprint 1 | FK `ProjectMember_projectId_fkey` = `ON DELETE RESTRICT`. Bloque tout hard delete projet. | Sprint "Migrations cleanup" (post-Sprint 6) : passer en CASCADE. |
| D6 | Sprint 3 (Tâche 3.1) | `loadUserContext` l.112-147 (`engineeringTeamProjectCount`) contient encore un OR département `contains 'ENG'` / `'Engineering'`. Sous-filtre d'un compteur DB combiné à `roleCode`, pas une décision de permission directe → cohérent Sprint 3, mais à revisiter pour un pur DB-only. | Sprint RBAC cross-modules (priorité 5 roadmap). |
| D7 | Sprint 4 (Tâche 4.1) | `importWorkItems` génère encore des ids locaux `wi-${now}-${index}` et ne fait pas de re-fetch backend après mutation. KPIs `project.kpis` peuvent diverger transitoirement après import bulk frontend. `TODO(D7):` inscrit dans le code. | À brancher sur l'API en Sprint Reporting (ou plus tôt si l'action est consommée par une UI utilisateur). |
| D8 | Sprint 2 (héritée par Tâche 4.1) | `computeTelecomSummary.incompleteItems` compte `status === 'needs_manual_completion' OR manual_completion_status !== 'complete'`. Le `OR` capture les items `finance_synced` dont `manual_completion_status` n'est pas exactement `'complete'`, gonflant le compteur (observé : 100 au lieu de 94 sur Helios One). Bug pré-existant Sprint 2, juste déplacé dans `telecomSummary.service.ts` par 4.1 — pas créé par elle. | Corriger la condition (`AND` au lieu de `OR`, ou normaliser `manual_completion_status` côté backend). Pas bloquant. |
| D9 | Découvert pendant validation γ Sprint 4 (2026-05-18, preview E2E) | Backend `PATCH /api/v1/pm/projects/:id/work-items/:itemId/details` accepte des inputs non validés → **500 Prisma reject** sur type mismatch. Reproduit : `ticketNumber: 'abc'` (string) plante `prisma.projectItemState.upsert()`. Probablement étendu à `poUnitPrice` et autres champs `Decimal/Int`. Le message d'erreur brut "API request failed with status 500" est affiché dans `WorkItemDrawer:401` à l'utilisateur. **Pas une régression 4.1** (path non touché par le sprint). | Sprint validation/Zod backend dédié — schémas stricts au boundary, 400 sur type invalide plutôt que 500. Mitigation UX possible côté frontend : `<input type="number">` + coercion `Number(value)` avant envoi dans `WorkItemDrawer.tsx:271`. |
| D10 | ✅ Résolue 2026-05-18 (hotfix dédié) | `auth-server.mjs:236-240` : `verifyPassword` faisait un fallback **plain-text equality** si le hash stocké ne contient pas `:`. 1 compte admin avait son `passwordHash` stocké en clair. | **Résolu** : (1) `scripts/rehash-plaintext-passwords.mjs` créé et exécuté → 1 user re-hashé au format scrypt (`usr_ebutsana_full_access_20260321`) ; (2) `verifyPassword` modifié : refuse + `console.warn` si stored sans `:` (plus de fallback plain-text) ; (3) E2E login admin OK post-fix (HTTP 200 + token). Hash commit : voir journal du jour. Audit auth complet (token revocation, password policy, rate limiting) reste hors-scope, à planifier sprint sécurité dédié. |
| D10b | ✅ Résolue 2026-05-18 (rotation manuelle effectuée via UI Settings > Modifier mot de passe) | Password admin d'origine exposé dans l'historique git (commit `6c4d9a3` détaillant D10 + messages de session). Re-hash D10 fermait la voie DB→password, pas la voie git-history→password. | **Résolu** : rotation manuelle du password admin effectuée via l'UI NEOX. Le password présent dans l'historique git n'est plus le password actif → vecteur git-history neutralisé. Nouveau password stocké hors-repo. |
| D11 | Sprint 4 (Tâche 4.1) | View `awaiting_qa_approval` exposée en URL via `useSearchParams` dans `WorkItemsPage.tsx`. Bookmarks pré-Sprint-4 (`?view=pending-qa`) ne matchent plus → fallback silencieux sur `'all'`. UX confusante pour utilisateurs ayant bookmark. | À résoudre par mapping rétro-compat dans `WorkItemsPage.tsx` (parse URL) ou suppression du bookmark côté UX docs. Pas bloquant. |
| D12 | Sprint 5 (Tâche 5.1) | `Milestone.completionPct` (Int) sans `CHECK` DB (0-100). Validation uniquement au boundary route (5.2 whitelist + range). Cohérent convention repo (`Project.status`, `WorkItem.status` sans `CHECK`). Risque : bypass validation via SQL direct ou script. Mitigation UX prévue côté frontend (5.3) via `<input type="number" min="0" max="100" step="1">`. | À traiter dans sweep de hardening DB futur (`CHECK` constraints across PM tables). |

---

## Roadmap Globale Neox ERP

> Le Project Management doit être 100% complété avant de passer au module suivant.

| Priorité | Module | Statut |
|----------|--------|--------|
| 1 | Project Management | 🔄 En cours |
| 2 | SCM — CRUD complet + logique métier | ⏸️ En attente |
| 3 | Finance — réconciliation UI | ⏸️ En attente |
| 4 | HSE — implémentation complète | ⏸️ En attente |
| 5 | RBAC — système DB-driven cross-modules | ⏸️ En attente |
| 6 | Reporting avancé — analytics cross-modules | ⏸️ En attente |

> Chaque module aura son propre plan d'exécution créé au moment de le démarrer,
> avec le même protocole : audit → plan → sprints → tests.
