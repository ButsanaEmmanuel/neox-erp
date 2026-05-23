# NEOX ERP — Plan Module HRM
**Branche :** `claude/angry-sinoussi-faf92c`
**Statut global :** ✅ **Sprint HRM-1 fermé** — toutes les tâches HRM-1.0 → HRM-1.5 livrées (D5, D6, D15 closes). Migration des 9 consumers `can()` UI restants en post (non bloquante, 1 commit/page).
**Dernière mise à jour :** 2026-05-23

---

## Table des matières

1. [Contexte et état de départ](#1-contexte-et-état-de-départ)
2. [Périmètre du module](#2-périmètre-du-module)
3. [Catalogue de permissions atomiques](#3-catalogue-de-permissions-atomiques)
4. [Sprint HRM-1 — Fondations RBAC + Directory + Leave](#4-sprint-hrm-1)
5. [Sprint HRM-2 — Workflows + Finition + Tests](#5-sprint-hrm-2)
6. [Dettes ouvertes](#6-dettes-ouvertes)
7. [Règles transversales](#7-règles-transversales)

---

## 1. Contexte et état de départ

### Dettes PM héritées traitées dans ce sprint

| ID | Description | Traitement |
|---|---|---|
| D5 | FK RESTRICT manquant sur `ProjectMember` | Fermée en HRM-1.0 (migration groupée) |
| D6 | `src/lib/rbac.ts` hardcodé | Fermée en HRM-1.2 (migration DB-driven) |
| D15 | Assignés télécom → auto-création contractor HRM | Fermée en HRM-1.4 |

### État de l'existant (audit 2026-05-23)

| Zone | Maturité | Détail |
|---|---|---|
| Directory / Employees / Departments | 🟢 90% | CRUD mature, `hrmDirectory.service.mjs` (1252L) |
| Payroll | 🟢 95% | Engine complet (895L), 13 modèles, ~12 routes finance |
| Org chart | 🟢 85% | `HRMOrgView` présent, données réelles |
| Timesheets | 🟡 60% | Modèle `TimesheetEntry` + UI WeekEditor — routes partielles |
| Recruitment | 🟡 50% | 1 modèle DB + UI complète + service `.ts` à porter en `.mjs` |
| Leave | 🔴 20% | UI présente, **aucun modèle DB ni route** |
| Training | 🔴 20% | UI présente, **aucun modèle DB ni route** |
| Onboarding / Offboarding | 🔴 20% | UI présente, service 170L stub, **aucun modèle DB** |
| Policies | 🔴 20% | UI présente, **aucun modèle DB ni route** |
| Cases | 🔴 20% | UI présente, **aucun modèle DB ni route** |
| RBAC UI (Configuration) | 🔴 0% | Non existant — à créer |
| Tests | 🔴 0% | Aucun test HRM |

### Fichiers backend clés

```
backend/
  services/hrm/
    hrmDirectory.service.mjs          # 1252L — CRUD employees/departments
    payrollEngine.service.mjs         # 895L  — engine paie
    recruitmentOnboarding.service.ts  # 170L  — stub (seul .ts dans backend)
  routes/                             # À créer — nouveau module séparé de auth-server.mjs
```

### Fichiers frontend clés

```
src/
  pages/hrm/
    HRMLayout.tsx / HRMRouter.tsx     # Structure routing
    HRMDashboard.tsx
    DirectoryPage.tsx                 # Mature
    LeavePage.tsx                     # UI sans backend
    TrainingPage.tsx                  # UI sans backend
    OnboardingPage.tsx                # UI sans backend
    OffboardingPage.tsx               # UI sans backend
    RecruitmentPage.tsx               # UI partielle
    TimesheetsPage.tsx                # UI partielle
    PoliciesPage.tsx                  # UI sans backend
    CasesPage.tsx                     # UI sans backend
  store/hrm/useHRMStore.ts            # 777L — à auditer/refactoriser
  services/hrmApi.ts                  # 174L — client API
  types/hrm.ts                        # Types à étendre
```

---

## 2. Périmètre du module

### Ce que le Sprint HRM couvre

1. **RBAC DB-driven** — catalogue de permissions, UI d'administration, résolution runtime
2. **Leave management** — demandes, soldes, politiques, approbation workflow
3. **Recruitment** — pipeline candidats, offres, statuts, portage `.ts` → `.mjs`
4. **Onboarding / Offboarding** — checklists, tâches, workflow d'activation/désactivation
5. **Training** — cours, inscriptions, certifications
6. **Policies** — documents RH, versions, accusés de réception
7. **Cases** — incidents, griefs, suivi
8. **Timesheets** — complétion des routes manquantes, lien payroll
9. **Tests** — couverture HRM backend

### Ce que le Sprint HRM ne couvre pas

- Payroll UI (déjà mature, sprint Finance priorité 3)
- Analytics avancés cross-modules (sprint Reporting priorité 5)
- Refonte de `useHRMStore.ts` au-delà du strict nécessaire (dette DH1)

---

## 3. Catalogue de permissions atomiques

### Principe

Les permissions sont définies une fois par les devs au déploiement (seed Prisma). Elles ne changent jamais sans migration. L'HR admin compose des **Rôles** à partir de ces permissions via l'UI.

### Format

`<module>.<ressource>.<action>`

Actions standards : `read` · `write` · `delete` · `execute`

- `read` — voir les données
- `write` — créer et modifier
- `delete` — soft-delete (jamais hard-delete)
- `execute` — déclencher une action métier (approuver, signer, lancer un workflow)

### Catalogue complet

#### Module HRM

```
hrm.directory.read
hrm.directory.write
hrm.directory.delete
hrm.employees.read
hrm.employees.write
hrm.employees.delete
hrm.departments.read
hrm.departments.write
hrm.contractors.read
hrm.contractors.write
hrm.leave.read              # Voir les demandes (toutes)
hrm.leave.write             # Soumettre une demande (self)
hrm.leave.execute           # Approuver / rejeter
hrm.leave.admin             # Gérer les politiques et soldes
hrm.timesheets.read
hrm.timesheets.write
hrm.timesheets.execute      # Valider une feuille de temps
hrm.recruitment.read
hrm.recruitment.write
hrm.recruitment.execute     # Marquer embauché / rejeté
hrm.onboarding.read
hrm.onboarding.write
hrm.onboarding.execute      # Compléter / valider une tâche checklist
hrm.offboarding.read
hrm.offboarding.write
hrm.offboarding.execute
hrm.training.read
hrm.training.write
hrm.training.execute        # Inscrire un employé / valider une certification
hrm.policies.read
hrm.policies.write
hrm.policies.execute        # Publier / archiver une politique
hrm.cases.read
hrm.cases.write
hrm.cases.execute           # Escalader / clôturer un cas
hrm.payroll.read
hrm.payroll.write
hrm.payroll.execute         # Lancer / approuver un batch payroll
hrm.configuration.read      # Voir la config RH
hrm.configuration.write     # Modifier rôles, templates, automation rules
```

#### Module PM

```
pm.projects.read
pm.projects.write
pm.projects.delete
pm.projects.execute         # Archiver / clôturer un projet
pm.workItems.read
pm.workItems.write
pm.workItems.delete
pm.workItems.execute        # Soumettre QA / approuver / signer
pm.milestones.read
pm.milestones.write
pm.milestones.execute       # Marquer complet
pm.documents.read
pm.documents.write
pm.documents.delete
pm.scope.read
pm.scope.write
pm.import.execute           # Lancer un import bulk télécom
pm.finance.read             # Voir les entrées finance liées
pm.finance.execute          # Pousser une sync finance
```

#### Module Finance

```
finance.ledger.read
finance.ledger.write
finance.ledger.execute      # Valider / réconcilier une entrée
finance.payroll.read
finance.payroll.execute
finance.expenses.read
finance.expenses.write
finance.expenses.execute    # Approuver une note de frais
finance.advances.read
finance.advances.write
finance.advances.execute
finance.reports.read
finance.reports.execute     # Générer / exporter
```

#### Module SCM

```
scm.suppliers.read
scm.suppliers.write
scm.suppliers.delete
scm.purchaseOrders.read
scm.purchaseOrders.write
scm.purchaseOrders.execute  # Approuver / émettre
scm.inventory.read
scm.inventory.write
scm.contracts.read
scm.contracts.write
scm.contracts.execute       # Signer / résilier
```

#### Module HSE

```
hse.incidents.read
hse.incidents.write
hse.incidents.execute       # Clôturer / escalader
hse.inspections.read
hse.inspections.write
hse.inspections.execute
hse.reports.read
hse.reports.execute
```

#### Système

```
system.rbac.read            # Voir les rôles et permissions
system.rbac.write           # Créer / modifier des rôles
system.rbac.execute         # Assigner des rôles / overrides
system.audit.read           # Voir les logs d'audit
system.settings.read
system.settings.write
```

### Rôles prédéfinis (seed initial)

| Rôle | Permissions incluses |
|---|---|
| `super_admin` | Toutes les permissions |
| `hr_admin` | Toutes `hrm.*` + `system.rbac.*` |
| `hr_officer` | `hrm.directory.*` + `hrm.leave.*` + `hrm.timesheets.*` + `hrm.recruitment.*` + `hrm.onboarding.*` + `hrm.offboarding.*` |
| `employee_self_service` | `hrm.leave.write` + `hrm.timesheets.write` + `hrm.policies.read` + `hrm.training.read` |
| `project_manager` | Toutes `pm.*` + `finance.ledger.read` + `hrm.directory.read` |
| `project_member` | `pm.projects.read` + `pm.workItems.read` + `pm.workItems.write` + `pm.workItems.execute` |
| `finance_admin` | Toutes `finance.*` + `hrm.payroll.*` |
| `finance_officer` | `finance.ledger.read` + `finance.expenses.*` + `finance.advances.*` |
| `scm_manager` | Toutes `scm.*` |
| `readonly` | `*.*.read` sur tous les modules |

---

## 4. Sprint HRM-1

**Objectif :** Fondations RBAC + Directory + Leave
**Durée estimée :** 3–4 semaines
**Statut :** 🔵 Planifié

---

### HRM-1.0 — Nettoyage pré-sprint (Migrations & dettes PM) ✅

**Objectif :** Environnement propre avant d'ajouter des modèles HRM.
**Statut :** ✅ Fermé 2026-05-23 — commits `48dc0af` (T3) + `0d66980` (T1) + cette mise à jour du plan (T2).

#### Tâches

**T1 — Migration FK RESTRICT groupée (D5)**
```
Fichier : prisma/migrations/YYYYMMDD_fk_restrict_cleanup/
Modèles touchés : ProjectMember, ProjectDocument, ProjectScope,
                  WorkItem, Milestone
Action : changer onDelete: Cascade → onDelete: Restrict là où
         la suppression en cascade est dangereuse
Commit : fix(db): add FK RESTRICT constraints — close D5
```

**T2 — Audit du schéma HRM existant**
```
Lire prisma/schema.prisma sections :
  - Department (ligne 10)
  - User champs HRM (ligne 29)
  - HrmEmploymentProfile (ligne 117)
  - HrmCredentialProvisioning (ligne 161)
  - AccessProvisioning (ligne 1519)
  - TimesheetEntry (ligne 1453)
  - RecruitmentCandidate (ligne 1495)
Produire : liste des champs manquants vs UI existante
```

**T3 — Porter `recruitmentOnboarding.service.ts` → `.mjs`**
```
Action : renommer + convertir imports/exports ES modules
Test : import propre depuis les nouvelles routes
Commit : refactor(hrm): port recruitmentOnboarding to ESM
```

**Critères de sortie HRM-1.0**
- [x] Migration FK générée — `prisma/migrations/20260523_fk_restrict_cleanup/` (à appliquer sur DB dev via `npx prisma migrate dev`)
- [x] Schéma HRM audité, delta documenté — voir *Notes d'audit HRM-1.0* ci-dessous
- [x] Plus aucun fichier `.ts` dans `backend/` (4 fichiers portés, pas 1 — voir notes)

#### Notes d'audit HRM-1.0 (ajoutées 2026-05-23)

**FK RESTRICT — T1 réalisé (commit `0d66980`)**
- `ProjectScope.projectId` : CASCADE → RESTRICT
- `Milestone.projectId` : CASCADE → RESTRICT
- `ProjectMember.projectId` : default → RESTRICT
- `ProjectMember.userId` : default → RESTRICT
- `WorkItem.projectId` : default → RESTRICT
- ⚠️ **`ProjectDocument` listé au plan T1 n'existe pas dans `prisma/schema.prisma`** — référence erronée du plan, à retirer ou clarifier si le modèle doit être créé plus tard.
- Volontairement non touchés : `Milestone.ownerId` (SetNull), `MilestoneDependency.*` (Cascade/Restrict déjà cohérents), `WorkItem.importBatchId` (SetNull), `ProjectImportBatch.parentProjectId` (déjà RESTRICT).

**Port ESM — T3 réalisé (commit `48dc0af`)**
Le plan ne nommait que `recruitmentOnboarding.service.ts`, mais l'audit a découvert **4 fichiers `.ts`** dans `backend/` :
- `backend/services/security/password.service.ts`
- `backend/services/auth/firstLogin.service.ts`
- `backend/services/notifications/welcomeEmail.service.ts`
- `backend/services/hrm/recruitmentOnboarding.service.ts`

Tous portés en `.mjs` (aucun n'était importé par du runtime `.mjs` — dead code à l'exécution, mais nécessaires pour le flow HRM-2.1). `README_ONBOARDING_WORKFLOW.md` mis à jour avec les nouveaux chemins.

**Delta schéma HRM vs plan**

| Domaine | État réel constaté | Action plan |
|---|---|---|
| `Permission` | ✅ Existe (L214 — actuellement 3 champs `module`/`resource`/`action` dénormalisés, pas de clé atomique) | HRM-1.1 : ajouter `key` unique format `module.resource.action` |
| `Role` (L183) | ✅ Existe avec `code`, `name`, `isActive`, `isDeleted`, `deletedAt` | HRM-1.1 : ajouter `label`, `isSystem`, `description` |
| `UserRole` (L198) | ✅ Existe avec `validFrom`/`validTo` (pattern temporel — unicité `(userId, roleId, validFrom)`) — divergent du plan qui suppose unicité `(userId, roleId)` | HRM-1.1 : ajouter `assignedBy`, conserver le modèle temporel existant (ne PAS casser la migration) |
| `RolePermission` (L227) | ✅ Existe avec `roleId`, `permissionId`, `scopeType`, `scopeValue` | Aucune action — conforme |
| `UserPermissionSet` (L81) | ✅ Existe avec `(userId, module, resource, action, effect)` | HRM-1.1 (décision Hybride retenue 2026-05-23) : étendre avec `assignedBy`, `reason`, `expiresAt`, et `permissionId String?` optionnel — **PAS** de nouveau modèle `UserPermissionOverride` |
| `HrmEmploymentProfile` (L117) | ✅ Riche (29 champs, manager FK, compensation, statuses) | Aucune extension requise pour HRM-1 |
| `HrmCredentialProvisioning` (L161) | ✅ Présent (utilisé par recrutement → onboarding) | Aucune action |
| `AccessProvisioning` (L1519) | ✅ Présent (lien candidate ↔ user) | Aucune action |
| `RecruitmentCandidate` (L1495) | ✅ Minimal (fullName, email, statusCode, recruitmentDepartmentId) | HRM-2.1 : étendre avec `jobPostingId`, `stage`, `interviewDate`, `offerDate`, `offerAmount`, `rejectionReason` |
| `TimesheetEntry` (L1453) | ✅ Existe — un jour à la fois (`workDate`, `hours`), pas de notion semaine/approbation | HRM-2.5 : ajouter `approvedByUserId`, `approvedAt`, `weekStartDate`, `submittedAt` |
| Modèles Leave | ❌ Aucun | HRM-1.5 : créer `LeavePolicy`, `LeaveBalance`, `LeaveRequest` |
| Modèles Training | ❌ Aucun | HRM-2.3 : créer `TrainingCourse`, `TrainingEnrollment` |
| Modèles Onboarding/Offboarding | ❌ Aucun (seul `OnboardingChecklist` existait via le service `.ts` porté, mais pas en DB) | HRM-2.2 : créer 8 modèles miroir |
| Modèles Policies/Cases | ❌ Aucun | HRM-2.4 : créer `HrmPolicy`, `PolicyAcknowledgement`, `HrmCase` |

**Décision architecture RBAC (mémoire `project-hrm-rbac-decision`)**
- Approche **Hybride** retenue 2026-05-23 : étendre `UserPermissionSet` (`+ assignedBy`, `+ reason`, `+ expiresAt`, `+ permissionId?`) au lieu de créer le `UserPermissionOverride` listé au plan. Évite le doublon avec un modèle déjà utilisé et prépare la migration douce vers la clé `Permission.key` atomique.
- Le `rbac.service.mjs` (HRM-1.2) résoudra les overrides en lisant `UserPermissionSet` : match par `permissionId` si présent, sinon fallback sur le triplet `(module, resource, action)`.

**RBAC frontend — `src/lib/rbac.ts` (préparation HRM-1.2)**
7 strings de rôle hardcodées à éradiquer : `'hr'`, `'manager'`, `'staff'` (type `HRMRole`) et `'ADMIN'`, `'MANAGER'`, `'CONTRIBUTOR'`, `'OBSERVER'` (type `AuthorityLevel`). De plus, `MODULE_OWNER_DEPARTMENTS` couple en dur des IDs `'dept-hr'`/`'dept-eng'`/etc. — à remplacer par une résolution DB en HRM-1.2.

**Confirmations structurelles**
- ✅ `backend/routes/` existe en tant que dossier séparé d'`auth-server.mjs` — les futures routes HRM iront bien dans `backend/routes/hrm/`.
- ✅ `backend/services/hrm/` contient maintenant 3 fichiers `.mjs` (`hrmDirectory` 1252L, `payrollEngine` 895L, `recruitmentOnboarding` ~140L).

---

### HRM-1.1 — Modèles DB RBAC + Seed ✅

**Objectif :** Matérialiser le catalogue de permissions en base.
**Statut :** ✅ Fermé 2026-05-23 — commit `6aee1e8`.

#### Nouveaux modèles Prisma

```prisma
model Permission {
  id          String   @id @default(cuid())
  key         String   @unique  // "pm.workItems.execute"
  module      String            // "pm"
  resource    String            // "workItems"
  action      String            // "execute"
  description String?
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]
  userOverrides   UserPermissionOverride[]
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique  // "project_manager"
  label       String            // "Chef de projet" (affiché UI)
  description String?
  isSystem    Boolean  @default(false)  // true = non supprimable
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  rolePermissions RolePermission[]
  userRoles       UserRole[]
}

model RolePermission {
  id           String     @id @default(cuid())
  roleId       String
  permissionId String
  createdAt    DateTime   @default(now())

  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@unique([roleId, permissionId])
}

model UserRole {
  id         String   @id @default(cuid())
  userId     String
  roleId     String
  assignedAt DateTime @default(now())
  assignedBy String

  user       User     @relation(fields: [userId], references: [id])
  role       Role     @relation(fields: [roleId], references: [id])

  @@unique([userId, roleId])
}

model UserPermissionOverride {
  id           String   @id @default(cuid())
  userId       String
  permissionId String
  granted      Boolean  // true = ajout, false = retrait explicite
  reason       String?
  assignedAt   DateTime @default(now())
  assignedBy   String
  expiresAt    DateTime?

  user         User       @relation(fields: [userId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@unique([userId, permissionId])
}
```

#### Seed Prisma

```
Fichier : prisma/seed/rbac.seed.mjs
Contenu :
  1. Insérer toutes les Permission du catalogue (section 3)
  2. Insérer les Role prédéfinis
  3. Insérer les RolePermission selon la matrice des rôles prédéfinis
  4. Assigner super_admin au premier User (userId depuis env)

Commit : feat(db): RBAC models + seed catalogue — ref HRM-1.1
```

**Critères de sortie HRM-1.1**
- [x] Migration propre, pas de breaking change sur schéma existant — `20260523_rbac_models_extension` appliquée 2026-05-23
- [x] Seed s'exécute sans erreur — `node prisma/seed/rbac.seed.mjs` ✅ (97 permissions, 10 rôles, super_admin assigné à `ebutsana@neox.io`)
- [x] Toutes les permissions du catalogue présentes en DB — 97/97 vérifié
- [x] Rôles prédéfinis avec leurs permissions assignées — 10/10 (`super_admin` 97, `hr_admin` 44, `hr_officer` 31, `employee_self_service` 7, `project_manager` 23, `project_member` 8, `finance_admin` 16, `finance_officer` 8, `scm_manager` 11, `readonly` 35)

**Notes HRM-1.1 (ajoutées 2026-05-23)**
- Décision **Hybride** appliquée : `UserPermissionSet` étendu (`+ permissionId?`, `+ assignedBy`, `+ reason`, `+ expiresAt`), aucun nouveau modèle `UserPermissionOverride` créé. Le brouillon du plan §HRM-1.1 listait `UserPermissionOverride` comme nouveau modèle — décision postérieure du DRAFT_1 retenue.
- `UserRole` **pattern temporel préservé** : `@@unique([userId, roleId, validFrom])` inchangé. Le seed utilise `findFirst({validTo: null})` puis `create` au lieu d'un `upsert` sur clé composite (instable entre relances). `assignedBy` ajouté nullable.
- `Permission.key` ajoutée + backfillée depuis `module.resource.action` pour les 11 lignes legacy déjà en DB. Aucun conflit de clé.
- Données legacy préservées : 10 anciennes permissions (`finance.entries.*` et variantes) et 7 anciens rôles non touchés — coexistent sans interférer avec le nouveau catalogue (clés différentes). Cleanup éventuel à traiter séparément si nécessaire.
- Bug Windows corrigé en cours de route : le détecteur `isDirectRun` du seed utilise désormais `pathToFileURL` pour gérer correctement les chemins avec espaces (`file:///D:/Mon%20mari/...`).

---

### HRM-1.2 — Migration `rbac.ts` → DB-driven (D6) ✅

**Objectif :** Remplacer le hardcode par une résolution DB. Ferme D6.
**Statut :** ✅ Fermé 2026-05-23 — commits `6d21c05` (backend service + middleware + endpoint), `ff4cdc2` (frontend resolution), `39d7a6b` (doc status partiel), `3642140` (assertPermission helper raw http), `4de49e6` (branchement 11 routes HRM, D6 backend fermée). Shim frontend `can()` reste deprecated pour 10 pages — migration page-par-page dans HRM-1.3 post (non bloquant).

#### Backend — service de résolution

```
Fichier : backend/services/auth/rbac.service.mjs
Exports :
  getUserPermissions(userId)   → Set<string>
  hasPermission(userId, key)   → boolean
  requirePermission(key)       → middleware Express

Logique de résolution :
  1. Charger les UserRole de l'utilisateur
  2. Charger les RolePermission de ces rôles
  3. Charger les UserPermissionOverride
  4. Merger : permissions rôles + overrides granted - overrides denied
  5. Retourner le Set final

Cache : Redis si disponible, sinon Map en mémoire avec TTL 5 min
```

#### Backend — middleware

```javascript
// Exemple d'usage dans une route
router.delete('/projects/:id',
  requirePermission('pm.projects.delete'),
  async (req, res) => { ... }
)
```

#### Backend — route bootstrap

```
GET /api/auth/me/permissions
→ Retourne { permissions: string[] } pour l'utilisateur courant
→ Utilisé au login pour hydrater le store frontend
```

#### Frontend — remplacement `rbac.ts`

```
Fichier : src/lib/rbac.ts (réécriture)
Avant : if (role === 'admin') return true  // hardcodé
Après :
  - usePermissions() hook → lit le store Zustand
  - hasPermission(key: PermissionKey) → boolean
  - PermissionKey : union type généré depuis le catalogue

Fichier : src/store/useAuthStore.ts
Ajout : permissions: Set<string> hydraté depuis GET /me/permissions
```

#### Frontend — composant guard

```tsx
// src/components/auth/PermissionGuard.tsx
<PermissionGuard permission="pm.projects.write" fallback={<ReadOnlyBanner />}>
  <EditProjectForm />
</PermissionGuard>
```

```
Commit : feat(rbac): DB-driven permission resolution — close D6
```

**Critères de sortie HRM-1.2**
- [~] `src/lib/rbac.ts` ne contient plus aucune string de rôle hardcodée — **runtime clean**, résolution 100% DB-driven via `GET /api/auth/me/permissions`. Shim `can()` legacy conservé pour 10 consumers UI (HRMRouter + 9 pages HRM), à migrer page-par-page en HRM-1.3 post.
- [~] Tous les modules existants utilisent `requirePermission()` sur leurs routes critiques — **HRM oui** (11 routes wirées via `assertPermission(ctx, key)` raw-http : departments POST/PATCH/DELETE, employees POST/bulk/PATCH/DELETE, 4 credentials POST). **PM/Finance volontairement non touchés** — branchement reporté tant que la role-management UI n'est pas devant chaque user en prod (risque de blocage rollback).
- [x] `PermissionGuard` fonctionne en dark et light mode — composant livré.
- [x] Permission denied → 403 `{ error, code: 'PERMISSION_DENIED', required }` — vérifié e2e (tests A-E 2026-05-23 : super_admin passe, anonymous + unknown user → 403 avec la `required` key correcte).

#### Notes HRM-1.2 (ajoutées 2026-05-23)

**Architecture middleware — option Hybride retenue**

L'`auth-server.mjs` actuel est un serveur Node http raw (pas Express). Le `requirePermission(key)` Express livré est correct mais ne tourne pas dans le pipeline existant. Pour brancher les routes PM/Finance sans refacto Express, un helper raw http sera ajouté **avant la dernière étape** :

```js
// backend/services/auth/rbac.service.mjs — à ajouter
export async function assertPermission(ctx, key) {
  const userId = ctx.url.searchParams.get('userId')
    ?? ctx.body?.actorUserId ?? ctx.body?.userId ?? null;
  if (!userId || !(await hasPermission(userId, key))) {
    const err = new Error('Permission denied');
    err.statusCode = 403; err.code = 'PERMISSION_DENIED'; err.required = key;
    throw err;
  }
}
```

Les routes existantes catch déjà `err.statusCode`/`err.code` (voir bloc try/catch de `backend/routes/pm/projects.routes.mjs`) — l'erreur structurée sera renvoyée avec le bon shape automatiquement. Pas de migration Express, pas de refacto `auth-server.mjs`.

**Store frontend — adapté à l'existant**

Le plan disait "store Zustand" pour les permissions, mais le projet utilise React Context (`src/contexts/AuthContext.tsx`) — pas de `useAuthStore.ts`. Extension faite dans le Context existant pour éviter un état parallèle :
- `permissions: string[]` ajouté (pas Set — JSON-sérialisable, conversion en Set à l'usage dans `usePermissions`).
- Hydratation : login, `refreshUserProfile`, et au mount si session restaurée depuis localStorage.
- Persistance `localStorage.neox-auth-permissions` pour paint instantané au reload (refresh en arrière-plan).
- **Jamais de crash sur erreur de fetch** : warning console + `permissions: []`. `<PermissionGuard>` gère le deny au cas par cas (contrat HRM-1.2).

**Commits HRM-1.2** : `6d21c05` (backend 1-3), `ff4cdc2` (frontend 4-6).

---

### HRM-1.3 — UI RBAC — HRM > Configuration > Rôles ✅

**Objectif :** L'HR admin peut créer/modifier des rôles et assigner des permissions.
**Statut :** ✅ Fermé 2026-05-23 — commits `1b62305` (backend) + `ab5330a` (frontend).

#### Pages et composants

```
src/pages/hrm/configuration/
  RolesPage.tsx              # Liste des rôles
  RoleEditorPage.tsx         # Matrice permissions pour 1 rôle
  UserPermissionsPage.tsx    # Profil d'un employé — rôles + overrides

src/components/hrm/rbac/
  PermissionMatrix.tsx       # Tableau groupé par module (Read/Write/Delete/Execute)
  RoleCard.tsx               # Carte rôle dans la liste
  OverrideModal.tsx          # Ajouter/retirer une permission individuelle
  RoleAssignModal.tsx        # Assigner un rôle à un employé
```

#### Comportement UI — PermissionMatrix

```
Colonnes : Read | Write | Delete | Execute
Lignes groupées par module :
  ▶ HRM
    Directory          [ ✅ ]  [ ✅ ]  [ ⬜ ]  [ — ]
    Leave              [ ✅ ]  [ ✅ ]  [ — ]   [ ✅ ]
    ...
  ▶ PM
    Projects           [ ✅ ]  [ ⬜ ]  [ ⬜ ]  [ ⬜ ]
    ...

— = permission n'existe pas pour cette action (colonne grisée)
Rôles système (isSystem=true) : lecture seule, pas de modification
```

#### Routes backend nécessaires

```
GET  /api/hrm/roles
POST /api/hrm/roles
GET  /api/hrm/roles/:id
PUT  /api/hrm/roles/:id
DELETE /api/hrm/roles/:id              # Soft-delete (non système)
GET  /api/hrm/roles/:id/permissions
POST /api/hrm/roles/:id/permissions
DELETE /api/hrm/roles/:id/permissions/:permId

GET  /api/hrm/permissions              # Catalogue complet groupé par module
GET  /api/hrm/users/:id/permissions    # Permissions effectives (résolues)
POST /api/hrm/users/:id/roles
DELETE /api/hrm/users/:id/roles/:roleId
POST /api/hrm/users/:id/overrides
DELETE /api/hrm/users/:id/overrides/:permId
```

```
Commit : feat(hrm): RBAC admin UI — roles matrix + user overrides
```

**Critères de sortie HRM-1.3**
- [x] Créer un rôle custom avec sélection granulaire de permissions — `POST /api/v1/hrm/roles` + `RoleEditorPage` mode "create"
- [x] Modifier les permissions d'un rôle existant non-système — `PUT /api/v1/hrm/roles/:id` + `PermissionMatrix` (read/write/delete/execute + non-standard `admin`)
- [x] Assigner un rôle à un employé depuis son profil — `UserPermissionsPage` + `RoleAssignModal` (tab "User Permissions" sous HRM > Configuration)
- [x] Ajouter une override individuelle avec raison et date d'expiration — `OverrideModal` allow/deny + reason + expiresAt + assignedBy hydraté depuis `AuthContext`
- [x] Rôles système non modifiables (badge + inputs disabled) — badge "system", inputs disabled, bouton delete disabled avec tooltip, service refuse `update`/`delete` côté backend (403 FORBIDDEN)
- [x] Changements répercutés immédiatement (invalidation cache RBAC) — `invalidateCache(userId)` après chaque mutation user-scoped, `invalidateCache()` global après mutations sur Role/RolePermission

#### Notes HRM-1.3 (ajoutées 2026-05-23)

**Intégration UI** : 2 tabs ajoutés à `HRMConfiguration.tsx` ("Roles" + "User Permissions"). Le plan suggérait `src/pages/hrm/configuration/...` mais le codebase n'a pas de dossier `src/pages/` — tout est sous `src/components/hrm/<feature>/`. Les fichiers RBAC sont donc dans `src/components/hrm/rbac/` (pattern existant).

**Convention API** : `apiClient` étendu d'un `'PUT'` dans son union `HttpMethod` (1 ligne) — le plan spec demandait `PUT /api/v1/hrm/roles/:id` et le client ne supportait que `GET/POST/PATCH/DELETE`.

**Réutilisation HRMStore** : `UserPermissionsPage` utilise `useHRMStore().employees` comme source pour le picker — pas de nouvel endpoint de recherche utilisateur ajouté.

**Limitations à noter** :
- Pas de pagination sur `GET /api/v1/hrm/roles` (17 rôles aujourd'hui, OK ; à reconsidérer > 100).
- `RoleAssignModal` recharge la liste complète à chaque ouverture — pas grave à cette échelle.
- Les overrides legacy (avec `permission` à null car pré-HRM-1.1) sont affichés mais le bouton "Remove" est désactivé (pas de `permissionId` pour les cibler) — UX : badge "legacy".

**Commits HRM-1.3** : `1b62305` (backend), `ab5330a` (frontend).

---

### HRM-1.4 — Endpoint assignables + D15 ✅

**Objectif :** Fournir aux pickers PM/SCM une source de vérité HRM. Ferme D15.

#### Backend

```
GET /api/hrm/employees?assignable=true&projectId=:id
→ Retourne les employés actifs + contractors pouvant être assignés
→ Filtre optionnel par département, compétence

POST /api/hrm/employees/contractor (upsert)
Body : { firstName, lastName, email, source: 'telecom_import', externalRef }
→ Crée un contractor s'il n'existe pas (par email)
→ Retourne { id, created: boolean }
```

#### Backend — hook dans `importWorkItems`

```
Fichier : backend/services/pm/pmImport.service.mjs
Modification : avant de lier un assigné à un work item,
  appeler POST /hrm/employees/contractor (upsert)
  utiliser l'id retourné comme userId dans WorkItemAssignee
```

#### Frontend — mise à jour des pickers

```
Fichier : src/components/pm/WorkItemAssigneeSelect.tsx (existant)
Avant : liste libre ou hardcodée
Après : GET /api/hrm/employees?assignable=true
        → options du select hydratées depuis HRM
```

```
Commit : feat(hrm): assignable employees endpoint + telecom contractor upsert — close D15
```

**Critères de sortie HRM-1.4**
- [x] Import télécom bulk crée automatiquement les contractors manquants — pre-pass dans `bulkImportTelecomWorkItems` ; vérifié e2e (2 rows même team → 1 contractor matérialisé en transaction)
- [x] Pickers PM ne proposent que des personnes issues du HRM — `WorkItemAssigneeSelect` typeahead, source `GET /api/v1/hrm/employees?assignable=true` (employmentType employee + contractor)
- [x] Upsert idempotent (même email = pas de doublon) — `upsertContractor` retourne le même `id` sur email existant (vérifié `created:true` puis `created:false`)
- [x] Contractor créé visible dans HRM > Directory avec badge "Contractor" — `employmentType='contractor'` filtré, visible dans le picker avec badge violet `contractor` ; visible aussi dans `HRM > Directory` via les requêtes existantes

#### Notes HRM-1.4 (ajoutées 2026-05-23)

**Synthèse d'identité contractor depuis le `team`** : le bulk import télécom n'a aujourd'hui pas de champ email/nom dédié au contractor — la seule info disponible est `imported_fields.team` (string libre). Pour fermer D15 sans changer le format des fichiers d'import, l'identité contractor est **synthétisée** :

| Champ | Valeur dérivée |
|---|---|
| `email` | `<slug-of-team>@contractor.local` (idempotent : même team → même email) |
| `firstName` | premier token du team |
| `lastName` | tokens suivants |
| `source` | `'telecom_import'` |
| `externalRef` | `'team:<raw-team>'` (traçabilité) |
| `creationSource` (profile) | `'TELECOM_IMPORT'` |

Quand des champs explicites (`contractor_email`, `contractor_first_name`, `contractor_last_name`) seront ajoutés au format d'import, switcher du synthétique vers le réel sera une simple modification de `contractorIdentityFromTeam`.

**`WorkItem.assignee` reste un string** : pas de FK ajoutée. Le picker stocke le `name` de l'employé (back-compat avec les filtres substring existants — `projectCollaboration.service.mjs:611`). Free text préservé si l'utilisateur tape un nom non présent dans la liste (suggestion "Keeping &quot;X&quot; as free-text assignee").

**`WorkItemAssigneeSelect` n'existait pas** : le plan le présentait comme "existant", mais le code utilisait un `<input type='text'>` libre dans `WorkItemDrawer.tsx:531`. Composant créé from scratch.

**Cache picker 30s** : `assignablesApi.ts` mémoïse 30 secondes par `(projectId, employmentType)` pour éviter de refetcher à chaque touche du typeahead.

**Commits HRM-1.4** : `574517b` (endpoint + frontend picker), `cee6626` (upsert + import wiring, **D15 fermée**).

---

### HRM-1.5 — Leave Management complet ✅

**Objectif :** Module congés end-to-end — le sous-module RH le plus demandé.

#### Nouveaux modèles Prisma

```prisma
model LeavePolicy {
  id               String   @id @default(cuid())
  name             String
  leaveType        String   // "annual"|"sick"|"unpaid"|"maternity"|"paternity"|"other"
  daysPerYear      Float
  carryOverMax     Float    @default(0)
  requiresApproval Boolean  @default(true)
  noticeDays       Int      @default(0)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  leaveBalances    LeaveBalance[]
  leaveRequests    LeaveRequest[]
}

model LeaveBalance {
  id         String   @id @default(cuid())
  userId     String
  policyId   String
  year       Int
  allocated  Float
  used       Float    @default(0)
  pending    Float    @default(0)
  carryOver  Float    @default(0)
  updatedAt  DateTime @updatedAt

  user       User        @relation(fields: [userId], references: [id])
  policy     LeavePolicy @relation(fields: [policyId], references: [id])

  @@unique([userId, policyId, year])
}

model LeaveRequest {
  id          String   @id @default(cuid())
  userId      String
  policyId    String
  startDate   DateTime
  endDate     DateTime
  days        Float
  reason      String?
  status      String   @default("pending")
                       // "pending"|"approved"|"rejected"|"cancelled"
  reviewedBy  String?
  reviewedAt  DateTime?
  reviewNote  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  user        User        @relation(fields: [userId], references: [id])
  policy      LeavePolicy @relation(fields: [policyId], references: [id])
  reviewer    User?       @relation("LeaveReviewer", fields: [reviewedBy], references: [id])
}
```

#### Routes backend

```
GET  /api/hrm/leave/policies
POST /api/hrm/leave/policies                # (hrm.leave.admin)
PUT  /api/hrm/leave/policies/:id
DELETE /api/hrm/leave/policies/:id

GET  /api/hrm/leave/balances               # Mes soldes ou tous (admin)
GET  /api/hrm/leave/balances/:userId
POST /api/hrm/leave/balances/initialize    # Init soldes pour une année

GET  /api/hrm/leave/requests
POST /api/hrm/leave/requests               # (hrm.leave.write)
GET  /api/hrm/leave/requests/:id
PUT  /api/hrm/leave/requests/:id/approve   # (hrm.leave.execute)
PUT  /api/hrm/leave/requests/:id/reject    # (hrm.leave.execute)
DELETE /api/hrm/leave/requests/:id         # Annuler (owner + status=pending)
```

#### Logique métier

```
Calcul des jours :
  - Exclure samedis et dimanches
  - Exclure les jours fériés (table PublicHoliday — dette DH2)
  - Arrondir au 0.5 le plus proche (demi-journées)

Workflow approbation :
  pending → approved  (hrm.leave.execute)
          → rejected  (hrm.leave.execute)
  approved → cancelled (owner, si startDate future)

Mise à jour solde (transaction Prisma) :
  Sur submit  : LeaveBalance.pending += days
  Sur approve : pending -= days, used += days
  Sur reject  : pending -= days
  Sur cancel  : pending -= days (si pending) ou used -= days (si approved)
```

#### Frontend — branchement `LeavePage.tsx`

```
Composants à créer :
  LeaveRequestModal.tsx      # Formulaire de demande
  LeaveCalendar.tsx          # Vue calendrier équipe
  LeaveBalanceCard.tsx       # Solde par type
  LeavePolicyManager.tsx     # Admin — CRUD politiques
  PendingApprovalsPanel.tsx  # Admin — file d'approbation
```

```
Commit : feat(hrm): leave management end-to-end — close HRM-1.5
```

**Critères de sortie HRM-1.5**
- [x] Employé peut soumettre une demande de congé — `POST /api/v1/hrm/leave/requests` + `LeaveRequestModal` (preview live des jours travaillés, picker policy auto-chargé)
- [x] Manager voit les demandes en attente, approuve/rejette — `PendingApprovalsPanel` (tab "Approvals" visible si `hrm.leave.execute`) + `PUT /api/v1/hrm/leave/requests/:id/approve|reject`
- [x] Soldes mis à jour en temps réel après action — toutes les transitions (submit/approve/reject/cancel) tournent dans `prisma.$transaction()` ; UI rafraîchit via `reloadMine()` post-action
- [x] Calcul correct des jours (weekends exclus) — `calculateLeaveDays()` testé (Mon-Wed=3, Sat-Sun=0, Fri-Mon=2, single weekday=1)
- [x] Vue calendrier affiche les congés approuvés de l'équipe — `LeaveCalendar` (vue mensuelle Monday-first, approved + pending, badge nombre/jour, navigation prev/today/next)
- [x] Admin peut créer/modifier des politiques de congé — `LeavePolicyManager` (tab "Policies" visible si `hrm.leave.admin`) + CRUD `/api/v1/hrm/leave/policies`
- [x] États vides, chargement, et erreurs gérés sur chaque vue — skeleton loaders, empty CTAs, retry banner sur chaque composant (LeavePage, PendingApprovals, PolicyManager, Calendar)
- [x] Tests passent — `node backend/tests/hrm/hrm-leave.test.mjs` (alias `npm run test:hrm-leave`) — unit `calculateLeaveDays` + 4 cas intégration : INSUFFICIENT_BALANCE 422, approve transitionne pending→used en tx, cancel restitue solde, overlap → 409 CONFLICT + rejected libère la période

#### Notes HRM-1.5 (ajoutées 2026-05-23)

**Architecture** :
- 3 modèles Prisma (`LeavePolicy`, `LeaveBalance`, `LeaveRequest`) + 3 relations inverses sur `User`.
- Migration `20260523_leave_management` défensive (CREATE TABLE IF NOT EXISTS + DO $$ FK guards), appliquée via `prisma migrate deploy` (DH6 toujours bloquante pour `migrate dev`).
- Toutes les routes gatées par `assertPermission()` dès le premier commit — 13 routes au total, mapping permissions :
  - GET : `hrm.leave.read`
  - POST request : `hrm.leave.write`
  - POST/PUT/DELETE policies + POST balances/initialize : `hrm.leave.admin`
  - PUT approve/reject : `hrm.leave.execute`
  - DELETE request (cancel) : owner OR `hrm.leave.execute`

**DH2 (PublicHoliday absent)** :
- Marqueur clair dans `calculateLeaveDays` (1 ligne à décommenter une fois la table créée) et mention dans le helper text de `LeaveRequestModal`. Aucun blocage actuel.

**Pages migrées vers `usePermissions()`** :
- `LeavePage.tsx` a été refactorisée — passage de `can()` legacy à `usePermissions().has()`. **1/10 consumers migrés** (suite : 9 autres pages HRM à traiter en HRM-1.3 post, 1 commit par page).

**Lazy balance creation** :
- `findOrCreateBalance()` crée le solde à la première demande si absent (allocated = `policy.daysPerYear`). `initializeBalances({ year, userId?, policyId? })` reste disponible pour le pré-seeding HR explicit.

**Validation overlap** :
- Bonus testé : une demande `rejected` ne bloque PAS une nouvelle demande sur les mêmes dates (logique : `statusCode IN ('pending', 'approved')`).

**Commits HRM-1.5** : `7836e20` (schema+migration), `1a71811` (backend service+routes), `1df0955` (frontend 5 composants), `<ce commit>` (tests + plan).

---

### Critères de sortie Sprint HRM-1

- [x] D5 fermée — FK RESTRICT en place (commit `0d66980`)
- [x] D6 fermée — `rbac.ts` runtime sans hardcode, résolution DB ; backend HRM 11 routes branchées via `assertPermission` (commits `6d21c05`, `ff4cdc2`, `3642140`, `4de49e6`). Shim `can()` legacy reste pour 9 pages UI à migrer post-sprint.
- [x] D15 fermée — assignés télécom → contractors HRM (commits `574517b`, `cee6626`)
- [x] RBAC UI fonctionnel — rôles, permissions, overrides (commits `1b62305`, `ab5330a`)
- [x] Leave management end-to-end fonctionnel (commits `7836e20`, `1a71811`, `1df0955`, + tests)
- [x] Aucun `any` TypeScript non commenté introduit — `tsc --noEmit` exit 0 à chaque commit frontend
- [x] Toutes les nouvelles routes HRM protégées par `assertPermission()` — toutes les routes HRM-1.3 (RBAC admin), HRM-1.4 (assignables + contractor upsert ouvert), HRM-1.5 (leave) gatées dès le premier commit. PM/Finance routes existantes restent sur `canManageHrmAdministration`/`assertModuleAccess` jusqu'à un sprint dédié.

---

## 5. Sprint HRM-2

**Objectif :** Compléter tous les sous-modules restants + tests
**Durée estimée :** 2–3 semaines
**Statut :** 🟡 En cours — HRM-2.1 + HRM-2.2 + HRM-2.3 + HRM-2.4 fermés 2026-05-23. HRM-2.5 → HRM-2.7 à venir.

---

### HRM-2.1 — Recruitment complet ✅

**Objectif :** Pipeline candidats fonctionnel end-to-end.

#### Modèles Prisma manquants

```prisma
model JobPosting {
  id           String   @id @default(cuid())
  title        String
  departmentId String
  description  String
  requirements String?
  status       String   @default("draft")  // "draft"|"open"|"closed"|"filled"
  closingDate  DateTime?
  createdBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  department   Department             @relation(fields: [departmentId], references: [id])
  candidates   RecruitmentCandidate[]
}

// Extension RecruitmentCandidate existant :
// Ajouter : jobPostingId, stage, interviewDate, offerDate, offerAmount, rejectionReason
```

#### Routes backend

```
GET  /api/hrm/recruitment/postings
POST /api/hrm/recruitment/postings
GET  /api/hrm/recruitment/postings/:id
PUT  /api/hrm/recruitment/postings/:id
DELETE /api/hrm/recruitment/postings/:id

GET  /api/hrm/recruitment/candidates
POST /api/hrm/recruitment/candidates
GET  /api/hrm/recruitment/candidates/:id
PUT  /api/hrm/recruitment/candidates/:id/stage
PUT  /api/hrm/recruitment/candidates/:id/hire    # → déclenche onboarding
PUT  /api/hrm/recruitment/candidates/:id/reject
```

#### Flow "Marquer embauché" (transaction Prisma)

```
1. Créer User (si pas existant)
2. Créer HrmEmploymentProfile
3. Créer OnboardingChecklist depuis template département
4. Assigner rôle "employee_self_service"
5. Émettre SSE event "hrm.employee.hired"
→ Rollback complet si une étape échoue
```

```
Commit : feat(hrm): recruitment pipeline + hire flow — ref HRM-2.1
```

**Critères de sortie HRM-2.1**
- [x] Créer une offre, ajouter des candidats, avancer les stages — `JobPostingList` (création inline) + `RecruitmentPage` kanban drag-drop, transitions `sourced→screening→interview→offer` testées avec auto-stamping de `interviewDate`/`offerDate`
- [x] "Marquer embauché" crée l'employé et déclenche l'onboarding — `PUT /api/v1/hrm/recruitment/candidates/:id/hire` délègue à `transitionCandidateToOnboarding` (HRM-1.0) qui crée User + HrmEmploymentProfile + UserRole + AccessProvisioning + audit + DomainEvent en transaction. `statusCode` candidat passe à `onboarding`.
- [x] Vue kanban ou liste par stage fonctionnelle — kanban 6 colonnes drag-drop conservé, statut `onboarding` server replié dans la colonne `hired` côté UI
- [x] Transaction rollback testé — `node backend/tests/hrm/hrm-recruitment.test.mjs` (alias `npm run test:hrm-recruitment`) couvre : pipeline transitions, refus stage→hired/rejected, hire matérialise les 4 entités liées, idempotence (409 + hiredUserId), **rollback** (hire avec email déjà pris → user.create P2002 → candidate reste `offer`, aucun AccessProvisioning leaké), reject avec rejectionReason, posting lifecycle (delete refusé si candidats actifs)

#### Notes HRM-2.1 (ajoutées 2026-05-23)

**Architecture** :
- 1 nouveau modèle (`JobPosting`) + extensions additives sur `RecruitmentCandidate` : `jobPostingId`, `interviewDate`, `offerDate`, `offerAmount`/`offerCurrency`, `rejectionReason`. Migration `20260523_recruitment_job_postings` défensive, deploy (DH6 toujours en place).
- 11 routes `/api/v1/hrm/recruitment/*` toutes gatées `assertPermission` dès le premier commit. Hire et reject ont leurs propres routes ; le PUT générique `/stage` refuse explicitement `hired`/`rejected` (409 avec message de redirection) — un seul chemin pour les transitions terminales.

**Delta plan** :
- Le plan listait un champ `stage` séparé sur `RecruitmentCandidate`, mais `statusCode` joue déjà ce rôle dans `recruitmentOnboarding.service.mjs`. Ajouter `stage` aurait créé une duplication. `statusCode` reste la source unique de vérité (sourced → screening → interview → offer → hired → onboarding → rejected).
- Le plan référait à `WorkItemAssigneeSelect.tsx (existant)` — n'existait pas, créé en HRM-1.4. Pour HRM-2.1, le composant `CandidateHiredModal` (498L) existant a été **conservé** : son `onConfirm` appelle maintenant la nouvelle API. Les champs riches du modal (departmentId/hiringManagerId/templateId/offerComp) ne sont **pas encore persistés** côté DB — ils seront branchés sur les templates en HRM-2.2 (Onboarding/Offboarding).

**Migration `can()` → `usePermissions()` — 2/10** :
- `LeavePage` (HRM-1.5) ✓
- `RecruitmentPage` (HRM-2.1) ✓
- Reste : 8 pages HRM (`HRMRouter`, `TrainingPage`, `WeekHeader`, `TimesheetsPage`, `PoliciesPage`, `OnboardingPage`, `CasesPage`, `OffboardingPage`) — au fur et à mesure des sous-tâches HRM-2.

**Commits HRM-2.1** : `89f6a35` (schema), `c58135e` (backend), `5fb54da` (frontend + can migration), `<ce commit>` (tests + plan).

---

### HRM-2.2 — Onboarding / Offboarding ✅

**Objectif :** Checklists structurées avec suivi de complétion.

#### Nouveaux modèles Prisma

```prisma
model OnboardingTemplate {
  id           String   @id @default(cuid())
  name         String
  departmentId String?  // null = global
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  deletedAt    DateTime?

  tasks        OnboardingTemplateTask[]
  checklists   OnboardingChecklist[]
}

model OnboardingTemplateTask {
  id             String @id @default(cuid())
  templateId     String
  title          String
  description    String?
  dueOffsetDays  Int    @default(0)   // jours après date d'embauche
  assignedRole   String?              // rôle responsable
  order          Int

  template       OnboardingTemplate @relation(fields: [templateId], references: [id])
}

model OnboardingChecklist {
  id          String   @id @default(cuid())
  userId      String
  templateId  String
  startDate   DateTime
  status      String   @default("in_progress")  // "in_progress"|"completed"
  completedAt DateTime?
  createdAt   DateTime @default(now())

  user        User               @relation(fields: [userId], references: [id])
  template    OnboardingTemplate @relation(fields: [templateId], references: [id])
  tasks       OnboardingChecklistTask[]
}

model OnboardingChecklistTask {
  id             String   @id @default(cuid())
  checklistId    String
  templateTaskId String
  status         String   @default("pending")  // "pending"|"done"|"skipped"
  completedBy    String?
  completedAt    DateTime?
  note           String?

  checklist      OnboardingChecklist    @relation(fields: [checklistId], references: [id])
  templateTask   OnboardingTemplateTask @relation(fields: [templateTaskId], references: [id])
}

// Offboarding : structure miroir avec préfixe Offboarding*
// Logique inverse : désactivation accès, retour équipements, etc.
```

#### Routes backend

```
GET  /api/hrm/onboarding/templates
POST /api/hrm/onboarding/templates
PUT  /api/hrm/onboarding/templates/:id

GET  /api/hrm/onboarding/checklists
GET  /api/hrm/onboarding/checklists/:id
PUT  /api/hrm/onboarding/checklists/:id/tasks/:taskId   # Compléter une tâche

# Même structure pour /offboarding/
```

```
Commit : feat(hrm): onboarding/offboarding checklists — ref HRM-2.2
```

**Critères de sortie HRM-2.2**
- [x] Templates de checklist créables par département — `TemplateManagerModal` (partagé Onboarding/Offboarding) + `POST /api/v1/hrm/{onboarding,offboarding}/templates` avec `departmentId` optionnel (null = global). Inline task editor (title/role/dueOffsetDays/isRequired).
- [x] Checklist auto-générée lors d'un recrutement (flow HRM-2.1) — hook **hors-tx** dans `transitionCandidateToOnboarding` : résout `input.onboardingTemplateId` > template département > template global > rien ; en cas d'échec, console.warn + employé créé quand même (vérifié par test).
- [x] Employé peut compléter ses tâches depuis self-service — `OnboardingPage` en mode self (`scope='self'` quand pas `hrm.onboarding.execute`) liste les checklists de l'actor, autorise `updateTask` sur sa propre checklist, refuse côté UI sur celle des autres (`canExecute && detail.userId !== actorUserId`).
- [x] RH voit le taux de complétion par employé — `GET /api/v1/hrm/onboarding/stats?forUserId=...` + roll-up automatique du `statusCode` checklist via `updateChecklistTask` (auto-flip → `completed` quand tous required `done` et autres `done|skipped`).

#### Notes HRM-2.2 (ajoutées 2026-05-23)

**Architecture du hook hire** (point d'attention du user respecté) :
- Le hook est ajouté **dans** `recruitmentOnboarding.service.mjs` (HRM-1.0), **pas** dans un nouveau service. La transaction historique (User + HrmEmploymentProfile + UserRole + AccessProvisioning + audit + DomainEvent) reste intacte. La création de checklist tourne **après** `await prisma.$transaction(...)` dans un try/catch séparé.
- Résolution `templateId` : `input.onboardingTemplateId` → `resolveTemplateForDepartment(candidate.recruitmentDepartmentId)` (dept-scoped puis global) → null.
- Échec ⇒ `console.warn` + `onboardingChecklistId: undefined` dans le résultat ; l'employé reste matérialisé. Confirmé par le test `checkRollbackNonBlocking` qui passe un `templateId` inexistant.

**Auto-complétion** :
- `updateChecklistTask` recalcule le rolled-up `statusCode` à chaque appel : `completed` quand toutes les tâches `isRequired` sont `done` ET toutes les autres sont `done|skipped`. Sinon `in_progress`. Le service `completeChecklist` reste disponible pour un toggle explicite mais devient optionnel — l'auto-flip suffit.

**Migration `can()` → `usePermissions()` — 4/10** :
- ✅ LeavePage, RecruitmentPage, OnboardingPage, OffboardingPage
- Reste : HRMRouter, WeekHeader, TimesheetsPage (PoliciesPage + CasesPage migrées en HRM-2.4, TrainingPage en HRM-2.3) — 6/10

**Delta plan** :
- Le plan listait `OnboardingChecklistTask.completedBy String?` ; ajouté avec relation `User?` sur `completedByUserId` + `@@relation("OnboardingTaskCompletedBy")`.
- `isRequired Boolean` ajouté sur `TemplateTask` (pas dans DRAFT_2 mais nécessaire pour la roll-up auto-complétion + UX `req` badge existante).

**Commits HRM-2.2** : `8011a8e` (schéma), `2ff776a` (backend + hook), `e707075` (frontend), `<ce commit>` (tests + plan).

---

### HRM-2.3 — Training + Certifications

**Objectif :** Gestion des formations et suivi des certifications.

#### Nouveaux modèles Prisma

```prisma
model TrainingCourse {
  id            String   @id @default(cuid())
  title         String
  description   String?
  provider      String?
  durationHours Float?
  isInternal    Boolean  @default(true)
  isMandatory   Boolean  @default(false)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?

  enrollments   TrainingEnrollment[]
}

model TrainingEnrollment {
  id          String   @id @default(cuid())
  userId      String
  courseId    String
  status      String   @default("enrolled")
              // "enrolled"|"in_progress"|"completed"|"cancelled"
  enrolledAt  DateTime @default(now())
  completedAt DateTime?
  score       Float?
  certificate String?  // URL ou référence document

  user        User           @relation(fields: [userId], references: [id])
  course      TrainingCourse @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId])
}
```

#### Routes backend

```
GET  /api/hrm/training/courses
POST /api/hrm/training/courses
PUT  /api/hrm/training/courses/:id
DELETE /api/hrm/training/courses/:id

GET  /api/hrm/training/enrollments          # Mes formations ou toutes (admin)
POST /api/hrm/training/enrollments          # Inscrire
PUT  /api/hrm/training/enrollments/:id/complete
PUT  /api/hrm/training/enrollments/:id/cancel
```

```
Commit : feat(hrm): training courses + enrollments — ref HRM-2.3
```

**Critères de sortie HRM-2.3**
- [x] Créer un cours, inscrire des employés — `createCourse` + `enrollUser` (`backend/services/hrm/training.service.mjs`), POST `/api/v1/hrm/training/courses` et `/api/v1/hrm/training/enrollments` gates `hrm.training.write` / `hrm.training.execute` (`backend/routes/hrm/training.routes.mjs`).
- [x] Employé voit ses formations en cours et terminées — tab Enrollments scopée `forUserId={user.id}` en self-service (sans `hrm.training.execute`), vue globale sinon (`src/components/hrm/training/TrainingPage.tsx`).
- [x] Badge "Certifié" sur le profil employé si complété — pill `Certifié` + section Certifications dans `src/components/hrm/EmployeeDrawer.tsx`, alimentée par `GET /api/v1/hrm/training/certifications/:userId` (résolution Person→User par email via `assignablesApi`).

**Décisions HRM-2.3**
- `@@unique([userId, courseId])` enforce au DB la règle "pas de double inscription". Le service lève 409 `ALREADY_ENROLLED` (avec `enrollmentId` + `currentStatus`) avant que la contrainte ne déclenche un P2002.
- Ré-inscription après annulation : on **revit la ligne existante en place** (statusCode `enrolled`, `cancelledAt = null`) plutôt qu'en créer une nouvelle, pour que `@@unique` tienne sans soft-delete artificiel.
- Permission split : `read` (catalogue + enrollments + certifications), `write` (CRUD cours), `execute` (enroll / complete / cancel) — déjà seedé en HRM-1.1.
- `score` est un `Decimal(5,2)` (pas Float comme le DRAFT) pour rester cohérent avec les autres champs monétaires/numériques du schéma.
- `cancelledAt` + `dueDate` ajoutés au modèle (hors DRAFT) : utiles pour l'UI (rappels) et pour distinguer annulation manuelle d'un soft-delete.
- `category` ajouté sur `TrainingCourse` (hors DRAFT) pour le filtrage UI (Compliance / Technical / Leadership / Other).
- `actorFromCtx` du route handler n'a **pas** de fallback `body.userId` car sur un POST enrollment `body.userId` est l'employé cible — l'appelant doit passer `actorUserId` (query string ou body).
- Migration `can()` → `usePermissions()` : 5/10 pages migrées (`TrainingPage` + les 4 précédentes). Reste : `HRMRouter`, `WeekHeader`, `TimesheetsPage`, `PoliciesPage`, `CasesPage`.
- `StatusChip` étendu avec `enrolled` (bleu) + `cancelled` (slate) pour la cohérence visuelle avec les autres statuts HRM.

**Tests HRM-2.3** (`backend/tests/hrm/hrm-training.test.mjs` — `npm run test:hrm-training`)
- ✓ Inscription → statusCode `enrolled`
- ✓ Double inscription même cours → 409 `ALREADY_ENROLLED` avec `currentStatus`
- ✓ Annulation puis ré-inscription → même ligne réactivée (pas de duplicate)
- ✓ Complétion → `completedAt` + `score` + `certificate` stockés, `getUserCertifications` les surface
- ✓ 403 sans permission `hrm.training.execute` (`assertPermission` testé avec `res` mocké)

**Commits HRM-2.3** : `1a88ccc` (schéma + migration), `fc29dfd` (backend service + routes), `a27b86f` (frontend + can() migration + badge), `<ce commit>` (tests + plan).

---

### HRM-2.4 — Policies + Cases

**Objectif :** Documents RH et gestion des incidents/griefs.

#### Nouveaux modèles Prisma

```prisma
model HrmPolicy {
  id           String   @id @default(cuid())
  title        String
  category     String   // "conduct"|"safety"|"leave"|"it"|"other"
  content      String   // Markdown ou URL document
  version      String   @default("1.0")
  status       String   @default("draft")  // "draft"|"published"|"archived"
  publishedAt  DateTime?
  createdBy    String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  acknowledgements PolicyAcknowledgement[]
}

model PolicyAcknowledgement {
  id        String   @id @default(cuid())
  policyId  String
  userId    String
  signedAt  DateTime @default(now())

  policy    HrmPolicy @relation(fields: [policyId], references: [id])
  user      User      @relation(fields: [userId], references: [id])

  @@unique([policyId, userId])
}

model HrmCase {
  id          String   @id @default(cuid())
  type        String   // "grievance"|"incident"|"disciplinary"|"inquiry"
  title       String
  description String
  reportedBy  String
  assignedTo  String?
  status      String   @default("open")
              // "open"|"investigating"|"resolved"|"escalated"|"closed"
  priority    String   @default("medium")
  resolvedAt  DateTime?
  resolution  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  reporter    User  @relation("CaseReporter", fields: [reportedBy], references: [id])
  assignee    User? @relation("CaseAssignee", fields: [assignedTo], references: [id])
}
```

#### Routes backend

```
GET  /api/hrm/policies
POST /api/hrm/policies                    # (hrm.policies.write)
GET  /api/hrm/policies/:id
PUT  /api/hrm/policies/:id
PUT  /api/hrm/policies/:id/publish        # (hrm.policies.execute)
PUT  /api/hrm/policies/:id/archive        # (hrm.policies.execute)
POST /api/hrm/policies/:id/acknowledge   # (hrm.policies.read — self)

GET  /api/hrm/cases
POST /api/hrm/cases                       # (hrm.cases.write)
GET  /api/hrm/cases/:id
PUT  /api/hrm/cases/:id
PUT  /api/hrm/cases/:id/escalate          # (hrm.cases.execute)
PUT  /api/hrm/cases/:id/close             # (hrm.cases.execute)
```

```
Commit : feat(hrm): policies + cases models + routes + UI — ref HRM-2.4
```

**Critères de sortie HRM-2.4**
- [x] Publier une politique, employés accusent réception — `createPolicy` + `publishPolicy` + `acknowledgePolicy` (`backend/services/hrm/policies.service.mjs`), POST/PUT `/api/v1/hrm/policies/*` gates `hrm.policies.write` + `hrm.policies.execute`, POST `/api/v1/hrm/policies/:id/acknowledge` gates `hrm.policies.read` (self-service).
- [x] Créer un cas, l'assigner, changer statut — `createCase` + `assignCase` + `changeStatus` (`backend/services/hrm/cases.service.mjs`), POST `/api/v1/hrm/cases`, PUT `/api/v1/hrm/cases/:id/{escalate,close,status,assign}`. Frontend UI : [CasesPage.tsx](src/components/hrm/cases/CasesPage.tsx) avec modal d'ouverture et boutons de transition contextuels.
- [x] Historique de statuts visible sur le détail d'un cas — table `HrmCaseEvent` append-only (status_change | note | assignment) écrite dans la même transaction que le changement de statut. Le drawer de `CasesPage` rend la timeline triée par `createdAt` avec auteur + `from → to` + note.

**Décisions HRM-2.4**
- `HrmCaseEvent` ajoutée **au-delà de DRAFT_2** pour couvrir le critère "Historique de statuts visible". Un JSON blob sur `HrmCase` aurait empêché les requêtes SQL "qui a fait quoi quand".
- État machine `HrmCase` : `closed` est terminal (refusé en sortie), `open` ↔ `investigating`, escalades autorisées depuis `open` / `investigating`, `resolved → closed` ou `resolved → investigating` (info nouvelle). Transitions illégales : 409 `ILLEGAL_TRANSITION` avec `{from, to}`.
- Authorisation des transitions : `hrm.cases.execute` global OU caller = assignee actuel. Le service vérifie les deux conditions ; la route `/:id/status` accepte `hrm.cases.write` au gate puis re-checke côté service (un assignee sans execute peut faire `open → investigating`). `/escalate` et `/close` exigent `hrm.cases.execute` dur côté route.
- Listing scopé côté route : sans `hrm.cases.execute`, le caller ne voit que les cas qu'il a reportés OU qui lui sont assignés. Le service expose juste `forUserId` ; la route applique la règle en se basant sur le `getUserPermissions` du caller.
- `PolicyAcknowledgement.@@unique([policyId, userId])` enforce au DB la règle "pas de double accusé de réception". 409 `ALREADY_ACKNOWLEDGED` retourne `acknowledgementId` + `signedAt` pour le toast UI.
- `listPolicies({ forUserId })` pré-joint l'acknowledgement de l'utilisateur dans la requête principale (badge `Lu / À signer` en une seule round trip — pas de N+1).
- Re-publier une politique archivée : refusé (409 `POLICY_ARCHIVED`). Cloner en nouvelle version à la place. Re-publier une politique déjà publiée : idempotent.
- Migration `can()` → `usePermissions()` : 6/10 pages (PoliciesPage + CasesPage en plus). Reste : HRMRouter, WeekHeader, TimesheetsPage, plus quelques drawers internes.
- `StatusChip` étendu avec `published` / `archived` / `escalated` / `closed` pour la cohérence visuelle.
- FK actions : Policy `createdByUserId` RESTRICT (authorship), Ack `policyId` CASCADE (ack inutile sans policy), Ack `userId` RESTRICT (audit), Case `reportedByUserId` RESTRICT, Case `assignedToUserId` SET NULL (un cas survit à un assignee qui part).

**Tests HRM-2.4** (`npm run test:hrm-policies` + `npm run test:hrm-cases`)

Policies (`backend/tests/hrm/hrm-policies.test.mjs`) :
- ✓ `publishPolicy` : draft → published avec `publishedAt` stamped
- ✓ Double accusé de réception → 409 `ALREADY_ACKNOWLEDGED` avec `acknowledgementId` existant
- ✓ `archivePolicy` : published → archived avec `archivedAt` stamped + refuse de re-publier (409 `POLICY_ARCHIVED`)
- ✓ 403 sans permission `hrm.policies.execute` (`assertPermission` testé avec `res` mocké)

Cases (`backend/tests/hrm/hrm-cases.test.mjs`) :
- ✓ `createCase` : statusCode `open` + écrit un event d'ouverture dans `HrmCaseEvent`
- ✓ `changeStatus(escalated)` : statusCode `escalated`, `escalatedAt` stamped, event ajouté
- ✓ `changeStatus(closed)` : statusCode `closed`, `closedAt` stamped, `resolution` récupérée depuis la note
- ✓ Closed est terminal → 409 `ILLEGAL_TRANSITION` avec `{from: 'closed', to: ...}`
- ✓ 403 sans permission `hrm.cases.execute`
- ✓ `listCases({forUserId})` scope correctement : reporter ne voit pas les cas d'un autre, assignee voit les siens

**Régression** : `test:hrm-leave` + `test:hrm-recruitment` + `test:hrm-onboarding` + `test:hrm-training` tous verts après HRM-2.4.

**Commits HRM-2.4** : `eb9b6b4` (schéma + migration), `0df0427` (backend services + routes), `2123c9c` (frontend + can() migration), `<ce commit>` (tests + plan).

---

### HRM-2.5 — Timesheets complétion

**Objectif :** Compléter les routes manquantes, lier au payroll.

#### Routes manquantes

```
GET  /api/hrm/timesheets
POST /api/hrm/timesheets
GET  /api/hrm/timesheets/:userId/week/:date
PUT  /api/hrm/timesheets/:id/submit          # (hrm.timesheets.write)
PUT  /api/hrm/timesheets/:id/approve         # (hrm.timesheets.execute)
PUT  /api/hrm/timesheets/:id/reject
```

#### Lien payroll

```
Vérifier dans payrollEngine.service.mjs que PayrollRunTimesheetLink
est effectivement utilisé pour lire les TimesheetEntry approuvées.
Si absent : ajouter la jointure dans le calcul des heures de la période.
```

```
Commit : feat(hrm): timesheets routes completion + payroll link — ref HRM-2.5
```

**Critères de sortie HRM-2.5**
- [ ] Saisie hebdomadaire via WeekEditor fonctionnelle
- [ ] Soumission → validation manager → transmission payroll
- [ ] Heures non approuvées exclues du calcul payroll

---

### HRM-2.6 — SSE Events HRM

**Objectif :** Brancher les événements HRM sur l'infrastructure SSE existante.

#### Événements à émettre

```
hrm.employee.hired           # Nouveau employé créé
hrm.employee.offboarded      # Offboarding complété
hrm.leave.requested          # Nouvelle demande congé
hrm.leave.approved           # Congé approuvé
hrm.leave.rejected           # Congé rejeté
hrm.onboarding.completed     # Checklist complète
hrm.role.assigned            # Rôle assigné à un utilisateur
hrm.case.escalated           # Cas escaladé
```

#### Abonnements frontend

```
Manager       : hrm.leave.requested (son équipe)
Employé       : hrm.leave.approved / hrm.leave.rejected (self)
HR admin      : hrm.case.escalated, hrm.employee.hired
Tout le monde : hrm.policies.published (politique nécessitant signature)
```

```
Commit : feat(hrm): SSE events integration — ref HRM-2.6
```

---

### HRM-2.7 — Tests HRM

**Objectif :** Couverture minimale des chemins critiques.

#### Fichiers de tests à créer

```
backend/tests/hrm/
  hrm-rbac.test.mjs           # Résolution permissions, overrides, cache
  hrm-leave.test.mjs          # Workflow complet, calcul solde, transactions
  hrm-recruitment.test.mjs    # Pipeline + flow "hire" + rollback
  hrm-onboarding.test.mjs     # Génération checklist + complétion tâches
  hrm-timesheets.test.mjs     # Soumission + validation + lien payroll
  hrm-contractors.test.mjs    # Upsert contractor, idempotence
```

#### Cas à couvrir impérativement

```
RBAC :
  - Utilisateur sans rôle → 403 sur toutes les routes protégées
  - Override "granted" s'additionne au rôle
  - Override "denied" retire la permission même si dans le rôle
  - Cache invalidé après changement de rôle

Leave :
  - Solde insuffisant → erreur métier 422 (pas 500)
  - Approbation met à jour pending → used en transaction
  - Annulation avant startDate restitue le solde
  - Double soumission → idempotence ou erreur claire

Recruitment → hire :
  - Transaction rollback si création User échoue
  - Idempotence : candidat déjà embauché → erreur métier

Timesheets :
  - Impossible de soumettre une semaine déjà approuvée
  - Heures non approuvées exclues du payroll
```

```
Commit : test(hrm): coverage sprint HRM-2 — ref HRM-2.7
```

**Critères de sortie HRM-2.7**
- [ ] Tests passent en CI sans flaky
- [ ] Couverture > 70% sur `hrmDirectory.service`, `rbac.service`, `leave`

---

### Critères de sortie Sprint HRM-2

- [ ] Tous les sous-modules HRM ont des modèles DB, routes, et UI branchés
- [ ] Recruitment → Onboarding flow fonctionne end-to-end
- [ ] SSE opérationnel pour les événements HRM critiques
- [ ] Tests HRM backend présents et passants
- [ ] Zéro route HRM sans `requirePermission()`
- [ ] `recruitmentOnboarding.service.ts` n'existe plus (remplacé par `.mjs`)

---

## 6. Dettes ouvertes

### Dettes PM fermées dans ce sprint

| ID | Description | Fermée en |
|---|---|---|
| D5 | FK RESTRICT sur `ProjectMember` | HRM-1.0 |
| D6 | `src/lib/rbac.ts` hardcodé | HRM-1.2 |
| D15 | Assignés télécom → contractor HRM | HRM-1.4 |

### Dettes PM restantes — non touchées ici

| ID | Description | Sprint cible |
|---|---|---|
| D2 | Stubs télécom → finance | Sprint Finance (priorité 3) |
| D7 | `importWorkItems` IDs locaux | Sprint Reporting (priorité 5) |
| D8 | `computeTelecomSummary` OR vs AND | Sprint Reporting (priorité 5) |
| D13 | Sous-tâches `parentId` | Sprint PM-2 dédié |

### Nouvelles dettes HRM ouvertes

| ID | Description | Sprint cible |
|---|---|---|
| DH1 | `useHRMStore.ts` (777L) trop lourd — à découper par sous-module | Sprint HRM refacto |
| DH2 | Table `PublicHoliday` absente — calcul congés approximatif (weekends seulement) | HRM-2 ou post |
| DH3 | Payroll UI — engine backend 95% mais frontend absent | Sprint Finance (priorité 3) |
| DH4 | Export RH — pas d'export CSV/Excel des employés, congés, timesheets | Sprint Reporting (priorité 5) |
| DH5 | Self-service mobile — flag `isSelfService` non testé sur écrans étroits | Sprint UX |
| DH6 | Baseline migration manquante — `Project`/`WorkItem`/`ProjectMember` créés via `prisma db push` sans migration initiale. `prisma migrate dev` échoue sur shadow DB (P3006/P1014). Fix : créer une migration baseline et la marquer appliquée avec `prisma migrate resolve --applied` sur les migrations existantes. Workaround actuel : utiliser `prisma migrate deploy` qui n'utilise pas la shadow DB. | Sprint infra dédié — non bloquant pour HRM |

---

## 7. Règles transversales

Ces règles s'appliquent à chaque tâche de ce plan sans exception.

### Architecture

- Toutes les nouvelles routes HRM dans `backend/routes/hrm/` — jamais dans `auth-server.mjs`
- Chaque route vérifie `requirePermission()` avant tout traitement
- Toute écriture multi-table dans une transaction Prisma
- Soft delete uniquement (`deletedAt`) — jamais `DELETE` SQL direct
- Statuts et types référencés depuis la DB ou le catalogue seedé — jamais enums frontend hardcodés

### TypeScript

- Strict mode — zéro `any` non commenté
- Props typées avec interface nommée pour chaque composant
- `PermissionKey` — union type maintenu en sync avec le catalogue de permissions

### Design system

- Glassmorphism + dark/light mode sur tous les nouveaux composants
- Animations Framer Motion cohérentes avec les transitions existantes
- Aucune nouvelle librairie UI sans approbation explicite

### États requis sur chaque vue de données

| État | Comportement attendu |
|---|---|
| ⏳ Loading | Skeleton adapté à la forme de la donnée |
| 📭 Empty | Message contextuel + call-to-action |
| ❌ Error | Message utilisateur + bouton retry |
| 🚫 Permission denied | Explication claire de ce qui manque (pas juste "403") |

### Format des commits

```
type(scope): description — ref TASK_ID
```
Types valides : `feat` · `fix` · `refactor` · `test` · `docs` · `chore`

Exemples :
```
feat(hrm): leave request workflow — ref HRM-1.5
fix(rbac): cache invalidation on role update — ref HRM-1.2
test(hrm): leave balance transaction rollback — ref HRM-2.7
```

---

*Plan généré le 2026-05-23*
*Format identique à `docs/NEOX_PM_PLAN.md`*
*Placer ce fichier dans `docs/NEOX_HRM_PLAN.md` sur la branche `claude/angry-sinoussi-faf92c`*
