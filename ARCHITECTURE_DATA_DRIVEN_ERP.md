# Architecture ERP Full-Database & Transactionnelle

## 1) Principes non-negociables

- `SSOT` : la base de donnees est l'unique source de verite.
- `Zero hardcoding` : roles, permissions, statuts, departements et workflows sont stockes en tables de configuration.
- `Read-before-render` : chaque ecran lit un snapshot frais via API avant rendu final.
- `Write-after-commit` : l'UI n'affiche un changement qu'apres confirmation transactionnelle du serveur.
- `Soft delete only` : suppression logique (`is_deleted = true`, `deleted_at`, `deleted_by`).

## 2) Cibles d'architecture

### 2.1 Backend

- API stateless (REST/GraphQL) + service layer transactionnelle.
- DB PostgreSQL avec contraintes FK/UNIQUE/CHECK, fonctions SQL et triggers d'audit.
- Prisma utilise pour les CRUD standards; SQL brut pour controle fin RBAC et audit (query-level).

### 2.2 Frontend

- L'etat local est un cache ephemere, jamais une source metier.
- Toute action critique est optimistic OFF par defaut (ou optimistic avec rollback strict + refetch).
- Invalidation/refetch immediat des queries apres mutation validee.

## 3) Modele de donnees SSOT (dynamique)

### 3.1 IAM / RBAC (sans enums hardcodes)

Tables minimales:

- `departments(id, code, name, is_active, is_deleted, created_at, updated_at)`
- `roles(id, code, name, is_active, is_deleted, created_at, updated_at)`
- `permissions(id, module, resource, action, is_active, created_at)`
- `role_permissions(role_id, permission_id, scope_type, scope_value, created_at)`
- `users(id, email, display_name, department_id, is_active, is_deleted, created_at, updated_at)`
- `user_roles(user_id, role_id, valid_from, valid_to, created_at)`

Regle: toute autorisation est resolue par requete DB, jamais par matrice TypeScript statique.

### 3.2 Catalogue de statuts / configurations

Tables minimales:

- `workflow_statuses(id, module, entity, code, label, sequence, is_terminal, is_active)`
- `workflow_transitions(id, module, entity, from_status_id, to_status_id, required_permission_id, is_active)`
- `app_settings(id, namespace, key, value_json, is_active, updated_at)`

Regle: statuts de commande, validation RH, etc. sont administres par data.

### 3.3 Domaines metier (exigences du brief)

- `timesheet_entries(..., user_id FK, department_id FK, status_id FK, is_deleted, created_at, updated_at)`
- `purchase_requests(..., requester_user_id FK, requester_department_id FK, status_id FK, is_deleted, created_at, updated_at)`
- `projects(..., owner_department_id FK, is_deleted, created_at, updated_at)`
- `project_members(project_id FK, user_id FK, department_id FK, role_code, is_deleted, created_at)`

### 3.4 Audit & tracabilite

- `audit_logs(id, tx_id, occurred_at, user_id, module, entity, entity_id, action_type, old_value_json, new_value_json, meta_json)`
- `domain_events(id, tx_id, event_type, payload_json, created_at, published_at)` (optionnel pour outbox).

Regle: chaque transaction metier ecrit au moins une ligne d'audit.

## 4) Contrats transactionnels (ACID)

Pattern standard (toute mutation critique):

1. Debut transaction.
2. Lock logique (`SELECT ... FOR UPDATE`) des lignes impactees.
3. Verification droits via fonction DB.
4. Validation workflow (transition autorisee).
5. Ecriture metier.
6. Ecriture audit (old/new).
7. Commit.
8. Reponse API.

En cas d'echec a une etape: rollback total.

## 5) RBAC Query-Level (filtrage a la source)

### 5.1 Lecture

Toujours filtrer en SQL:

- par appartenance utilisateur (`user_id = $currentUser`),
- ou departement (`department_id IN (...)`),
- ou membership (`EXISTS project_members ...`).

Exemple projet:

```sql
SELECT p.*
FROM projects p
WHERE p.is_deleted = false
  AND EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id
      AND pm.user_id = $1
      AND pm.is_deleted = false
  );
```

### 5.2 Ecriture

Avant tout `POST/PATCH/DELETE`:

```sql
SELECT authorize_action($user_id, $module, $resource, $action, $department_id);
```

Si `false` -> `403`, aucune mutation.

## 6) Exigences par module

### 6.1 HRM

- `timesheet_entries.user_id` obligatoire.
- `timesheet_entries.department_id` obligatoire.
- Statut valide uniquement via `workflow_transitions`.

### 6.2 SCM

- Creation de `purchase_requests` => insertion automatique `audit_logs` dans la meme transaction.
- Aucun mouvement de stock sans ecriture du ledger + audit.

### 6.3 CRM / Projet

- Visibilite projet derivee de `project_members`.
- Isolation departementale assuree cote SQL/API, jamais cote client.

## 7) Fonctions SQL recommandees

- `authorize_action(user_id, module, resource, action, department_id) returns boolean`
- `assert_workflow_transition(module, entity, from_status_id, to_status_id, user_id) returns void`
- `write_audit_log(tx_id, user_id, module, entity, entity_id, action_type, old_json, new_json, meta_json) returns void`

## 8) Anti-patterns interdits

- Enums metier figees en code pour roles/permissions/statuts.
- Filtrage de securite uniquement front-end.
- Mise a jour UI avant commit serveur.
- `DELETE` physique sur tables metier.

## 9) Migration depuis l'etat actuel du projet

Constat actuel:

- RBAC hardcode dans `src/lib/rbac.ts`.
- Orchestration SCM et donnees encore liees aux stores front (`zustand/local storage`).
- Prisma schema encore base sur enum `Role` et statuts string.

Plan de migration:

1. Creer tables IAM dynamiques + workflow + audit.
2. Remplacer enum `Role` par `roles`/`user_roles`.
3. Introduire une couche backend transactionnelle (services + repository SQL).
4. Deplacer verifications RBAC du front vers API/DB.
5. Brancher frontend sur endpoints serveur avec refetch post-mutation.
6. Activer soft delete global + index partiels (`WHERE is_deleted = false`).

## 10) Definition of Done (DoD)

- Aucun role/permission/statut metier hardcode dans le code applicatif.
- 100% des mutations critiques sous transaction DB.
- 100% des `POST/PATCH/DELETE` verifies par `authorize_action`.
- 100% des ecritures critiques journalisees dans `audit_logs`.
- 0 suppression physique sur tables metier.

---

Ce document fixe l'architecture cible "full-database" et sert de reference d'implementation pour CRM, SCM, Projet et HRM.
