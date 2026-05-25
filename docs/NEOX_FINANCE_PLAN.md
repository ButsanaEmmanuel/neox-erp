# NEOX ERP — Plan Module Finance

**Branche :** `claude/sprint-finance` (worktree `.claude/worktrees/sprint-finance/`)
**Statut global :** 🟢 **Sprint Finance-1 fermé** (2026-05-25 — D2 résolue, 4 commits). 1/4 sprints fermés, 3 restants. Backend ledger/AR/AP/payroll engine matures (~42 routes gatées DH9). Frontend mixte : Payables/Payroll/Reconciliation/Reports solides ; Bills/Payments/Receipts/Invoices/Receivables shallow ; Budgets placeholder. 1 dette ouverte héritée : **DH3** (Payroll UI sur mauvais modèle, Sprint Finance-2).
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

**Objectif :** Fermer DH3 — Payroll UI complète sur le nouveau modèle `PayrollRun`, abandonner `PayrollBatch` côté UI.
**Durée estimée :** 2–3 semaines
**Statut :** 🔵 Planifié
**Dettes ciblées :** DH3

---

### F2.1 — Préparation : audit consumers `PayrollBatch`

**Objectif :** Confirmer que `PayrollBatch` peut être abandonné côté UI sans casser de flow legacy.

#### Tâches

**T1 — Grep + audit**
```
grep -rn 'PayrollBatch\|payrollBatch' src/
Lister :
  - Composants UI consommateurs
  - Routes backend encore actives (/finance/hrm/payroll-batches existent)
  - SSE liés
Décision : garder routes backend (back-compat externe), supprimer UI batch
Commit : docs(finance): payroll batch consumer audit — ref DH3
```

**Critères de sortie F2.1**
- [ ] Liste exhaustive des consumers UI
- [ ] Décision documentée (garder backend, dégager UI)

### F2.2 — Service client `payrollEngineApi.ts`

**Fichier :** `src/services/payrollEngineApi.ts`

```
Endpoints à exposer (tous existent côté backend) :
  - listPayrollSchedules() / upsertPayrollSchedule(payload)
  - listPayrollRuns(filters) / getPayrollRunDetail(runId)
  - executePayrollRun(scheduleId, periodId) → POST /payroll-runs/execute
  - runDuePayrollSchedules() → POST /payroll-runs/run-due
  - adjustPayrollRunEmployee(runId, employeeId, adjustment) → existe service backend
  - approvePayrollRun(runId), postPayrollRun(runId) → mappés sur services backend
  - listSalaryProfiles() / upsertSalaryProfile(payload)
Commit : feat(finance): payroll engine API client — ref DH3
```

**Critères de sortie F2.2**
- [ ] Types stricts (générer depuis `prisma/schema.prisma`)
- [ ] Tous les endpoints engine accessibles

### F2.3 — Écran Schedules

**Fichier :** `src/components/finance/payroll/PayrollSchedulesPage.tsx` (nouveau dossier `src/components/finance/payroll/`)

```
Sections :
  - Liste PayrollSchedule (departmentId, cadence, nextRunAt, isActive)
  - Modal create/edit (cohérent FormKit existant)
  - Bouton "Run due now" → runDuePayrollSchedules()
  - Historique : PayrollScheduleHistory par schedule (drawer)
Permissions : hrm.payroll.read pour liste, hrm.payroll.write pour CRUD, hrm.payroll.execute pour run-due
Commit : feat(finance): payroll schedules UI — ref DH3
```

**Critères de sortie F2.3**
- [ ] Créer un schedule, l'activer/désactiver
- [ ] "Run due" déclenche les schedules échus
- [ ] Historique visible

### F2.4 — Écran Runs (liste + détail)

**Fichiers :**
- `src/components/finance/payroll/PayrollRunsListPage.tsx`
- `src/components/finance/payroll/PayrollRunDetailPage.tsx`

```
Liste :
  - Colonnes : runNumber, period, status (draft/calculated/approved/posted), totalGross, totalNet, runDate
  - Filtres : status, period, schedule
  - Action : "Execute new run" (depuis schedule + period)

Détail (drawer ou page) :
  - En-tête : status, totals, schedule lien
  - Onglet "Employees" : PayrollRunEmployee (employee, grossPay, netPay, status, bouton "Adjust")
  - Onglet "Calculations" : PayrollCalculationDetail par employee (allowances, deductions, taxes)
  - Onglet "Adjustments" : PayrollAdjustment (créateur, raison, montant, approuvé)
  - Onglet "Timesheets" : PayrollRunTimesheetLink (lien vers TimesheetEntry)
  - Onglet "Logs" : PayrollRunLog (audit trail)
  - Onglet "Notifications" : PayrollNotification (envoyées aux employés)
  - Onglet "Disbursements" : PayrollDisbursementLine (status payment per employee)

Workflow buttons :
  - draft → "Calculate" (recalculer)
  - calculated → "Approve" (hrm.payroll.execute)
  - approved → "Post" (crée FinanceEntries)
  - posted → "Disburse" (déclenche PaymentDisbursement par ligne)

Commit : feat(finance): payroll runs UI — ref DH3
```

**Critères de sortie F2.4**
- [ ] Exécuter un run → ajuster une ligne → approuver → poster → disburser, end-to-end
- [ ] Logs et notifications visibles
- [ ] Lien timesheets fonctionnel

### F2.5 — Migration `FinancePayrollPage.tsx`

**Objectif :** L'ancien `FinancePayrollPage.tsx` (618 L, branché `PayrollBatch`) devient le shell qui héberge Schedules/Runs/Salary Profiles via tabs.

```
Options :
  (a) Réécrire FinancePayrollPage.tsx en orchestrateur (tabs : Runs / Schedules / Salary Profiles / Legacy Batches optionnel)
  (b) Supprimer FinancePayrollPage.tsx, router activeView 'finance-hrm-payroll' vers PayrollRunsListPage
Recommandation : (a) pour garder un point d'entrée unique sidebar
Commit : refactor(finance): replace PayrollBatch UI with PayrollRun — ref DH3
```

**Critères de sortie F2.5**
- [ ] Sidebar "HRM Payroll" affiche le nouveau shell
- [ ] Aucun composant UI ne lit/écrit `PayrollBatch` (audit grep)
- [ ] Routes backend `/payroll-batches` restent mais non consommées UI (annotation TODO backlog)

### F2.6 — Tests d'intégration

**Fichier :** `backend/tests/finance/finance-payroll-engine.test.mjs`

```
Tests requis :
  1. executePayrollRun → run draft créé avec employees + calculations
  2. adjustPayrollRunEmployee → adjustment ajouté, totaux recalculés
  3. approvePayrollRun → status = approved, log écrit
  4. postPayrollRun → FinanceEntries créées, status = posted
  5. disbursePayrollLine → PaymentDisbursement créé
  6. runDuePayrollSchedules → schedules échus déclenchés, autres ignorés
  7. RBAC : 403 sans hrm.payroll.execute sur approve/post/disburse
Commit : test(finance): payroll engine integration — close DH3
```

**Critères de sortie F2.6**
- [ ] 7/7 assertions ✓
- [ ] Runnable via `npm run test:finance-payroll`

### Critères de sortie Sprint Finance-2

- [ ] Écrans Schedules, Runs (list + detail), Salary Profiles opérationnels
- [ ] Workflow Execute → Adjust → Approve → Post → Disburse end-to-end UI
- [ ] Aucun composant UI ne lit `PayrollBatch`
- [ ] Tests F2.6 verts (7/7)
- [ ] **DH3 fermée** — entrée déplacée vers §9 Dettes fermées

---

## 6. Sprint Finance-3

**Objectif :** Transformer les 5 pages shallow en CRUD complets, cohérents avec `PayablesPage.tsx` (549 L, référence de qualité).
**Durée estimée :** 2 semaines
**Statut :** 🔵 Planifié
**Dettes ciblées :** Aucune dette formelle — closure de la maturité Finance

---

### F3.1 — `BillsPage.tsx` (59 L → CRUD complet)

```
Sections requises :
  - Liste VendorBill : billNumber, vendor, dueDate, amount, status, evidence
  - Filtres : status, vendor, période, project lien
  - Drawer detail : lignes, evidence documents, approval workflow, lien Payable
  - Modal create : sélecteur vendor, lignes (description, qty, unitPrice, amount), evidence upload
  - Actions : Approve / Reject (assertPermission finance.bills.write/execute)
  - Export CSV
Endpoints existants : GET/POST /api/v1/finance/bills
Permissions : finance.bills.read / finance.bills.write
Commit : feat(finance): bills page CRUD complet — ref Finance-3
```

### F3.2 — `PaymentsPage.tsx` (61 L → CRUD complet)

```
Sections requises :
  - Liste PaymentDisbursement : reference, vendor, amount, method, date, status
  - Filtres : method (cash/bank/mobile), status, vendor, période
  - Drawer detail : lignes payées (Payable/Bill liés), evidence (proof of payment)
  - Modal create : sélecteur Payable/Bill à régler, montant, méthode, evidence upload
  - Liaison automatique avec FinanceLedgerMapping (méthode → account)
Endpoints : GET/POST /api/v1/finance/payments
Permissions : finance.payments.read / finance.payments.write
Commit : feat(finance): payments page CRUD complet — ref Finance-3
```

### F3.3 — `ReceiptsPage.tsx` (61 L → CRUD complet)

```
Symétrique PaymentsPage côté inbound :
  - Liste ReceiptCollection : reference, customer, amount, method, date, status
  - Drawer : Receivables/Invoices réglés, evidence (bordereau, virement)
  - Modal create : sélecteur Receivable/Invoice à recouvrer
Endpoints : GET/POST /api/v1/finance/receipts
Permissions : finance.receipts.read / finance.receipts.write
Commit : feat(finance): receipts page CRUD complet — ref Finance-3
```

### F3.4 — `InvoicesPage.tsx` (109 L → CRUD complet)

```
Sections requises :
  - Liste CustomerInvoice : invoiceNumber, customer, dueDate, amount, status, lien Receivable
  - Filtres : status, customer, période, project, deal source
  - Drawer detail : lignes, evidence, status workflow, lien Receivable, lien CrmDeal source
  - Modal create : sélecteur customer + project + deal, lignes, taxes (flat pour l'instant), evidence
  - Actions : Send (email future), Mark sent, Cancel
Endpoints : GET/POST /api/v1/finance/invoices
Permissions : finance.invoices.read / finance.invoices.write
Commit : feat(finance): invoices page CRUD complet — ref Finance-3
```

### F3.5 — `ReceivablesPage.tsx` (102 L → CRUD complet)

```
Sections requises :
  - Liste Receivable : reference, customer, dueDate, amount, status, agedBucket (0-30/31-60/61-90/90+)
  - Filtres : status, customer, agedBucket, project
  - Drawer detail : Invoice source, Receipts liés, evidence, activity
  - Vue "Aging report" : table buckets par customer
  - Actions : Adjust (write-off, escalade)
Endpoints : GET /api/v1/finance/receivables + détail /:id
Permissions : finance.receivables.read / finance.receivables.write
Commit : feat(finance): receivables page CRUD complet + aging — ref Finance-3
```

### F3.6 — Tests d'intégration (5 suites)

```
backend/tests/finance/
  finance-bills.test.mjs
  finance-payments.test.mjs
  finance-receipts.test.mjs
  finance-invoices.test.mjs
  finance-receivables.test.mjs

Chaque suite :
  - Create entité + lecture
  - Update (status transitions)
  - Liaison evidence
  - RBAC : 403 sans permission appropriée
  - Soft delete si applicable
Commit : test(finance): CRUD pages integration — ref Finance-3
```

### Critères de sortie Sprint Finance-3

- [ ] 5 pages avec CRUD complet (>= 300 L chacune, cohérent qualité Payables)
- [ ] Evidence upload fonctionnel sur Bills/Invoices/Payments/Receipts
- [ ] Aging report sur Receivables
- [ ] 5 suites de tests vertes
- [ ] Sidebar Finance entièrement consommée par pages matures

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
| **DH3** | Payroll UI absente sur l'engine moderne : `FinancePayrollPage.tsx` (618 L) consomme l'ancien modèle `PayrollBatch`, pas le nouveau workflow `PayrollRun` (engine `backend/services/hrm/payrollEngine.service.mjs` 95% prêt avec executePayrollRun / approvePayrollRun / postPayrollRun / disburse / adjustments / logs / notifications déjà wirés sur 7 routes). | Aucun blocage technique — engine 95% prêt. Bloquée par coût UI uniquement (cf. F2.3 → F2.5). | **Sprint Finance-2** | 🔵 Planifié |

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

---

## 9. Dettes fermées

| ID | Sprint de fermeture | Commit | Notes |
|---|---|---|---|
| **D2** | Sprint Finance-1 (2026-05-25) | `7b60b53` + `6ba94e7` + `6ff99b6` + `6580e44` | Audit pré-écriture a révélé que la route `PATCH /details` + service `saveProjectItemDetails` existaient déjà avec sync finance idempotente. F1.1 ramené à un patch 404 ciblé (helper `notFound` pattern `workItemHierarchy`). F1.2/F1.3 = wiring frontend (store + bouton Retry avec pending state + toast, mapping snake/camel inline dans le store, réutilisation de `saveProjectItemDetailsToBackend` existant — pas de nouveau client API). F1.4 = 8/8 assertions vertes au premier run (succès + retry-only + champ stripé + 403 + 2×404 + SSE + idempotence). Décisions actées : single check `pm.workItems.write` (la sync est un side-effect implicite, pas un acte RBAC séparé), pas de flag `retryFinanceSync` dans le body (retry = save sans diff). |

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
