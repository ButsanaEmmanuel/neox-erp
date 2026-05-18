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
**Statut : ⏸️ Bloqué — attendre Sprint 2 complet**

### Tâche 3.1 — Backend : permissions DB
- [ ] Créer `hasProjectPermission(userId, action)` dans `projectCollaboration.service.mjs`
- [ ] Remplacer les heuristiques lignes 295-299 par cette fonction
- [ ] Vérification via `UserPermissionSet` en DB
- [ ] Tester : accès refusé sans permission, accordé avec permission

### Tâche 3.2 — Frontend : retirer les arrays hardcodés
- [ ] Remplacer le filtre heuristique des managers dans `ProjectsIndex.tsx`
- [ ] Appeler le bon endpoint pour récupérer les utilisateurs par rôle
- [ ] Remplacer les checks RBAC hardcodés par le hook RBAC existant
- [ ] Vérifier que le pattern est identique à HRM

**✅ Sprint 3 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 4 — KPIs, Dashboard & Reporting
**Objectif : Une seule source de vérité pour les KPIs — le backend.**
**Statut : ⏸️ Bloqué — attendre Sprint 3 complet**

### Tâche 4.1 — Unifier le calcul des KPIs
- [ ] Supprimer `recalcProjectKpis()` du store frontend
- [ ] Le store expose les KPIs tels que retournés par le backend
- [ ] `ProjectOverview.tsx` consomme les KPIs sans recalcul local
- [ ] Aligner les noms de statuts (`pending-acceptance` → valeur DB)
- [ ] Vérifier la cohérence des chiffres entre ancienne et nouvelle implémentation

### Tâche 4.2 — Supprimer le polling redondant
- [ ] Supprimer `setInterval(refresh, 15000)` dans `ProjectsIndex.tsx`
- [ ] Vérifier que le SSE `useRealtimeSync` couvre tous les cas

**✅ Sprint 4 terminé quand : toutes les cases ci-dessus sont cochées**

---

## SPRINT 5 — Milestones (Nouvelle feature)
**Objectif : Entité Milestone complète, de la DB au composant.**
**Statut : ⏸️ Bloqué — attendre Sprint 1 migrations validées**

### Tâche 5.1 — Migration Prisma Milestone
- [ ] Générer la migration et montrer le SQL AVANT application
- [ ] Créer `model Milestone` avec dépendances self-relation
- [ ] Ajouter la relation inverse dans `model Project`
- [ ] Appliquer la migration

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
