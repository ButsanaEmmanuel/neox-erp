# Handoff — Sprint HRM Neox ERP

**Snapshot date** : 2026-05-23
**Worktree** : `D:\Mon mari\Google Antigravity\erp_polygons\.claude\worktrees\angry-sinoussi-faf92c`
**Branche** : `claude/angry-sinoussi-faf92c` (31 commits ahead of `origin/master`)
**DB dev** : PostgreSQL `localhost:5543/neox_erp`
**Compte test super_admin** : `ebutsana@neox.io` — id `usr_ebutsana_full_access_20260321`

---

## 1. Ce qui est livré

### Sprint HRM-1 — ✅ fermé

| Tâche | Statut | Dette fermée |
|---|---|---|
| HRM-1.0 — Nettoyage pré-sprint | ✅ | D5 (FK RESTRICT) |
| HRM-1.1 — Modèles DB RBAC + seed | ✅ | — |
| HRM-1.2 — `rbac.ts` DB-driven + branchement routes HRM | ✅ | **D6 backend** |
| HRM-1.3 — UI RBAC (Configuration > Rôles) | ✅ | — |
| HRM-1.4 — Endpoint assignables + contractor upsert télécom | ✅ | **D15** |
| HRM-1.5 — Leave management complet | ✅ | — |

### Sprint HRM-2 — 🟡 en cours (2/7)

| Tâche | Statut | Commits |
|---|---|---|
| HRM-2.1 — Recruitment complet | ✅ | `89f6a35`, `c58135e`, `5fb54da`, `000a064` |
| HRM-2.2 — Onboarding / Offboarding | ✅ | `8011a8e`, `2ff776a`, `e707075`, `e1a862e` |
| **HRM-2.3 — Training + Certifications** | 🔵 **PROCHAINE ÉTAPE** | — |
| HRM-2.4 — Policies + Cases | 🔵 | — |
| HRM-2.5 — Timesheets complétion | 🔵 | — |
| HRM-2.6 — SSE Events HRM | 🔵 | — |
| HRM-2.7 — Tests HRM étendus | 🔵 | — |

---

## 2. Règles transversales en vigueur (à respecter sans exception)

1. **Soft delete partout** sur les nouveaux modèles : `isDeleted Boolean @default(false) + deletedAt DateTime?`.
2. **`assertPermission(ctx, key)` sur chaque nouvelle route HRM dès le premier commit** — pas en post.
   - Helper exposé dans `backend/services/auth/rbac.service.mjs` (signature raw http `{ userId, res }`).
   - Express `requirePermission(key)` aussi dispo dans `rbac.middleware.mjs` mais non wiré (auth-server n'est pas Express).
3. **Page UI touchée = migration `can()` → `usePermissions()`** dans le **même commit**. État : 4/10. Reste : `HRMRouter`, `TrainingPage`, `WeekHeader`, `TimesheetsPage`, `PoliciesPage`, `CasesPage`.
4. **Migrations Prisma** : toujours `npx prisma migrate deploy` (pas `migrate dev` — DH6 bloque la shadow DB). SQL défensif :
   - `CREATE TABLE IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DO $$ ... pg_constraint guards $$` sur chaque FK.
5. **Pattern de 4 commits par sous-tâche HRM-2** :
   - Commit 1 : modèles Prisma + migration deploy
   - Commit 2 : service + routes backend (assertPermission partout)
   - Commit 3 : frontend + migration `can()` consumers concernés
   - Commit 4 : tests intégration + plan tické

---

## 3. Décisions architecture importantes (NE PAS rediscuter sans raison)

### RBAC overrides — approche Hybride
- **Extension** de `UserPermissionSet` existant (`+ permissionId?`, `+ assignedBy`, `+ reason`, `+ expiresAt`).
- **PAS** de `UserPermissionOverride` séparé.

### `UserRole` pattern temporel
- Contrainte unique : `@@unique([userId, roleId, validFrom])` — **à préserver**.
- Pas d'upsert sur `(userId, roleId)` — utiliser `findFirst({ userId, roleId, validTo: null })` + `create` si absent.
- Revoke = `validTo = now()`, jamais DELETE.

### Hook hire → checklist (HRM-2.2)
- Implémenté **dans** `backend/services/hrm/recruitmentOnboarding.service.mjs` (extension du stub HRM-1.0, pas réécriture).
- **Hors-transaction** : try/catch après `await prisma.$transaction(...)`. En cas d'erreur : `console.warn` + employé créé quand même.
- Résolution `templateId` : `input.onboardingTemplateId` > template département > template global > rien.

### `WorkItem.assignee` reste un string
- Pas de FK ajoutée (back-compat avec filtres substring dans `projectCollaboration.service.mjs`).

---

## 4. Points NON faits volontairement

- **Routes PM/Finance** non passées à `assertPermission` — attendre UI role-management testée en prod.
- **6 pages UI** restent sur le shim `can()` deprecated (voir §2.3).
- **DH6** (baseline Prisma migration) — chip task spawnée, à traiter en sprint infra dédié.
- **DH2** (table `PublicHoliday`) — marqueur dans `calculateLeaveDays` (`backend/services/hrm/leave.service.mjs`) à activer plus tard.
- **SSE events HRM** — couvert par HRM-2.6, pas encore traité.

---

## 5. Reprise de session — commandes utiles

### Démarrer le backend
```powershell
cd "D:\Mon mari\Google Antigravity\erp_polygons\.claude\worktrees\angry-sinoussi-faf92c"
npm run auth:api
```

### Démarrer le frontend (dans un autre terminal)
```powershell
npm run dev
```

### Suites de tests
```powershell
npm run test:hrm-leave
npm run test:hrm-recruitment
npm run test:hrm-onboarding
```

### Login test
- Email : `ebutsana@neox.io`
- Compte super_admin avec 98 permissions seedées.

### Appliquer une migration Prisma
```powershell
npx prisma migrate deploy
npx prisma generate
```

---

## 6. HRM-2.3 — pré-mémo pour la prochaine session

**Objectif** : Training + Certifications.

**Modèles attendus** (DRAFT_2 / `docs/NEOX_HRM_PLAN.md` §HRM-2.3) :
- `TrainingCourse` : id, title, description?, provider?, durationHours?, isInternal, isMandatory, soft delete
- `TrainingEnrollment` : id, userId, courseId, statusCode (enrolled|in_progress|completed|cancelled), enrolledAt, completedAt?, score?, certificate? + `@@unique([userId, courseId])`

**User relations à ajouter** : `trainingEnrollments TrainingEnrollment[]`.

**Routes attendues** :
- GET/POST/PUT/DELETE `/api/v1/hrm/training/courses` → `hrm.training.read` / `hrm.training.write`
- GET `/api/v1/hrm/training/enrollments?forUserId=...` → `hrm.training.read`
- POST `/api/v1/hrm/training/enrollments` → `hrm.training.execute` (inscrire un employé)
- PUT `/api/v1/hrm/training/enrollments/:id/complete` → `hrm.training.execute`
- PUT `/api/v1/hrm/training/enrollments/:id/cancel` → `hrm.training.execute`

**Frontend** :
- Lire `src/components/hrm/training/TrainingPage.tsx` en entier avant d'écrire.
- Migrer `can()` → `usePermissions()` dans le même commit (5/10 après ça).

**Critères de sortie HRM-2.3 du plan** :
- [ ] Créer un cours, inscrire des employés
- [ ] Employé voit ses formations en cours et terminées
- [ ] Badge "Certifié" sur le profil employé si complété

**Tests attendus** : créer cours, inscrire user, compléter avec score, annulation. Suite isolée style `hrm-onboarding.test.mjs`.

---

## 7. Fichiers backend HRM créés ce sprint

```
backend/services/hrm/
  assignables.service.mjs           # HRM-1.4
  contractorUpsert.service.mjs      # HRM-1.4 (D15)
  hrmDirectory.service.mjs          # existant
  leave.service.mjs                 # HRM-1.5
  offboarding.service.mjs           # HRM-2.2
  onboarding.service.mjs            # HRM-2.2
  payrollEngine.service.mjs         # existant
  rbacAdmin.service.mjs             # HRM-1.3
  recruitment.service.mjs           # HRM-2.1
  recruitmentOnboarding.service.mjs # HRM-1.0 + hook HRM-2.2

backend/routes/auth/
  me.routes.mjs                     # HRM-1.2 (/api/auth/me/permissions)

backend/routes/hrm/
  directory.routes.mjs              # HRM-1.4
  leave.routes.mjs                  # HRM-1.5
  onboarding.routes.mjs             # HRM-2.2 (on + off)
  rbac.routes.mjs                   # HRM-1.3
  recruitment.routes.mjs            # HRM-2.1

backend/services/auth/
  rbac.service.mjs                  # HRM-1.2 (+assertPermission)
  rbac.middleware.mjs               # HRM-1.2 (Express, non wiré)

backend/services/security/
  password.service.mjs              # HRM-1.0 port

backend/services/auth/
  firstLogin.service.mjs            # HRM-1.0 port

backend/services/notifications/
  welcomeEmail.service.mjs          # HRM-1.0 port

backend/tests/hrm/
  hrm-leave.test.mjs
  hrm-onboarding.test.mjs
  hrm-recruitment.test.mjs
```

## 8. Composants frontend HRM créés ce sprint

```
src/components/hrm/leave/
  LeaveBalanceCard.tsx
  LeaveCalendar.tsx
  LeavePage.tsx                     # refactorisé
  LeavePolicyManager.tsx
  LeaveRequestModal.tsx
  PendingApprovalsPanel.tsx

src/components/hrm/recruitment/
  CandidateHiredModal.tsx           # existant — onConfirm wiré sur nouvelle API
  JobPostingList.tsx
  RecruitmentPage.tsx               # refactorisé

src/components/hrm/onboarding/
  OnboardingPage.tsx                # refactorisé
  TemplateManagerModal.tsx          # partagé on+off

src/components/hrm/offboarding/
  OffboardingPage.tsx               # refactorisé

src/components/hrm/rbac/
  OverrideModal.tsx
  PermissionMatrix.tsx
  RoleAssignModal.tsx
  RoleCard.tsx
  RoleEditorPage.tsx
  RolesPage.tsx
  UserPermissionsPage.tsx

src/components/auth/
  PermissionGuard.tsx

src/components/pm/
  WorkItemAssigneeSelect.tsx        # HRM-1.4

src/services/
  assignablesApi.ts
  leaveApi.ts
  onboardingApi.ts
  rbacAdminApi.ts
  recruitmentApi.ts
```

---

## 9. Plan source de vérité

`docs/NEOX_HRM_PLAN.md` — toutes les cases HRM-1.0 → HRM-2.2 sont **tickées** avec notes par critère. HRM-2.3 → HRM-2.7 restent en `[ ]`.

---

## 10. Lecture obligatoire avant HRM-2.3

1. `docs/NEOX_HRM_PLAN.md` §HRM-2.3 (specs détaillées)
2. `src/components/hrm/training/TrainingPage.tsx` (550+ lignes)
3. `src/types/hrm.ts` (types Training existants)
4. Le pattern des 4 commits déjà appliqué en HRM-2.1 et HRM-2.2 — reproduire à l'identique.
