# RBAC Guidelines — NEOX ERP (cross-modules)

> Référence opérationnelle. Toute nouvelle route, tout nouveau module
> et tout nouveau rôle doivent suivre ce document. Source unique de
> vérité du registry : `prisma/seed/rbac.seed.mjs`.

Sprint d'origine : DH9 (audit RBAC cross-modules, 2026-05-25).

---

## 1. Pattern standard de gating (backend)

Toute route HTTP qui touche une ressource métier DOIT commencer par un
`assertPermission` **avant** toute lecture de body ou requête Prisma.

```js
import { assertPermission } from './services/auth/rbac.service.mjs';

if (method === 'POST' && pathname === '/api/v1/<module>/<resource>') {
  const actor = parseActorFromUrl(url);
  if (!(await assertPermission({ userId: actor.actorUserId, res },
        '<module>.<resource>.<action>'))) return;
  const body = await parseBody(req);
  // ... logique métier
}
```

Règles :

- `parseActorFromUrl(url)` extrait `?userId=...` — c'est l'identité
  RBAC. Le `parseActor(body)` reste utilisé pour tracer l'auteur de
  l'action (audit), pas pour la décision d'accès.
- L'`assertPermission` court-circuite avec un 403 structuré
  (`{ error, code: 'PERMISSION_DENIED', required }`) si le user n'a
  pas la key. Pas besoin d'écrire le 403 à la main.
- Gater AVANT `parseBody` évite de consommer le corps quand on va
  rejeter — important pour les uploads volumineux.
- Le `return false` du helper signale que la réponse a déjà été
  écrite (`res.writeHead` + `res.end` faits dedans). Toujours retourner
  immédiatement après le `if (!(await ...))`.

Pour les routes définies dans `backend/routes/pm/projects.routes.mjs`
(module séparé), le même pattern s'applique — l'`assertPermission` est
appelé en tête de handler.

---

## 2. Convention de nommage des keys

Format atomique : **`<module>.<resource>.<action>`**

| Action standard | Sémantique |
|---|---|
| `read` | Lire / lister la ressource |
| `write` | Créer ou modifier (POST/PATCH/PUT) |
| `delete` | Supprimer (soft-delete recommandé) |
| `execute` | Déclencher une action métier (approuver, lancer un job, publier) |

Actions non-standard tolérées si justifiées :
- `admin` (`hrm.leave.admin` — gérer les politiques)
- `manage` (`finance.settings.manage` — legacy, à éviter sur nouveau code)
- `approve`, `reject`, `submit_validation`, `settle`, `upload`, `resolve`
  (legacy finance.entries — conservées pour rétrocompat)

**Préférer `execute`** pour toute nouvelle action métier transverse.

`<module>` : `crm`, `pm`, `hrm`, `finance`, `scm`, `hse`, `system`.

`<resource>` : nom au pluriel ou singulier cohérent (`projects`,
`workItems`, `clients`, `deals`, `invoices`, `bills`, `payments`,
`receipts`, `reconciliation`, `snapshot`, `dashboard`, `notifications`,
`reports`, `access`, `rbac`, `audit`, `settings`).

---

## 3. Règle d'ordre — seed AVANT route

> **Toute nouvelle route doit avoir sa key déclarée dans le seed
> AVANT d'être déployée en prod.**

Workflow obligatoire :

1. Ajouter la key au tableau `PERMISSIONS` dans `prisma/seed/rbac.seed.mjs`.
2. Assigner la key au(x) rôle(s) métier dans `ROLES` (cf. §5).
3. Exécuter `node prisma/seed/rbac.seed.mjs` en dev pour vérifier
   l'idempotence (création / update / no-op).
4. Ajouter la route + `assertPermission(ctx, key)`.
5. **Commit unique** : seed + route ensemble. Pas de commit "route
   d'abord, seed plus tard" — risque de blocage prod si la migration
   seed n'est pas exécutée.

Le seed est idempotent (`upsert` partout). Re-exécution safe.

---

## 4. Règle de couverture — rôles métier

> **Ne jamais gater une route sans avoir vérifié que le rôle métier
> attendu a la key correspondante.** Un gating sans couverture = 403
> sur tous les utilisateurs non-`super_admin` = blocage prod.

Avant tout `assertPermission` sur une nouvelle key, vérifier :

```sql
SELECT r.code, COUNT(rp.id) AS n
FROM "Role" r
LEFT JOIN "RolePermission" rp ON rp."roleId" = r.id
LEFT JOIN "Permission" p ON rp."permissionId" = p.id AND p.key = '<key>'
GROUP BY r.code
ORDER BY r.code;
```

Le rôle métier attendu (`finance_admin`, `project_manager`, etc.) doit
retourner au moins 1.

Spreads automatiques dans le seed (à exploiter) :

| Spread | Effet |
|---|---|
| `ALL_KEYS` | `super_admin` couvre tout le registry |
| `...HRM_KEYS` | `hr_admin` reçoit toutes les keys `hrm.*` |
| `...PM_KEYS` | `project_manager` reçoit toutes les keys `pm.*` |
| `...FIN_KEYS` | `finance_admin` reçoit toutes les keys `finance.*` |
| `...SCM_KEYS` | `scm_manager` reçoit toutes les keys `scm.*` |
| `...READ_KEYS` | `readonly` reçoit toutes les `*.*.read` |

Donc une nouvelle key `finance.X.read` est automatiquement obtenue
par `super_admin`, `finance_admin`, `readonly`. Pour `finance_officer`,
il faut l'ajouter explicitement (le rôle n'utilise pas de spread).

---

## 5. Tableau des modules et de leurs keys (post-DH9)

Total registry : **134 keys**, **10 rôles** système.

| Module | Keys | Rôles porteurs (hors `super_admin`) |
|---|---|---|
| `hrm.*` | 40 | `hr_admin` (...HRM_KEYS), `hr_officer` (subset), `employee_self_service` (subset), `project_manager` (directory/employees.read), `finance_admin` (payroll.*), `readonly` (*.read) |
| `pm.*` | 20 | `project_manager` (...PM_KEYS), `project_member` (subset), `readonly` (*.read) |
| `crm.*` | 5 | (aucun rôle CRM dédié — DH9) — `super_admin` seul. Créer `crm_manager` quand le module aura une UI multi-utilisateur. |
| `finance.*` | 13 (DH9) + 13 (existantes) + 10 (legacy) = 36 | `finance_admin` (...FIN_KEYS + hrm.payroll.*), `finance_officer` (subset + nouveaux .read DH9), `project_manager` (ledger.read + expenses.read), `readonly` (*.read) |
| `scm.*` | 11 | `scm_manager` (...SCM_KEYS), `readonly` (*.read) |
| `hse.*` | 8 | (aucun rôle HSE dédié — squelette uniquement) — `super_admin` seul, `readonly` couvre les `.read` |
| `system.*` | 13 | `hr_admin` (rbac.*, audit.read), tous les rôles métier (dashboard.read + notifications.{read,write} — DH9), `super_admin` seul pour `system.access.*` / `system.reports.*` / `system.settings.*` / `system.rbac.*` (sauf hr_admin) |

Détail exhaustif : lire directement `prisma/seed/rbac.seed.mjs` —
section `PERMISSIONS` (catalogue) + section `ROLES` (assignations).

---

## 6. Modules sans routes propres — HSE et SCM

### HSE (squelette UI uniquement aujourd'hui)

Les 8 keys `hse.*` existent au registry. Quand les routes HSE seront
créées :

1. **Keys d'abord** : vérifier qu'elles existent encore au seed.
2. **Rôle HSE** : créer `hse_manager` si on veut un rôle dédié, ou
   utiliser `super_admin` + `readonly` au début.
3. **Routes ensuite** : chaque handler commence par
   `assertPermission(ctx, 'hse.<resource>.<action>')`.
4. **Jamais** `assertModuleAccess(prisma, url, 'hse')` — le helper est
   legacy.

### SCM (3 bridges actuels sous `/finance/scm/*`, pas de routes propres)

Les bridges existants (`po-commitment`, `vendor-bills`,
`requisition-commitment`, `po/:id/status`) sont gardés sur
`finance.ledger.{read,write}` depuis DH9 — pas sur `scm.*` car ils
écrivent dans le ledger finance, pas dans le SCM.

Quand des routes SCM propres (`/api/v1/scm/...`) seront créées :

1. Utiliser les keys `scm.*` (11 déjà au seed).
2. `scm_manager` les couvre automatiquement via `...SCM_KEYS`.
3. Routes via `assertPermission`.

---

## 7. `assertModuleAccess` — helper legacy

Le helper `assertModuleAccess(prismaClient, url, moduleId, body?)`
défini dans `backend/auth-server.mjs:516` est **legacy**. Il vérifie
un accès grossier au niveau module (visible/readOnly via
`getUserPermissionSet`).

**Plus aucune route inline d'`auth-server.mjs` ne l'appelle après DH9.**

Règles :

- ❌ Ne JAMAIS ajouter `assertModuleAccess` sur un nouveau handler.
- ✅ Toujours utiliser `assertPermission(ctx, key)` avec une key
  atomique du registry.
- Le helper reste défini car certains modules importateurs peuvent
  encore l'utiliser ; il sera supprimé dans un sprint ultérieur de
  nettoyage une fois toute l'application migrée.

---

## 8. Exemple complet — ajouter une route + key + rôle en 1 commit

Hypothèse : ajouter `POST /api/v1/scm/inventory/transfer` qui déplace
du stock entre dépôts.

### Étape 1 — registre

`prisma/seed/rbac.seed.mjs`, dans `PERMISSIONS` (section SCM) :

```js
{ module: 'scm', resource: 'inventory', action: 'execute',
  description: 'Déclencher un transfert ou ajustement de stock' },
```

### Étape 2 — rôle

`scm_manager` couvre automatiquement via `...SCM_KEYS` (pas d'édition).
Si on veut le donner aussi à `readonly` ? Non — `execute` n'est pas
inclus dans `READ_KEYS`. Garder `scm_manager` + `super_admin` seuls.

### Étape 3 — route

`backend/routes/scm/inventory.routes.mjs` (ou inline `auth-server.mjs`) :

```js
if (method === 'POST' && pathname === '/api/v1/scm/inventory/transfer') {
  const actor = parseActorFromUrl(url);
  if (!(await assertPermission({ userId: actor.actorUserId, res },
        'scm.inventory.execute'))) return;
  const body = await parseBody(req);
  const bodyActor = parseActor(body);
  const result = await transferInventory(prisma, body, bodyActor);
  return json(res, 201, result);
}
```

### Étape 4 — commit

```
feat(scm): inventory transfer route + RBAC key
```

Un seul commit, seed + route ensemble. Pas de gap.

---

## 9. Voir aussi

- `prisma/seed/rbac.seed.mjs` — registre + rôles (source de vérité)
- `backend/services/auth/rbac.service.mjs` — `assertPermission`,
  `hasPermission`, `getUserPermissions`
- `backend/services/access/universalAccess.service.mjs` —
  `getUserPermissionSet` (vue agrégée pour le frontend)
- `docs/NEOX_PM_PERMISSIONS.md` — détail PM (Sprint 3)
- `docs/NEOX_HRM_PLAN.md` §3 — catalogue HRM
- `src/hooks/usePermissions.ts` — consommation frontend

---

## Changelog

| Date | Sprint | Modifications |
|---|---|---|
| 2026-05-25 | DH9 | Création initiale du document. Registry étendu de 109 à 134 keys (CRM +5, system DH9 +7, finance fine-grained +13). 70 routes gardées ou migrées dans `auth-server.mjs`. Plus aucun `assertModuleAccess` inline. |
