# NEOX ERP — Plan : Facturation pilotée par les projets (AR / Invoicing)

**Statut global :** 🟡 **Plan — en attente de validation des décisions de conception** (aucun code écrit)
**Date de création :** 2026-06-13
**Dernière mise à jour :** 2026-06-13
**Origine :** discussion produit — refonte du flux Projet → Receivable → Invoice → Paiement.

---

## 1. Objectif

Faire de la **facture (CustomerInvoice)** le document client qui **regroupe tous les receivables d'un projet**, **généré automatiquement à la clôture** (et manuellement en cours de route), avec **enregistrement du paiement au niveau facture**. Le receivable reste le contrôle interne par item de projet.

> Aujourd'hui c'est l'inverse : un receivable par work-item (`…wi-…:po_unit_price_completed`), une facture créée **manuellement** liée à **un seul** receivable, paiement attaché au receivable. Picorer un receivable à la main pour facturer est contre-nature.

---

## 2. État actuel (audit code, 2026-06-13)

| Élément | Réalité actuelle | Citation |
|---|---|---|
| Création receivable | Auto, **par work-item terminé** (`po_unit_price_completed`) via `syncProjectItemStateToFinance` → `upsertReceivableControl` | [financeEntries.service.mjs:524](backend/services/finance/financeEntries.service.mjs:524), [:436](backend/services/finance/financeEntries.service.mjs:436) |
| Lien projet | ✅ `Receivable.projectId` et `workItemId` **existent déjà** | [schema.prisma:940](prisma/schema.prisma:940) |
| Invoice ↔ Receivable | **1 facture : 1 receivable** (`CustomerInvoice.receivableId`) | [schema.prisma:994](prisma/schema.prisma:994) |
| Création invoice | Manuelle, `createCustomerInvoice({ receivableId })` — un seul receivable | [financeEntries.service.mjs:1301](backend/services/finance/financeEntries.service.mjs:1301) |
| Paiement | `ReceiptCollection.receivableId` → **attaché au receivable, PAS à la facture** | [schema.prisma:1060](prisma/schema.prisma:1060) |
| Statut paiement receivable | Recalculé par `refreshReceivableTotals` (collected/outstanding/status) | [financeEntries.service.mjs:1203](backend/services/finance/financeEntries.service.mjs:1203) |
| Clôture projet | ❌ **Aucun hook** — `status` est un string libre sans effet de bord | [projectCrud.service.mjs:122](backend/services/pm/projectCrud.service.mjs:122) |
| Grouper receivables d'un projet | ✅ Trivial via `where: { projectId }` | [financeEntries.service.mjs:1067](backend/services/finance/financeEntries.service.mjs:1067) |

**Verdict :** direction validée, mais **non faisable en l'état** — il faut basculer la cardinalité invoice↔receivable de 1:1 → 1:N, ajouter un déclencheur de clôture, et un modèle de paiement au niveau facture.

---

## 3. Décisions de conception — ⚠️ À VALIDER

| # | Décision | Recommandation | Alternative |
|---|---|---|---|
| **D1** | Lien 1 facture : N receivables | **Table `CustomerInvoiceLine`** (invoiceId, receivableId, description, amount) — garde le détail par item | Simple `invoiceId` posé sur Receivable (perd le détail de ligne) |
| **D2** | Déclencheur de facturation | **Progressif + clôture** : génération manuelle possible en cours de projet, ET auto à la clôture pour les receivables non encore facturés | Clôture uniquement (plus rigide) |
| **D3** | Idempotence | **Flag `invoiceId` (nullable) sur Receivable** → un receivable est facturé au plus une fois ; la génération ne prend que les `invoiceId == null` | — |
| **D4** | Paiement | Saisi **au niveau facture** → **alloué automatiquement** aux receivables de la facture | Garder paiement par receivable uniquement |
| **D5** | Règle d'allocation paiement | **Au prorata de l'encours** de chaque ligne | FIFO (plus ancien d'abord) |
| **D6** | Regroupement | **1 facture par (projet, devise)** — on ne mélange pas les devises | 1 facture par projet (KO si multi-devise) |
| **D7** | TVA / Tax | **En-tête de facture, saisie manuelle** pour l'instant (les receivables projet ne portent pas de TVA) | TVA par ligne (plus tard) |

> Les phases ci-dessous supposent les **recommandations**. Si tu changes un arbitrage, la phase concernée s'ajuste.

---

## 4. Modèle de données cible

### Nouvelles structures
- **`CustomerInvoiceLine`** *(nouveau)* : `id, invoiceId (FK), receivableId (FK), description, amount, createdAt`. Une ligne = un receivable facturé.
- **`Receivable.invoiceId`** *(nouveau, nullable)* : marque « déjà facturé » + garde-fou idempotence.
- **`CustomerInvoice.projectId`** *(nouveau, nullable)* : projet facturé (affichage + regroupement).
- **`CustomerInvoice.status`** : étendre → `draft | sent | partially_paid | paid | cancelled` (dérivé du paiement).
- **`ReceiptCollection.invoiceId`** *(nouveau, nullable)* : rattache un encaissement à la facture (rollup/reporting). Les receipts restent aussi liés au receivable.

### Conservé (compat)
- `CustomerInvoice.receivableId` → **rendu nullable**, déprécié au profit des lignes (backfill : 1 ligne par invoice existant).
- `refreshReceivableTotals` inchangé par receivable ; on ajoute un `refreshInvoiceTotals(invoiceId)` qui agrège les lignes.

---

## 5. Découpage en sprints (chaque phase est livrable indépendamment)

### Sprint AR-1 — Modèle de données + lignes (aucun changement de comportement) ✅ FERMÉ (2026-06-13)
- [x] Schéma : `CustomerInvoiceLine` (idempotence via `@unique receivableId`, pas de flag dénormalisé), `CustomerInvoice.projectId` + `receivableId` nullable + `collected/outstandingAmount` + statuts étendus, `ReceiptCollection.invoiceId`.
- [x] Migration `20260613120000_ar_invoicing` appliquée via `prisma migrate deploy` (✅ `migrate status` = up to date) + `prisma generate`.
- [x] Backfill `backfillInvoiceLines` ([prisma/backfillInvoiceLines.mjs](prisma/backfillInvoiceLines.mjs)) — idempotent, no-op actuel (0 facture existante).
- [x] Helper backend `refreshInvoiceTotals(tx, invoiceId)` exporté ([financeEntries.service.mjs](backend/services/finance/financeEntries.service.mjs)).
- [x] Aucun changement UI. **Ship.**
- **Décision affinée** : idempotence portée par la table de lignes (`invoiceLines: { none: {} }`) plutôt qu'un `Receivable.invoiceId` dénormalisé (D3) — source unique, rien à synchroniser.

### Sprint AR-2 — Générer une facture depuis un projet (manuel) ✅ BACKEND + FRONTEND
- [x] Service `createInvoiceFromProject(projectId, { currencyCode, includeReceivableIds? })` : receivables non facturés (`invoiceLines: { none }`), non annulés → 1 invoice + 1 ligne/receivable. Idempotent (vérifié : re-run = lineCount 0).
- [x] Route `POST /api/v1/finance/invoices/from-project` (perm `finance.invoices.write`).
- [x] Route `GET /api/v1/finance/projects/:id/billable-receivables`.
- [x] Frontend : bouton **« Générer depuis un projet »** + modal (picker projet via `listBudgetScopes`, aperçu receivables + total) — `invoicesApi.ts`. Typecheck OK.
- **Test API** : projet à 9 receivables → INV-…, 9 lignes, $4249, idempotent ✅. **Ship.**

### Sprint AR-3 — Déclencheur clôture projet ✅ FERMÉ
- [x] Hook sur la transition de statut vers `closed`/`completed` dans la route PATCH `/api/v1/projects/:id` ([projects.routes.mjs](backend/routes/pm/projects.routes.mjs)) → appelle `createInvoiceFromProject`. Non-bloquant (try/catch), idempotent.
- [x] **Test API** : clôture projet réel → `autoInvoice` retourné, idempotent (1 facture avant=après, aucune facture vide) ✅.
- **Décision affinée** : hook direct au niveau route (où l'orchestration cross-module est acceptable) plutôt qu'un domain-event listener — plus simple, suffisant. **Ship.**

### Sprint AR-4 — Paiement au niveau facture + statut ✅ BACKEND (frontend en cours)
- [x] Service `recordInvoicePayment(invoiceId, { amount, method, proofReference })` → alloue **prorata de l'encours** ; 1 `ReceiptCollection`/receivable (`invoiceId` + preuve synthétique) + `refreshReceivableTotals` + `refreshInvoiceTotals` ; overpayment plafonné.
- [x] Statut facture dérivé : `paid` / `partially_paid` / `sent`.
- [x] Routes `POST /api/v1/finance/invoices/:id/payment` + `GET /api/v1/finance/invoices/:id` (détail + lignes + receipts).
- [x] **Test API** : $2000 → `partially_paid` (9 receipts, outstanding $2249) ; solde $2249 → `paid`, outstanding 0 ✅.
- [x] Frontend : drawer facture (lignes + receipts), bouton **« Enregistrer le paiement »**, badge statut (`StatusPill`) — `invoicesApi.ts` `getInvoiceDetail` + `recordInvoicePayment`. Typecheck OK. **Ship.**

### Sprint AR-5 — Polissage UI / traçabilité ✅ (intégré au sous-agent AR-4)
- [x] Liste Invoices : badge statut + colonne **Outstanding**.
- [ ] Détail receivable → lien « Facturé : INV-xxx » (drill-through inverse — reste à faire, optionnel).

---

## État final (2026-06-13)
- **AR-1→AR-4 backend** : ✅ livré + vérifié au niveau API + committé `a4924d9` (pushé).
- **AR-2/AR-4/AR-5 frontend** : ✅ livré (2 sous-agents) + typecheck 0 erreur + committé `9c97c92` (pushé).
- **Données de test nettoyées** ; les 9 receivables du projet Helios One sont de nouveau facturables ($4249).
- **Non vérifié** : démo navigateur live de l'UI Invoices (instabilité du harness de preview cette session — pas un bug code ; nav/drawer identiques à Reconciliation/Receivables déjà vérifiés). À confirmer côté utilisateur.
- **Reste optionnel** : lien inverse receivable→facture (AR-5), et « send invoice » (dépend dette DF10).

---

## 6. Migration & backfill — points durs
- ⚠️ `prisma migrate dev` est cassé (baseline manquante) → utiliser `migrate deploy` ou SQL manuel ([[project_hrm_debt_dh6]]).
- Backfill invoices existants (1:1) → 1 ligne chacun + `receivable.invoiceId`. Idempotent (ne rejoue pas si ligne déjà présente).
- Receipts existants : poser `invoiceId` depuis `receivable.invoiceId` quand dispo (sinon laisser null).
- `CustomerInvoice.receivableId` gardé nullable pendant ≥1 sprint avant retrait éventuel.

---

## 7. Cas limites & risques
- **Double facturation** : garde-fou strict via `receivable.invoiceId == null` à la génération + transaction.
- **Multi-devises** dans un projet → 1 facture par devise (D6).
- **Receivables sans projet** : exclus de la génération auto (pas de `projectId`) — restent facturables manuellement.
- **Receivables annulés** : exclus.
- **Re-clôture / re-run** : idempotent (rien à facturer si tout a `invoiceId`).
- **Paiement partiel** déjà saisi au niveau receivable AVANT la facture : `refreshInvoiceTotals` lit l'état réel des receivables → cohérent.
- **Dépendance dette DF10** ([NEOX_FINANCE_PLAN.md](docs/NEOX_FINANCE_PLAN.md)) : invoices/receipts manquent PATCH/approve/send → le « send invoice » et le cycle de vie complet de la facture en dépendent (à traiter en AR-4/AR-5 ou via DF10).

---

## 8. Plan de test (par sprint)
- AR-1 : migration applique sans perte ; backfill crée N lignes = N invoices existants ; `refreshInvoiceTotals` = somme correcte.
- AR-2 : génération projet à 3 receivables → 1 invoice, 3 lignes, total correct, receivables marqués ; re-run = no-op.
- AR-3 : clôture projet → event émis → invoice auto créée ; clôture sans receivable non facturé = no-op.
- AR-4 : paiement facture $X → alloué prorata ; statut bascule `partially_paid`→`paid` ; encours receivables cohérents.
- AR-5 : drill-through receivable↔facture ; affichage statuts.

---

## 9. Décisions en attente (bloquantes pour démarrer)
Valider les arbitrages **D1–D7** (§3). Recommandation par défaut prête. Une fois validés, je démarre par **Sprint AR-1** (schéma + migration + backfill, zéro risque comportemental).
