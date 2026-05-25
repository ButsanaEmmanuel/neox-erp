# NEOX ERP — Plan Module Finance

**Branche :** `claude/sprint-finance` (worktree `.claude/worktrees/sprint-finance/`)
**Statut global :** 🟢 **Sprints Finance-1 + Finance-2 fermés** (2026-05-25 — D2 + DH3 résolues). 2/4 sprints fermés, restent Finance-3 (pages shallow) + Finance-4 (Budgets). Backend ledger/AR/AP/payroll engine matures (~42 routes gatées DH9). UI Payroll découpée en 7 composants, workflow Execute→Adjust→Post→Disburse→Reconcile end-to-end opérationnel, 7/7 tests intégration verts. Plus de dette PM/HRM héritée ouverte.
**Date de création :** 2026-05-25
**Dernière mise à jour :** 2026-05-25

---

## Table des matières

1. [Contexte et état de départ](#1-contexte-et-état-de-départ)
2. [Périmètre du module](#2-périmètre-du-module)
3. [Dépendances inter-modules](#3-dépendances-inter-modules)
4. [Sprint Finance-1 — D2 Bridge PM→Finance](#4-sprint-finance-1)
5. [Sprint Finance-2 — DH3 Payroll UI](#5-sprint-finance-2)
6. [Sprint Finance-3 — Compléter pages shallow](#6-sprint-finance-3)
7. [Sprint Finance-4 — Budgets](#7-sprint-finance-4)
8. [Dettes ouvertes](#8-dettes-ouvertes)
9. [Dettes fermées](#9-dettes-fermées)
10. [Règles transversales](#10-règles-transversales)

---

## 1. Contexte et état de départ

### Origine du sprint

Les plans HRM et PM ont laissé deux dettes explicitement reportées au "Sprint Finance" :

| ID | Origine | Description | Renvoi |
|---|---|---|---|
| D2 | `NEOX_PM_PLAN.md:356` | Stubs `updateTelecomManualFields` / `retryFinanceSync` no-op + route `/details` non créée | "Sprint Finance (priorité 3)" |
| DH3 | `NEOX_HRM_PLAN.md:1526` | Payroll engine backend 95% mais UI absente (FinancePayrollPage branchée sur `PayrollBatch` legacy, pas sur `PayrollRun`) | "Sprint Finance (priorité 3)" |

Le module Finance n'avait pas de plan dédié jusqu'ici. Ce document devient la source de vérité pour D2, DH3 et la maturation des écrans Finance.

### État de l'existant (audit 2026-05-25)

#### Backend

| Zone | Maturité | Détail |
|---|---|---|
| **Ledger core** (`FinanceEntry`, links, evidence, approval, activity) | 🟢 90% | Service `financeEntries.service.mjs` complet, 13 routes |
| **AR/AP** (`Receivable`, `Payable`, `CustomerInvoice`, `VendorBill`, `PaymentDisbursement`, `ReceiptCollection`) | 🟢 85% | 8 routes CRUD list/create, gated DH9 |
| **Payroll engine** (`PayrollRun*`, `PayrollSchedule`, `PayrollCalculationDetail`, `PayrollAdjustment`, `PayrollDisbursementLine`, etc.) | 🟢 95% | `payrollEngine.service.mjs` complet — 7 routes wirées sur `/api/v1/finance/hrm/payroll-*` |
| **Payroll batch legacy** (`PayrollBatch`) | 🟡 — | Ancien modèle parallèle, consommé par UI actuelle (cf. DH3) |
| **Expense claims / Employee advances** | 🟢 80% | 4 routes CRUD/approve |
| **Réconciliation** (`FinanceReconciliation`, `ReconciliationLine`, `DiscrepancyCase`) | 🟢 85% | 7 routes (run, list, detail, unmatched receipts/payments, discrepancies) |
| **Settings / Governance** (categories, evidence rules, approval thresholds, numbering, payment methods, ledger mappings) | 🟢 90% | 7 routes, rollout governance |
| **Snapshot + Reports** | 🟢 80% | 2 routes (`/snapshot`, `/reports`) |
| **SCM bridges** (PO commitment, vendor bills, requisition commitment) | 🟢 80% | 3 routes |
| **PM bridge** (telecom→finance) | 🔴 30% | `backfill/project-entries` OK, **route `/pm/.../work-items/.../details` manquante** (D2) |
| **Budgets** | 🔴 0% | Aucun modèle, aucune route |
| **Bank / FX / Tax** | 🔴 0% | Aucun modèle (hors scope sprints 1–4 — backlog) |
| **Tests** | 🔴 0% | Aucun test Finance dédié dans `backend/tests/` |

#### Frontend

| Page | Fichier | Lignes | Maturité |
|---|---|---|---|
| Overview | `FinanceOverview.tsx` | 329 | 🟢 |
| Transactions | `TransactionsPage.tsx` | 153 | 🟡 |
| Reconciliation | `FinanceReconciliationPage.tsx` | 217 | 🟢 |
| Receivables | `ReceivablesPage.tsx` | 102 | 🟡 shallow |
| Payables | `PayablesPage.tsx` | 549 | 🟢 |
| SCM Obligations | `FinanceScmObligationsPage.tsx` | 217 | 🟢 |
| Invoices | `InvoicesPage.tsx` | 109 | 🟡 shallow |
| Bills | `BillsPage.tsx` | 59 | 🔴 shallow |
| Payments | `PaymentsPage.tsx` | 61 | 🔴 shallow |
| Receipts | `ReceiptsPage.tsx` | 61 | 🔴 shallow |
| HRM Payroll | `FinancePayrollPage.tsx` | 618 | 🔴 branchée sur `PayrollBatch`, pas `PayrollRun` (DH3) |
| HRM Reimbursements | `FinanceReimbursementsPage.tsx` | 183 | 🟡 |
| Budgets | `FinancePlaceholders.tsx:61` (`BudgetsPlaceholder`) | — | 🔴 placeholder pur |
| Reports | `FinanceReportsPage.tsx` | 252 | 🟢 |
| Settings | `FinanceSettingsPage.tsx` | 290 | 🟢 |

#### Routing & RBAC

- Toutes les routes Finance vivent dans `backend/auth-server.mjs:1406-1968` (pas de `backend/routes/finance/`).
- Toutes gatées par `assertPermission` depuis le Sprint DH9 (`875803c`, `c83e645`, `3bca522`).
- Registry Finance : 13 keys fine-grained ajoutées DH9 + 10 legacy intégrées DR2 (super_admin couvre 100% via `RolePermission`).

---

## 2. Périmètre du module

### Ce que les sprints Finance-1 → 4 couvrent

1. **Bridge PM→Finance** — fermer D2 (stubs télécom branchés + route `/details`)
2. **Payroll UI moderne** — fermer DH3 (UI sur engine `PayrollRun`, pas `PayrollBatch`)
3. **CRUD complets** sur les 5 pages shallow (Bills, Payments, Receipts, Invoices, Receivables)
4. **Budgets** — modèles + routes + page (remplace `BudgetsPlaceholder`)

### Ce que ces sprints ne couvrent PAS

- Bank statement import + matching automatique (backlog Finance-5)
- Plan comptable structuré (`Account` / `JournalEntry` proper) — `FinanceEntry` reste plat
- Multi-currency / FX rates (dette `Project.currency` vs `FinanceEntry.currencyCode` notée `NEOX_PM_PLAN.md:346`)
- Tax engine (TVA, IPR) — backlog
- Cashflow forecasting
- Analytics cross-modules (sprint Reporting priorité 5)
- Refactorisation des routes Finance hors `auth-server.mjs` (créer `backend/routes/finance/`) — backlog dette infra

---

## 3. Dépendances inter-modules

### Finance ← PM

- `Project`, `WorkItem` → `FinanceEntry` via `FinanceEntrySourceLink`
- Backfill télécom : `POST /api/v1/finance/backfill/project-entries` (existe)
- Bridge manuel item-level : **`PATCH /pm/projects/:id/work-items/:itemId/details` manquant** (Sprint Finance-1)
- Frontend : `useProjectStore.retryFinanceSync` / `updateTelecomManualFields` actuellement `console.warn` no-op (`src/store/pm/useProjectStore.ts:347-356`)

### Finance ← HRM

- `EmployeeSalaryProfile`, `PayrollSchedule` → `PayrollRun` → `PayrollDisbursementLine` → `FinanceEntry`
- `ExpenseClaim`, `EmployeeAdvance` → `FinanceEntry` (création à l'approbation)
- Reimbursements UI lit `ExpenseClaim` + `EmployeeAdvance`

### Finance ← SCM

- `PurchaseOrder` → `VendorBill` via `/finance/scm/vendor-bills` + `/finance/scm/po-commitment`
- `PurchaseRequest` → commitment via `/finance/scm/requisition-commitment`

### Finance ← CRM

- `CrmDeal` (Won) → `CustomerInvoice` candidate via `markDealWonAndCreateInvoiceCandidate` (déjà câblé)

---

## 4. Sprint Finance-1

**Objectif :** Fermer D2 — bridge PM→Finance complet, plus aucun `console.warn` no-op côté front.
**Durée estimée :** 3–5 jours
**Statut :** 🔵 Planifié
**Dettes ciblées :** D2

---

### F1.1 — Audit & patch minimal du backend existant

**Découverte 2026-05-25 (avant écriture)** : la route et le service existent déjà.
- Route : `PATCH /api/v1/pm/projects/:id/work-items/:itemId/details` à `backend/auth-server.mjs:2133-2169`, gated `pm.workItems.write`
- Service : `saveProjectItemDetails` dans `backend/services/projects/projectItemDetails.service.mjs:218` — 593 L, mature
- Sync finance déjà appelée inconditionnellement à `:398` via `syncProjectItemStateToFinance` (idempotente)
- Validation D9 (`assertOptional*`) déjà en place à `auth-server.mjs:2142-2153`, retourne 400 propre

**Conséquence** : F1.1 n'est plus une création mais un **audit + patch ciblé** sur deux 404s.

**Test "retry only" validé par lecture (2026-05-25)** : `PATCH /details` avec body vide → tous les `input.X` sont undefined → `next === current` (pattern `input.X !== undefined ? input.X : current.X` lignes 274-288) → upsert idempotent → `syncProjectItemStateToFinance` re-tentée inconditionnellement. Le bouton Retry envoie juste `{ actorUserId, actorDisplayName }`. **Aucune modification de `saveProjectItemDetails` requise sur la logique de sync.**

**Décisions actées avec l'utilisateur (2026-05-25)** :
- **Single check `pm.workItems.write` conservé** — la sync finance est un side-effect implicite du save, pas une opération RBAC séparée. Pas de double check `pm.finance.execute`.
- **Pas de flag `retryFinanceSync` dans le body** — le retry = un save sans diff, le service re-tente la sync à chaque appel.
- **Patch 404 uniquement** — aligner les 2 `throw new Error()` (`Project not found`, `Work item not found`) sur le pattern `err(404, 'NOT_FOUND', { id })` de `workItemHierarchy.service.mjs`. Scope strict.
- **Payload réel de la route** : `poUnitPrice, ticketNumber, contractorPayableAmount, qaStatus, acceptanceStatus, importedFields, operationalManualFields, acceptanceManualFields` (camelCase, pas snake_case comme l'ancien plan). Mapping snake/camel fait côté `pmApi.ts` (F1.2).

#### Tâches

**T1 — Patch 404 dans `saveProjectItemDetails` ✅**
```
Fichier : backend/services/projects/projectItemDetails.service.mjs
Avant :
  if (!project) throw new Error('Project not found...')
  if (!workItem) throw new Error('Work item not found...')
Après :
  if (!project) throw notFound(`Project '${id}' not found.`, { id })
  if (!workItem) throw notFound(`Work item '${id}' not found in project '${pid}'.`, { id, projectId: pid })
Avec helper local en tête de fichier :
  function err(statusCode, code, message, extra = {}) { ... }
  const notFound = (msg, extra) => err(404, 'NOT_FOUND', msg, extra)
Scope strict : ces 2 throw uniquement. Aucune autre modification du service.
Le handler top-level `auth-server.mjs:2253` lit `err.statusCode` → réponse HTTP 404 propre.
Commit : fix(pm): proper 404 on project/workItem not found — ref D2
```

**Critères de sortie F1.1**
- [x] Audit fait — route + service existants identifiés, payload réel documenté
- [x] Test "retry only" validé par lecture (body vide → sync re-tentée)
- [x] Helper `notFound` ajouté, 2 `throw new Error` remplacés
- [x] `node --check projectItemDetails.service.mjs` ✓
- [ ] Test runtime 404 (validé en F1.4)

### F1.2 — Brancher le store frontend

**Objectif :** Remplacer les 2 `console.warn` par les vrais appels API.

#### Tâches

**T1 — `src/services/pmApi.ts` (ou équivalent)**
```
Ajouter :
  patchWorkItemDetails(projectId, itemId, payload) → fetch PATCH /details
  retryWorkItemFinanceSync(projectId, itemId) → fetch PATCH /details { retryFinanceSync: true }
Commit : feat(pm): work-item details API client — ref D2
```

**T2 — `src/store/pm/useProjectStore.ts:347-356`**
```
Supprimer console.warn no-op
Implémenter updateTelecomManualFields : appel API + patch state local depuis réponse
Implémenter retryFinanceSync : appel API + toast feedback + refresh entry liée
Commit : fix(pm): wire telecom finance stubs — close D2
```

**Critères de sortie F1.2**
- [ ] Plus aucun `console.warn` "not implemented, pending Phase 4" dans `useProjectStore.ts`
- [ ] Les 2 méthodes typées `Promise<void>` (cohérent Sprint 2 PM)
- [ ] Refresh state local après mutation (pas d'optimistic uniquement)

### F1.3 — Bouton "Retry finance sync" dans `WorkItemsPage.tsx`

**Objectif :** Le bouton `WorkItemsPage.tsx:567` (`retryFinanceSync(item.id)`) doit appeler la nouvelle implémentation et afficher feedback.

#### Tâches

**T1 — Loading state + toast**
```
Ajouter état pending par item (Set<string>)
Disabled pendant requête
Toast success/error
Commit : feat(pm): retry finance sync UX — ref D2
```

**Critères de sortie F1.3**
- [ ] Click sur "Retry" déclenche vraie requête (vérifier Network tab)
- [ ] Feedback visible (toast + état disabled pendant pending)
- [ ] Status `WorkItem.financeSync` mis à jour dans la table après succès

### F1.4 — Tests d'intégration

**Fichier :** `backend/tests/pm/pm-work-item-details.test.mjs`

```
Tests requis :
  1. PATCH /details succès — ticket_number + manual_fields mis à jour + FinanceEntry recréée
  2. PATCH /details avec retryFinanceSync: true — FinanceEntry resynchronisée même sans changement de champs
  3. 403 sans pm.workItems.write (user readonly) — single check, pas de double avec finance.execute (décision actée F1.1)
  4. 404 item inconnu (workItemId valide mais pas dans le projet ciblé) → err.statusCode=404, err.code='NOT_FOUND'
  5. 404 projet inconnu → idem
  6. Retry-only : body `{ actorUserId, actorDisplayName }` (zéro champ data) → 200, FinanceEntry re-synchronisée même sans diff (syncProjectItemStateToFinance idempotente)
  7. Champ hors payload (ex: body inclut `status: "done"`) → ignoré silencieusement par le destructuring ligne 2155-2166, 200 retourné, ProjectItemState.status inchangé
  8. SSE work_item_updated émis (sseBroadcast à projectItemDetails.service.mjs:585) — vérifier via mock listener
Commit : test(pm): work-item details integration — close D2
```

**Critères de sortie F1.4**
- [x] Suite isolée (pattern `hrm-onboarding.test.mjs`) — fichier `backend/tests/pm/pm-work-item-details-d2.test.mjs`
- [x] 8/8 assertions ✓ (premier run, commit `6580e44`)
- [x] Runnable via `npm run test:pm-work-item-details`

### Critères de sortie Sprint Finance-1

- [x] Route `PATCH /api/v1/pm/projects/:id/work-items/:itemId/details` opérationnelle (existait déjà ; 404 patché en `7b60b53`)
- [x] `updateTelecomManualFields` et `retryFinanceSync` branchés sur API réelle (`6ff99b6`)
- [x] Bouton "Retry finance sync" fonctionnel UI avec pending state + toast (`6ff99b6`)
- [x] Tests F1.4 verts (8/8) — `6580e44`
- [x] **D2 fermée** — entrée déplacée vers §9 Dettes fermées

---

## 5. Sprint Finance-2

**Objectif :** Fermer DH3 — finir les gaps UX de la Payroll UI, extraire l'API client, découper la page monolithique en sous-composants. **Pas de réécriture** : la page est déjà branchée à ~70% sur `PayrollRun`.
**Durée estimée :** 1–2 semaines (réduit vs spec initiale après audit)
**Statut :** 🔵 Planifié
**Dettes ciblées :** DH3

---

### F2.1 — Note d'architecture (compte-rendu d'audit, pas de code)

**Audit réalisé 2026-05-25 — deux fausses hypothèses du plan original corrigées avant d'écrire du code :**

**Hypothèse 1 (fausse) : "FinancePayrollPage est branchée sur PayrollBatch legacy, à abandonner."**
- Réalité : la page consomme déjà `PayrollRun[]`, `getPayrollRunDetail`, `executePayrollRun`, `postPayrollRun`, `adjustPayrollRunEmployee` (cf. `src/components/FinancePayrollPage.tsx:130-340`)
- `PayrollBatch` n'est PAS legacy : c'est le **conteneur de `PayrollDisbursementLine`** créé par `executePayrollRun:688-706` quand des lignes deviennent payables. Cohérent avec l'engine, à conserver.
- **Décision : `PayrollBatch` reste utilisé pour l'aval (disbursement + reconciliation). Pas de migration model.**

**Hypothèse 2 (fausse) : "Engine 95%, manque 5%."**
- Réalité : `payrollEngine.service.mjs` (895 L) = 10 exports, 0 TODO, 0 stub. Workflow Execute → Adjust → Post → Disburse → Reconcile **100% couvert** par engine + helpers `approvePayrollBatch`/`disbursePayrollLine`/`reconcilePayrollBatch` du `financeEntries.service.mjs`.
- **Décision : aucune fonction engine à écrire dans Sprint Finance-2. Le sprint est purement frontend + tests.**

**Vraies dettes UX restantes (priorisées 🔴 bloquant > 🟡 important > 🟢 nice-to-have) :**

| Gap | Sévérité | Sous-tâche |
|---|---|---|
| API client absent — 9 `apiRequest` inline dans la page | 🔴 | F2.2 |
| Page Salary Profiles absente (data chargée, jamais affichée) | 🟡 | F2.3 |
| Bouton "Run due" pas exposé en UI | 🟡 | F2.3 |
| Toggle isActive sur schedule pas visible | 🟡 | F2.3 |
| Onglet "Calculations" (PayrollCalculationDetail) absent | 🟡 | F2.4 |
| Onglet "Adjustments" dédié absent (uniquement modal éphémère) | 🟡 | F2.4 |
| Onglet "Logs" (PayrollRunLog) absent | 🟢 | F2.4 |
| Onglet "Timesheets" (PayrollRunTimesheetLink) absent | 🟢 | F2.4 |
| UX workflow flou : Approve vs Post vs Disburse pas guidé | 🟡 | F2.5 |
| Page 618 L monolithique — pas de découpe par responsabilité | 🟢 | F2.6 |

### F2.2 — Extraire `payrollEngineApi.ts`

**Fichier :** `src/services/finance/payrollEngineApi.ts` (nouveau dossier `src/services/finance/`)

```
Source : extraire les 9 apiRequest inline de FinancePayrollPage.tsx (L130-340)
Endpoints à exposer (tous existent — cf. audit §F2.1) :
  listPayrollSchedules() → GET /api/v1/finance/hrm/payroll-schedules
  upsertPayrollSchedule(payload) → POST /api/v1/finance/hrm/payroll-schedules
  listSalaryProfiles(filters?) → GET /api/v1/finance/hrm/salary-profiles
  upsertSalaryProfile(payload) → POST /api/v1/finance/hrm/salary-profiles
  listPayrollRuns(filters?) → GET /api/v1/finance/hrm/payroll-runs
  getPayrollRunDetail(runId) → GET /api/v1/finance/hrm/payroll-runs/:id
  executePayrollRun(payload) → POST /api/v1/finance/hrm/payroll-runs/execute
  runDuePayrollSchedules() → POST /api/v1/finance/hrm/payroll-runs/run-due
  postPayrollRun(runId, payload) → POST /api/v1/finance/hrm/payroll-runs/:id/post
  adjustPayrollRunEmployee(employeeLineId, payload) → POST /api/v1/finance/hrm/payroll-runs/employees/:id/adjust
  listPayrollBatches(filters?) → GET /api/v1/finance/hrm/payroll-batches
  getPayrollBatchDetail(batchId) → GET /api/v1/finance/hrm/payroll-batches/:id
  approvePayrollBatch(batchId, payload) → POST /api/v1/finance/hrm/payroll-batches/:id/approve
  reconcilePayrollBatch(batchId, payload) → POST /api/v1/finance/hrm/payroll-batches/:id/reconcile
  disbursePayrollLine(lineId, payload) → POST /api/v1/finance/hrm/payroll-lines/:id/disburse

Types : déplacer les interfaces PayrollRun / PayrollBatch / PayrollSchedule / PayrollRunEmployee
        depuis FinancePayrollPage.tsx vers src/types/payroll.ts (nouveau fichier).
        Sources canoniques : aligner sur prisma/schema.prisma (PayrollRun, PayrollBatch, etc.).

Migration : remplacer chaque apiRequest inline par l'appel typed depuis le client.
            Suppression des interfaces locales dans FinancePayrollPage.tsx.

Commit : feat(finance): extract payrollEngineApi.ts + types — ref DH3
```

**Critères de sortie F2.2**
- [ ] `src/services/finance/payrollEngineApi.ts` créé avec 15 endpoints typés
- [ ] `src/types/payroll.ts` créé avec interfaces alignées Prisma
- [ ] Plus aucun `apiRequest` inline dans `FinancePayrollPage.tsx`
- [ ] `tsc --noEmit` ✓

### F2.3 — Schedules + Salary Profiles UX gaps

**Fichier :** modifications dans `FinancePayrollPage.tsx` (pas de nouveau fichier — découpe en F2.6)

```
Gap 1 — Bouton "Run due" :
  Ajouter dans la section Schedules un bouton "Run due now"
  → confirm modal ("Cela exécutera les payrolls de N schedules échus")
  → appel runDuePayrollSchedules()
  → toast feedback + refresh runs list
  Permission : hrm.payroll.execute (gate UI + check backend)

Gap 2 — Toggle isActive sur schedule :
  Sur chaque PayrollSchedule, switch isActive (read + edit)
  → appel upsertPayrollSchedule({ id, isActive })
  → optimistic update + revert si erreur
  Permission : hrm.payroll.write

Gap 3 — Salary Profiles affichage :
  Nouvelle section "Salary Profiles" (sous-tab ou panneau dépliable)
  → liste paginée : user, baseSalary, currency, effectiveFrom/To
  → modal create/edit (FormKit pattern existant)
  Permission : hrm.payroll.read pour liste, hrm.payroll.write pour CRUD

Commit : feat(finance): payroll schedules + salary profiles UX gaps — ref DH3
```

**Critères de sortie F2.3**
- [ ] Bouton "Run due" fonctionnel + feedback toast
- [ ] Toggle isActive sur chaque schedule + persistence
- [ ] Section Salary Profiles avec CRUD complet

### F2.4 — Run detail : 4 onglets manquants

**Fichier :** modifications dans `FinancePayrollPage.tsx` (sous-composants extraits en F2.6)

```
Architecture : structurer le run detail panel en tabs strict
  [Employees] [Calculations] [Adjustments] [Logs] [Timesheets] [Notifications] [Disbursements]
  (Employees + Notifications + Disbursements existent déjà — à fusionner dans la structure tabs)

Onglet Calculations :
  - Table : employee | regularPay | overtimePay | grossPay | deductions | netPay
  - Source : PayrollCalculationDetail joint via getPayrollRunDetail include
  - Si include manquant côté backend : ajouter prisma.payrollCalculationDetail dans getPayrollRunDetail (1 ligne)

Onglet Adjustments :
  - Table : employee | originalAmount | adjustedAmount | reason | adjustedBy | createdAt
  - Source : PayrollAdjustment joint via getPayrollRunDetail include
  - Action : "Revert" si statut run encore éditable (hrm.payroll.write) — uniquement si engine supporte

Onglet Logs :
  - Table read-only : actionType | message | actorName | createdAt | detailJson (collapsed)
  - Source : PayrollRunLog joint via getPayrollRunDetail include
  - Filtres : type d'événement

Onglet Timesheets :
  - Table : employee | workDate | hoursTotal | overtime | statusCode
  - Source : PayrollRunTimesheetLink joint via getPayrollRunDetail include
  - Lien : cliquer sur ligne → ouvrir TimesheetEntry detail (modal légère ou navigation)

Avant de coder : vérifier que getPayrollRunDetail include déjà ces 4 relations.
Si non, étendre l'include dans le service (1 PR backend de support, scope minimal).

Note : Logs (PayrollRunLog) et Timesheets (PayrollRunTimesheetLink)
inclus dans ce commit mais classés nice-to-have — non bloquants
pour la fermeture de DH3 (cf. DF8/DF9 si déprioritisés en cours de sprint).

Commit : feat(finance): payroll run detail tabs (calculations, adjustments, logs, timesheets) — ref DH3
```

**Critères de sortie F2.4**
- [ ] 4 nouveaux onglets rendus avec données réelles
- [ ] `getPayrollRunDetail` include les 4 relations (vérifier ou patcher service backend)
- [ ] Navigation tabs fluide (pas de re-fetch inutile)

### F2.5 — Workflow UX : Approve vs Post vs Disburse

**Objectif :** Rendre le cycle de vie d'un run lisible — l'utilisateur sait à chaque instant quel bouton presser et pourquoi.

```
Cycle de vie réel (vérifié dans engine) :
  PayrollRun.postingStatus : pending_validation | auto_posting | posted
  PayrollBatch.status      : draft | approved | reconciled
  PayrollDisbursementLine.status : pending | paid | reconciled

États affichés :
  1. Run "pending_validation"
     → bouton primaire "Post run" (gate hrm.payroll.execute)
        ⤷ déclenche approvePayrollBatch (interne) + run.postingStatus = posted
     → bouton secondaire "Adjust line" (sur chaque PayrollRunEmployee, gate hrm.payroll.write)
  2. Run "posted"
     → bouton primaire "Disburse all pending" (gate hrm.payroll.execute)
        ⤷ boucle disbursePayrollLine sur lignes status=pending
     → ou bouton ligne par ligne "Disburse" sur PayrollDisbursementLine
  3. Run "posted" + batch.status = "approved" + toutes lignes disbursed
     → bouton "Reconcile batch" (gate hrm.payroll.execute) → batch.status = reconciled

Implémentation :
  - StateBadge component : couleurs par état (gris/jaune/vert)
  - ActionBar component : affiche uniquement les boutons valides pour l'état courant
  - Guards : disabled + tooltip explicatif si action invalide pour l'état
  - Confirm modal sur actions destructives (Post + Reconcile)

Commit : feat(finance): payroll workflow UX clarifié — ref DH3
```

**Critères de sortie F2.5**
- [ ] Aucun bouton "actif" qui mène à 400/409 backend (guard front-strict)
- [ ] Tooltip sur chaque bouton disabled (explique pourquoi)
- [ ] Confirm modal sur Post et Reconcile
- [ ] StateBadge consistent sur tout le module

### F2.6 — Découpage de `FinancePayrollPage.tsx` (618 L → composants ciblés)

**Objectif :** Page principale devient un orchestrateur léger ; chaque section a son fichier.

```
Cible :
  src/components/finance/payroll/
    PayrollDashboard.tsx          # shell + tabs Runs / Schedules / Salary Profiles
    PayrollRunsList.tsx           # liste runs + filtres
    PayrollRunDetail.tsx          # detail + 7 onglets (F2.4)
    PayrollRunActionBar.tsx       # workflow buttons (F2.5)
    PayrollSchedulesPanel.tsx     # liste schedules + toggle + Run due (F2.3)
    PayrollSalaryProfilesPanel.tsx # liste + modal CRUD (F2.3)
    tabs/
      EmployeesTab.tsx
      CalculationsTab.tsx
      AdjustmentsTab.tsx
      LogsTab.tsx
      TimesheetsTab.tsx
      NotificationsTab.tsx
      DisbursementsTab.tsx
    modals/
      AdjustLineModal.tsx
      PostRunConfirmModal.tsx
      ReconcileBatchConfirmModal.tsx

  src/components/FinancePayrollPage.tsx → wrapper minimal
    (ou supprimé, sidebar route vers PayrollDashboard directement)

Critère qualité :
  - Aucun composant > 200 L
  - Chaque tab ne lit que les données dont elle a besoin (props slicing)
  - Hooks data-fetch dans le shell, pas dans les tabs (descendent en props)

Commit : refactor(finance): split payroll page into focused components — ref DH3
```

**Critères de sortie F2.6**
- [ ] Tous les nouveaux fichiers < 200 L
- [ ] `tsc --noEmit` ✓
- [ ] Aucune régression UX vs avant (vérification manuelle des 5 actions clés)

### F2.7 — Tests d'intégration

**Fichier :** `backend/tests/finance/finance-payroll-workflow.test.mjs`

```
Pattern : isolé style pm-work-item-details-d2.test.mjs (RUN-prefixed users + teardown finally)

Tests requis (7 assertions sur workflow complet) :
  1. executePayrollRun → PayrollRun créé status=running puis completed, PayrollRunEmployee
     créés pour users avec salaryProfile, PayrollBatch créé avec disbursement lines
  2. adjustPayrollRunEmployee → PayrollAdjustment créé, PayrollRunEmployee.adjustedGrossPay
     mis à jour, run.totalGrossPay recalculé, propagation à Payable + FinanceEntry
  3. postPayrollRun → run.postingStatus = posted, batch.status = approved (via
     approvePayrollBatch interne), PayrollRunLog 'run_posted' écrit
  4. disbursePayrollLine → PaymentDisbursement créé, PayrollDisbursementLine.status = paid
  5. reconcilePayrollBatch → batch.status = reconciled (après toutes lignes disbursed)
  6. runDuePayrollSchedules → seuls les schedules avec nextRunAt <= now sont exécutés,
     les autres ignorés (count assertion)
  7. RBAC : 403 sans hrm.payroll.execute sur postPayrollRun (assertPermission mock + user orphan)

Setup : créer 1 schedule actif + 2 users avec EmployeeSalaryProfile + TimesheetEntry approvés
Teardown : ordre FK strict (financeEntry → payable → disbursementLine → batch →
            payrollAdjustment → payrollRunEmployee → payrollRun → payrollPeriod →
            schedule → salaryProfile → timesheet → user)

Commit : test(finance): payroll workflow integration 7/7 — close DH3
```

**Critères de sortie F2.7**
- [x] 7/7 assertions ✓ (premier run après fix bug latent — commit `edbfa4c`)
- [x] Runnable via `npm run test:finance-payroll-workflow`
- [x] Teardown propre (TRACKED sets, swallow par opération, aucune ligne orpheline)

### Critères de sortie Sprint Finance-2

- [x] API client `payrollEngineApi.ts` extrait + types canoniques (F2.2 — `aac9f0f`)
- [x] Schedules + Salary Profiles UX gaps comblés (F2.3 — `6409163`)
- [x] 4 onglets Run detail manquants ajoutés (F2.4 — `b09ba41`)
- [x] Workflow UX clarifié — boutons + guards + confirms (F2.5 — `fb6636f`)
- [x] Page découpée en composants (F2.6 — `357d641`) ; 5/7 fichiers <200 L, Dashboard 425 L assumé (cost orchestrateur)
- [x] Tests F2.7 verts (7/7 — `edbfa4c`)
- [x] **DH3 fermée** — entrée déplacée vers §9 Dettes fermées
- [x] **Bonus** : bug latent `approvePayrollBatch` corrigé en passant (révélé par test 3)

---

## 6. Sprint Finance-3

**Objectif :** Transformer les 5 pages shallow en pages opérationnelles complètes (List + Filtres + Create + Detail drawer read-only), cohérentes UX avec `PayablesPage.tsx` (549 L, référence).
**Durée estimée :** 2 semaines
**Statut :** 🔵 Planifié
**Dettes ciblées :** Aucune dette formelle — closure de la maturité Finance shallow → opérationnelle

**Note de scope (révisé 2026-05-25)** — Audit pré-écriture du backend : les routes actuelles sont GET (list) + POST (create) pour Bills/Payments/Receipts/Invoices, et GET (list) + GET (detail) pour Receivables. Aucune route PATCH, DELETE, Approve/Reject ou Send pour ces 4 entités transactionnelles. Le scope ci-dessous reflète cette réalité : detail drawer en read-only, actions de workflow déléguées au parent (Payable/Receivable), pas d'Approve/Reject/Send/Adjust. L'ajout de ces routes est documenté comme dette suiveuse DF10 dans §8.

**Décision validée 2026-05-25** — Tests interleaved (1 suite committée avec chaque page) plutôt qu'en bloc final, pour éviter la dette de tests. Refactor en composants partagés (`EvidenceUploadField`, `EntityDrawer`, etc.) opportuniste après F3.1 si 3+ patterns dupliqués.

---

### F3.1 — `BillsPage.tsx` (59 L → page opérationnelle)

```
Sections requises :
  - Liste VendorBill : billNumber, vendor, dueDate, totalAmount, status, evidence indicator
  - Filtres : status, vendor, période, payableId
  - Modal create : sélecteur Payable parent (required), billNumber (auto-généré si omis),
    issueDate/dueDate, subtotalAmount/taxAmount/totalAmount, notes
  - Drawer detail read-only : champs bill + lien clic vers PayablesPage drawer du parent
    (evidence/approve/reject vivent côté Payable, pas Bill)
  - Export CSV de la liste filtrée

Endpoints existants : GET/POST /api/v1/finance/bills
Permissions : finance.bills.read / finance.bills.write
Commits :
  feat(finance): bills list + filters + create — ref Finance-3
  feat(finance): bills detail drawer — ref Finance-3
  test(finance): bills integration suite — ref Finance-3
```

### F3.2 — `PaymentsPage.tsx` (61 L → page opérationnelle)

```
Sections requises :
  - Liste PaymentDisbursement : reference, vendor, totalAmount, method, paidAt, status
  - Filtres : method (cash/bank/mobile), status, vendor, période
  - Modal create : sélecteur Payable à régler, montant, méthode, evidence upload
    (sur le Payable parent), notes
  - Drawer detail read-only : champs payment + lien vers Payable parent
  - Liaison automatique avec FinanceLedgerMapping (méthode → account) — déléguée au service backend

Endpoints : GET/POST /api/v1/finance/payments
Permissions : finance.payments.read / finance.payments.write
Commits :
  feat(finance): payments list + filters + create — ref Finance-3
  feat(finance): payments detail drawer — ref Finance-3
  test(finance): payments integration suite — ref Finance-3
```

### F3.3 — `ReceiptsPage.tsx` (61 L → page opérationnelle)

```
Symétrique PaymentsPage côté inbound :
  - Liste ReceiptCollection : reference, customer, totalAmount, method, receivedAt, status
  - Filtres : method, status, customer, période
  - Modal create : sélecteur Receivable à recouvrer, montant, méthode, evidence sur Receivable
  - Drawer detail read-only : champs receipt + lien vers Receivable parent

Endpoints : GET/POST /api/v1/finance/receipts
Permissions : finance.receipts.read / finance.receipts.write
Commits :
  feat(finance): receipts list + filters + create — ref Finance-3
  feat(finance): receipts detail drawer — ref Finance-3
  test(finance): receipts integration suite — ref Finance-3
```

### F3.4 — `InvoicesPage.tsx` (109 L → page opérationnelle)

```
Sections requises :
  - Liste CustomerInvoice : invoiceNumber, customer, dueDate, totalAmount, status, lien Receivable
  - Filtres : status, customer, période, project, dealSource
  - Modal create : sélecteur customer + project + deal, lignes, taxes (flat), notes
  - Drawer detail read-only : champs invoice + lien vers Receivable enfant + lien vers Deal source
  - Pas d'action Send/Mark sent/Cancel pour ce sprint (DF10)

Endpoints : GET/POST /api/v1/finance/invoices
Permissions : finance.invoices.read / finance.invoices.write
Commits :
  feat(finance): invoices list + filters + create — ref Finance-3
  feat(finance): invoices detail drawer — ref Finance-3
  test(finance): invoices integration suite — ref Finance-3
```

### F3.5 — `ReceivablesPage.tsx` (102 L → page opérationnelle + aging)

```
Receivables a une vraie route GET detail (/:id) — drawer plus riche que les autres.

Sections requises :
  - Liste Receivable : reference, customer, dueDate, totalAmount, outstandingAmount, status,
    agedBucket (0-30/31-60/61-90/90+)
  - Filtres : status, customer, agedBucket, project
  - Vue "Aging report" : table buckets par customer (toggle UI)
  - Drawer detail (via GET /:id) : Invoice source, Receipts liés, evidence, activity
  - Pas de modal create (receivables dérivés des invoices, pas créés manuellement)
  - Pas d'action Adjust pour ce sprint (DF10)

Endpoints : GET /api/v1/finance/receivables + détail /:id
Permissions : finance.receivables.read
Commits :
  feat(finance): receivables list + filters + aging — ref Finance-3
  feat(finance): receivables detail drawer — ref Finance-3
  test(finance): receivables integration suite — ref Finance-3
```

### F3.6 — Tests d'intégration (interleaved par page)

```
backend/tests/finance/
  finance-bills.test.mjs       — committé avec F3.1
  finance-payments.test.mjs    — committé avec F3.2
  finance-receipts.test.mjs    — committé avec F3.3
  finance-invoices.test.mjs    — committé avec F3.4
  finance-receivables.test.mjs — committé avec F3.5

Couverture par suite :
  - Create entité + lecture liste (sauf Receivables : pas de POST)
  - Filtres list (status, période minimum)
  - RBAC : 403 sans permission appropriée
  - Liaison parent (Payable/Receivable/Deal) cohérente

Pas de tests update/soft-delete : les routes n'existent pas (cf. note de scope, DF10).
```

### Critères de sortie Sprint Finance-3

- [ ] 5 pages opérationnelles (List + Filtres + Detail drawer, +Create pour 4 sur 5)
- [ ] Aging report fonctionnel sur ReceivablesPage
- [ ] 5 suites de tests vertes (interleaved)
- [ ] Sidebar Finance entièrement consommée par pages opérationnelles
- [ ] DF10 ouverte dans §8 — backend completion (PATCH/DELETE/detail/approve manquants)

---

## 7. Sprint Finance-4

**Objectif :** Implémenter Budgets de bout en bout, remplacer `BudgetsPlaceholder`.
**Durée estimée :** 2 semaines
**Statut :** 🔵 Planifié
**Dettes ciblées :** Aucune dette formelle — feature nouvelle (sidebar `finance-budgets` actuellement placeholder)

---

### F4.1 — Modèles Prisma

**Fichier :** `prisma/schema.prisma`

```prisma
model Budget {
  id              String   @id @default(cuid())
  name            String
  periodStart     DateTime
  periodEnd       DateTime
  departmentId    String?
  projectId       String?
  currencyCode    String   @default("USD")
  status          String   @default("draft")  // draft | active | closed
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  isDeleted       Boolean  @default(false)
  deletedAt       DateTime?

  department  Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  project     Project?    @relation(fields: [projectId], references: [id], onDelete: Restrict)
  lines       BudgetLine[]

  @@index([status])
  @@index([periodStart, periodEnd])
}

model BudgetLine {
  id              String   @id @default(cuid())
  budgetId        String
  categoryId      String   // FinanceCategorySetting
  plannedAmount   Decimal  @db.Decimal(18,2)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  budget    Budget                  @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  category  FinanceCategorySetting  @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@unique([budgetId, categoryId])
  @@index([categoryId])
}
```

**Migration :** `prisma/migrations/YYYYMMDD_add_budget_models/`

```
Pattern défensif (cf. règle §10) :
  CREATE TABLE IF NOT EXISTS "Budget" (...)
  CREATE TABLE IF NOT EXISTS "BudgetLine" (...)
  CREATE INDEX IF NOT EXISTS ...
  DO $$ ... pg_constraint guards FK $$
Appliquer via : npx prisma migrate deploy
Commit : feat(finance): Budget + BudgetLine models — ref Finance-4
```

**Critères de sortie F4.1**
- [ ] Migration appliquée
- [ ] `npx prisma generate` propre
- [ ] Relation `FinanceCategorySetting.budgetLines` ajoutée

### F4.2 — Service backend `budgets.service.mjs`

**Fichier :** `backend/services/finance/budgets.service.mjs`

```
Exports :
  createBudget(prisma, input, actor)
  updateBudget(prisma, id, input, actor)
  listBudgets(prisma, filters)
  getBudgetDetail(prisma, id)  // inclut lines + calcul actuals
  upsertBudgetLine(prisma, budgetId, line, actor)
  deleteBudgetLine(prisma, budgetId, lineId, actor)
  closeBudget(prisma, id, actor)
  computeBudgetActuals(prisma, budgetId)
    → agrège FinanceEntry filtrés par categoryId + period + scope (dept/project)
    → renvoie par BudgetLine : { plannedAmount, actualAmount, variance, variancePct }
Commit : feat(finance): budgets service + actuals aggregation — ref Finance-4
```

**Critères de sortie F4.2**
- [ ] `computeBudgetActuals` agrège correctement (test isolé)
- [ ] Filtrage scope dept/project respecté

### F4.3 — Routes backend

**Dans `auth-server.mjs` (ou nouveau `backend/routes/finance/budgets.routes.mjs`) :**

```
GET    /api/v1/finance/budgets                 → assertPermission finance.budgets.read
POST   /api/v1/finance/budgets                 → finance.budgets.write
GET    /api/v1/finance/budgets/:id             → finance.budgets.read (inclut actuals)
PATCH  /api/v1/finance/budgets/:id             → finance.budgets.write
POST   /api/v1/finance/budgets/:id/close       → finance.budgets.execute
POST   /api/v1/finance/budgets/:id/lines       → finance.budgets.write
PATCH  /api/v1/finance/budgets/:id/lines/:lid  → finance.budgets.write
DELETE /api/v1/finance/budgets/:id/lines/:lid  → finance.budgets.write
Commit : feat(finance): budgets routes — ref Finance-4
```

**Registry à étendre :**

```
prisma/seed/rbac.seed.mjs
Ajouter :
  finance.budgets.read
  finance.budgets.write
  finance.budgets.execute
Rôles touchés : super_admin (ALL_KEYS), finance_admin (...FIN_KEYS), readonly (.read)
Commit : feat(rbac): finance.budgets.* permissions — ref Finance-4
```

**Critères de sortie F4.3**
- [ ] 3 permissions seedées
- [ ] 8 routes gated
- [ ] Seed idempotent (2e run = 0 nouvelle perm)

### F4.4 — Frontend : `BudgetsPage.tsx`

**Fichiers :**
- `src/components/finance/budgets/BudgetsPage.tsx` (nouveau)
- `src/components/finance/budgets/BudgetDetailDrawer.tsx`
- `src/components/finance/budgets/BudgetLineEditor.tsx`
- `src/services/budgetsApi.ts`

```
BudgetsPage :
  - Liste : name, period, scope (dept/project), status, plannedTotal, actualTotal, variance
  - Filtres : status, scope, période
  - Bouton "New budget"
  - Click row → drawer detail

BudgetDetailDrawer :
  - En-tête : meta + variance globale (visualisation barre)
  - Table lignes : category, planned, actual, variance, variancePct (couleur vert/jaune/rouge)
  - Actions : Add line, Edit line, Delete line, Close budget
  - Onglet "Linked entries" : FinanceEntries agrégés

Permissions : useFinancePermissions() avec finance.budgets.*
Commit : feat(finance): budgets page + detail drawer — ref Finance-4
```

**Routing :** `NeoxDashboard.tsx:498-501` — remplacer `<BudgetsPlaceholder />` par `<BudgetsPage />`.

**Critères de sortie F4.4**
- [ ] `BudgetsPlaceholder` supprimé (ou laissé pour exports inutilisés à nettoyer)
- [ ] CRUD complet fonctionnel
- [ ] Variance colorée selon seuil (vert <80% / jaune 80-100% / rouge >100%)

### F4.5 — Tests d'intégration

**Fichier :** `backend/tests/finance/finance-budgets.test.mjs`

```
Tests requis :
  1. Create budget + add lines + read detail
  2. computeBudgetActuals avec FinanceEntries seedés (cohérence agrégation)
  3. Filtrage par scope (dept vs project)
  4. Close budget — status transition + verrouillage
  5. Variance calculée correctement (planned 1000, actual 1200 → -200 / -20%)
  6. RBAC : 403 sans finance.budgets.write
  7. Unique constraint (budgetId, categoryId) respectée
Commit : test(finance): budgets integration — close Finance-4
```

**Critères de sortie F4.5**
- [ ] 7/7 assertions ✓
- [ ] Runnable via `npm run test:finance-budgets`

### Critères de sortie Sprint Finance-4

- [ ] Modèles `Budget` + `BudgetLine` en DB
- [ ] 8 routes gated par 3 nouvelles permissions
- [ ] `BudgetsPage` opérationnel, placeholder disparu
- [ ] Tests F4.5 verts (7/7)
- [ ] Sidebar `finance-budgets` route vers page complète

---

## 8. Dettes ouvertes

| ID | Description | Bloquée par | Sprint cible | Statut |
|---|---|---|---|---|

### Dettes connexes (hors scope sprints 1–4 — backlog Finance)

| ID candidat | Description | Sprint cible |
|---|---|---|
| DF1 | Routes Finance toutes dans `auth-server.mjs` (1406-1968) — pas de `backend/routes/finance/` comme PM/HRM | Sprint Finance-Infra |
| DF2 | Inconsistance `Project.currency` vs `FinanceEntry.currencyCode` (cf. `NEOX_PM_PLAN.md:346`) | Sprint Reporting cross-modules |
| DF3 | Aucun modèle `BankAccount` / `BankStatement` / `BankTransaction` — réconciliation actuelle = matching interne seul | Sprint Finance-5 |
| DF4 | Aucun `Account` / `JournalEntry` proper (chart of accounts) — `FinanceEntry` reste plat | Sprint Finance-Compta |
| DF5 | Aucun `TaxRate` / `TaxLine` (TVA, IPR) | Sprint Finance-Fiscal |
| DF6 | Aucun `FxRate` (multi-currency réel) | Sprint Finance-Fiscal |
| DF7 | Aucun `CashFlowForecast` | Sprint Finance-Forecast |
| DF8 | Route `DELETE /api/v1/finance/hrm/payroll-schedules/:id` absente (toggle isActive uniquement via POST upsert) — identifié pendant audit Sprint Finance-2 | Sprint Finance-Infra |
| DF9 | Route `GET /api/v1/finance/hrm/payroll-periods` absente (sélecteur autonome côté UI fait via inférence depuis `run.payrollPeriodId`) — identifié pendant audit Sprint Finance-2 | Sprint Finance-Infra |
| DF10 | Routes manquantes pour Bills/Payments/Receipts/Invoices : aucun PATCH (update notes/status/dueDate), aucun DELETE soft, aucun GET detail (sauf Payables/Receivables), aucun Approve/Reject sur Bills, aucun Send/Cancel sur Invoices, aucun Adjust sur Receivables. Permission `finance.bills.execute` mentionnée dans le plan original §6 mais absente du catalogue RBAC. Identifié pendant audit pré-écriture Sprint Finance-3. Détail drawer read-only en attendant. | Sprint Finance-Infra |

---

## 9. Dettes fermées

| ID | Sprint de fermeture | Commit | Notes |
|---|---|---|---|
| **D2** | Sprint Finance-1 (2026-05-25) | `7b60b53` + `6ba94e7` + `6ff99b6` + `6580e44` | Audit pré-écriture a révélé que la route `PATCH /details` + service `saveProjectItemDetails` existaient déjà avec sync finance idempotente. F1.1 ramené à un patch 404 ciblé (helper `notFound` pattern `workItemHierarchy`). F1.2/F1.3 = wiring frontend (store + bouton Retry avec pending state + toast, mapping snake/camel inline dans le store, réutilisation de `saveProjectItemDetailsToBackend` existant — pas de nouveau client API). F1.4 = 8/8 assertions vertes au premier run (succès + retry-only + champ stripé + 403 + 2×404 + SSE + idempotence). Décisions actées : single check `pm.workItems.write` (la sync est un side-effect implicite, pas un acte RBAC séparé), pas de flag `retryFinanceSync` dans le body (retry = save sans diff). |
| **DH3** | Sprint Finance-2 (2026-05-25) | `348e164` + `aac9f0f` + `6409163` + `b09ba41` + `fb6636f` + `357d641` + `edbfa4c` | Audit pré-écriture a corrigé 2 fausses hypothèses : FinancePayrollPage déjà à 70% sur `PayrollRun` (pas legacy à abandonner), engine 100% complet (pas 95%). Sprint recadré en 6 sous-tâches frontend + 1 tests, 0 réécriture. **F2.2** : API client typé (15 endpoints) + types canoniques alignés Prisma. **F2.3** : bouton Run due, toggle isActive par schedule (optimistic+revert), Salary Profiles → modal. **F2.4** : 4 onglets Run detail (Calculations, Adjustments, Logs, Timesheets) via Promise.all dans `getPayrollRunDetail` (option B sans migration). **F2.5** : workflow UX clarifié — StateBadge contextuel, boutons uniquement quand l'état le permet (Post sur pending_validation, Disburse all sur lines pending, Reconcile quand toutes paid), confirm dialogs avec résumé. Suppression du bouton manuel Approve (auto via postPayrollRun → engine L773). **F2.6** : 998 L → 7 fichiers dans `src/components/finance/payroll/` (Dashboard orchestrateur + 6 composants ciblés). **F2.7** : 7/7 tests intégration verts (execute / adjust+propagation / post / disburse / reconcile / runDue / RBAC). **Bug latent engine corrigé** : `approvePayrollBatch` ouvrait inconditionnellement `prisma.$transaction` mais `postPayrollRun` lui passait son `tx` (TransactionClient sans `$transaction`) — fix par feature-check sur `prismaOrTx.$transaction`. Code path jamais exécuté end-to-end avant ce test, aurait crashé en prod au premier Post run UI. PayrollBatch conservé comme conteneur disbursement (rôle légitime). |

---

## 10. Règles transversales

À respecter sans exception sur tous les sprints Finance (héritées de HRM-2.x — cf. `HANDOFF.md` §2 et `NEOX_HRM_PLAN.md`).

1. **Soft delete partout** sur les nouveaux modèles : `isDeleted Boolean @default(false) + deletedAt DateTime?`.
2. **`assertPermission(ctx, key)` sur chaque nouvelle route Finance dès le premier commit** — pas en post.
   - Helper : `backend/services/auth/rbac.service.mjs` (signature raw http `{ userId, res }`).
3. **Page UI touchée = migration `can()` → `usePermissions()`** dans le **même commit** (suivre l'état d'avancement de la migration globale documenté dans `HANDOFF.md`).
4. **Migrations Prisma** : `npx prisma migrate deploy` (DH6 fermé, mais on garde le pattern défensif sur les migrations cross-équipe) :
   - `CREATE TABLE IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DO $$ ... pg_constraint guards $$` sur chaque FK
5. **Pattern de 4 commits par sous-tâche** (cohérent HRM-2.x) :
   - Commit 1 : modèles Prisma + migration deploy
   - Commit 2 : service + routes backend (assertPermission partout)
   - Commit 3 : frontend + API client + migration `can()` consumers concernés
   - Commit 4 : tests intégration + plan tické
6. **Plan tické après chaque étape** — cocher la case correspondante dans ce fichier avant de demander le OK suivant (cf. mémo utilisateur `feedback_plan_checklist_update.md`).
7. **Évidence + audit** : toute mutation Finance significative écrit un `FinanceActivity` (pattern existant) ; les uploads d'evidence passent par `uploadFinanceEvidence` (déjà gated `finance.evidence.upload`).
8. **Pas de hard-delete** sur `FinanceEntry`, `PayrollRun`, `Budget` — utiliser `isDeleted` + transitions de status (`cancelled`, `void`, `closed`).
9. **Pas de logique finance dans le frontend** — toujours backend autoritatif (règle issue du Sprint PM-2). Les calculs (variance, aging, totaux) sont au choix front si dérivables d'un detail backend, jamais comme source de vérité.
10. **Cohérence registry RBAC** : toute nouvelle permission `finance.*` est ajoutée au seed `prisma/seed/rbac.seed.mjs` ET propagée à `super_admin` (ALL_KEYS), `finance_admin` (...FIN_KEYS), `readonly` (.read uniquement). Cf. `RBAC_GUIDELINES.md`.

---

## Notes opérationnelles

### Branche & worktree

- Worktree : `D:\Mon mari\Google Antigravity\erp_polygons\.claude\worktrees\sprint-finance`
- Branche : `claude/sprint-finance`
- À synchroniser régulièrement avec `master` (rebase recommandé) — le sprint HRM-2.x peut continuer en parallèle.

### Démarrer

```powershell
cd "D:\Mon mari\Google Antigravity\erp_polygons\.claude\worktrees\sprint-finance"
npm run auth:api    # backend
npm run dev         # frontend (autre terminal)
```

### Suites de tests à créer

```powershell
npm run test:pm-work-item-details    # Sprint Finance-1
npm run test:finance-payroll         # Sprint Finance-2
npm run test:finance-bills           # Sprint Finance-3
npm run test:finance-payments        # Sprint Finance-3
npm run test:finance-receipts        # Sprint Finance-3
npm run test:finance-invoices        # Sprint Finance-3
npm run test:finance-receivables     # Sprint Finance-3
npm run test:finance-budgets         # Sprint Finance-4
```

(Ajouter les scripts correspondants dans `package.json` au fur et à mesure.)

### Lecture obligatoire avant de démarrer

1. `docs/NEOX_HRM_PLAN.md` §HRM-2.x pour le pattern 4-commits
2. `docs/RBAC_GUIDELINES.md` pour les conventions permission
3. `HANDOFF.md` pour l'état runtime
4. `backend/services/hrm/payrollEngine.service.mjs` (avant Sprint Finance-2)
5. `src/components/PayablesPage.tsx` (référence qualité pour Sprint Finance-3)
