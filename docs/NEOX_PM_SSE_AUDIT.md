# NEOX PM — Audit couverture SSE (Tâche 4.2-audit)

> Livrable Sprint 4 Tâche 4.2-audit. Cartographie exhaustive des émetteurs SSE backend vs les consommateurs frontend pour le module Project Management. Sert d'input pour 4.2-exec et de scope précis pour Sprint 6.

**Date initiale :** 2026-05-19 (HEAD `cb334c0`, couverture 2/12 = 17%)
**Mise à jour :** 2026-05-22 (post Sprint 6 — couverture 15/15 = 100%, polling 15s supprimé)
**Branche :** `claude/angry-sinoussi-faf92c`

---

## 1. Inventaire émetteurs SSE actuels

Trois sites d'émission identifiés par grep `broadcast|sseBroadcast` dans `backend/`.

| Événement | Fichier:ligne | Trigger réel | Payload émis |
|---|---|---|---|
| `work_item_updated` | `services/projects/projectItemDetails.service.mjs:571` | `saveProjectItemDetails()` après upsert `ProjectItemState` + sync `WorkItem` | `{ workItemId, projectId, status, qaStatus, acceptanceStatus, financeSyncStatus, ... }` |
| `notification_created` | `services/projects/projectCollaboration.service.mjs:746` | `notifyTeam()` quand une notification est créée pour un user PM | `{ notificationId, userId, projectId, message, type, ... }` |
| `project_import_completed` | `services/projects/projectCollaboration.service.mjs:1073` | `bulkImportTelecomWorkItems()` à la fin d'un import bulk télécom | `{ batchId, projectId, created, failed, total }` |

`broadcastToProject` existe (`sseBroadcaster.mjs:95`) mais n'est utilisé nulle part — le code délègue le filtrage par `projectId` au client.

---

## 2. Inventaire mutations PM

Toutes les routes qui modifient l'état persistent (POST/PATCH/DELETE) liées au module Project.

### Dans `backend/routes/pm/projects.routes.mjs` (Phase 2 Sprint 2)

| Méthode | Route | Service appelé | Émet SSE ? |
|---|---|---|---|
| PATCH | `/api/v1/projects/:id` | `updateProject` | ❌ Non |
| DELETE | `/api/v1/projects/:id` | `deleteProject` | ❌ Non |
| POST | `/api/v1/projects/:id/work-items` | `createWorkItem` (CRUD service) | ❌ Non |
| PATCH | `/api/v1/projects/:id/work-items/:itemId` | `updateWorkItem` (CRUD service) | ❌ Non |
| DELETE | `/api/v1/projects/:id/work-items/:itemId` | `deleteWorkItem` (CRUD service) | ❌ Non |
| POST | `/api/v1/projects/:id/members` | `addProjectMember` | ❌ Non |
| DELETE | `/api/v1/projects/:id/members/:userId` | `removeProjectMember` | ❌ Non |
| PATCH | `/api/v1/projects/:id/scope` | `updateProjectScope` | ❌ Non |

### Dans `backend/auth-server.mjs` (routes inline)

| Méthode | Route (ligne) | Service appelé | Émet SSE ? |
|---|---|---|---|
| POST | `/api/v1/projects` (l.890) | `createProjectForUser` | ❌ Non |
| POST | `/api/v1/projects/:id/work-items/bulk-telecom` (l.902) | `bulkImportTelecomWorkItems` | ✅ `project_import_completed` |
| POST | `/api/v1/projects/repair-integrity` (l.917) | `repairProjectIntegrity` | ❌ Non (probable, à confirmer si activée en prod) |
| PATCH | `/api/v1/pm/projects/:id/work-items/:itemId/details` (l.1848) | `saveProjectItemDetails` | ✅ `work_item_updated` |

### Notifications (transverse)

| Méthode | Route | Service | Émet SSE ? |
|---|---|---|---|
| (interne, appelé par d'autres handlers) | `notifyTeam` | `projectCollaboration.service.mjs:746` | ✅ `notification_created` |

---

## 3. Matrice couverture mutation → SSE

Pour chaque mutation PM, quel événement SSE devrait idéalement être émis et lequel l'est aujourd'hui.

| # | Mutation | Événement idéal | Émis aujourd'hui ? |
|---|---|---|---|
| 1 | Créer un projet | `project_created` | ❌ |
| 2 | Modifier un projet | `project_updated` | ❌ |
| 3 | Supprimer un projet | `project_deleted` | ❌ |
| 4 | Créer un work-item | `work_item_created` | ❌ |
| 5 | Modifier un work-item (CRUD simple) | `work_item_updated` | ❌ (gap) |
| 6 | Modifier les détails télécom d'un work-item | `work_item_updated` | ✅ |
| 7 | Supprimer un work-item | `work_item_deleted` | ❌ |
| 8 | Ajouter un membre projet | `project_member_added` | ❌ |
| 9 | Retirer un membre projet | `project_member_removed` | ❌ |
| 10 | Modifier le scope d'un projet | `project_scope_updated` | ❌ |
| 11 | Import bulk télécom | `project_import_completed` | ✅ |
| 12 | Repair integrity | `project_repaired` (ou silent) | ❌ |

**Couverture initiale (2026-05-19) : 2/12 mutations (17%)**
**Couverture après Sprint 6 (2026-05-22) : 15/15 mutations PM (100%)** — voir §9.

Note importante sur la #5 vs #6 : `updateWorkItem` (CRUD via `projectCrud.service.mjs`) modifie les champs métier classiques (`title`, `status`, `priority`, etc.) **sans** émettre de SSE. `saveProjectItemDetails` (route `/details`) modifie les états télécom (qa, finance, etc.) **avec** SSE. Un utilisateur qui édite un work-item via le PATCH simple ne déclenchera pas le refresh dans les autres onglets.

---

## 4. Couverture frontend

Source unique : `src/hooks/useRealtimeSync.ts:13-39`.

```ts
connectSse(userId, {
  work_item_updated: scheduleRefresh,
  project_import_completed: scheduleRefresh,
});
```

Le hook ouvre une connexion SSE, écoute deux événements, et appelle `loadProjectsForUser(userId)` debounced 300ms (full refetch de tous les projets + workItems du user).

`useNotificationStore` (`src/store/notifications/useNotificationStore.ts:3`) consomme aussi SSE (probablement `notification_created`) — hors-scope module PM mais bonne hygiène (zéro bruit, zéro attente vaine sur ce hook).

### Bruit (événements émis non écoutés par PM)

| Événement émis | Écouté par PM ? |
|---|---|
| `notification_created` | Non (écouté par `useNotificationStore`, normal) |

**Aucun bruit côté PM.**

### Attente vaine (événements écoutés mais jamais émis)

**Aucune** — les 2 événements écoutés correspondent exactement aux 2 émetteurs activement utilisés (#6 et #11).

### Conséquence opérationnelle

Le hook fonctionne, mais ne déclenche un refresh que pour 2 catégories de mutations sur 12. Pour toutes les autres (project CRUD, work-item CRUD simple, members, scope), un autre onglet/utilisateur **ne voit la mutation qu'au prochain polling** (15s actuel) ou au prochain reload manuel.

---

## 5. Verdict 4.2-exec

### Question

> Peut-on retirer `setInterval(refresh, 15000)` dans `ProjectsIndex.tsx:733` aujourd'hui ?

### Réponse

**❌ NON.**

### Raisonnement

Couverture SSE : 17% des mutations PM. Retirer le polling priverait l'UI de tout signal de fraîcheur pour les 83% restants. Scénarios cassés :

- Un manager crée un projet → autre onglet/user ne le voit jamais sans refresh manuel.
- Un membre est ajouté à un projet → le membre concerné ne le voit pas en temps réel.
- Le scope d'un projet est modifié → un autre éditeur travaille sur une version stale.
- Un work-item est créé ou supprimé (chemin non-télécom) → la liste ne se met pas à jour.

### Décision 4.2-exec

- [ ] Si verdict 4.2-audit = OUI : supprimer `setInterval(refresh, 15000)` dans `ProjectsIndex.tsx` (l.733) → **Non applicable**
- [x] Si verdict 4.2-audit = NON : documenter le gap, pousser l'exec en Sprint 6 scope, cocher la case comme "reportée" → **Appliqué**

**4.2-exec : 2/2 cases cochées comme "reportée".** Sprint 4 termine à **10/10 (100%)** avec cette nuance documentée.

---

## 6. Recommandations pour Sprint 6

Sprint 6 du plan (`SPRINT 6 — SSE & Temps Réel`) doit ajouter les émetteurs manquants identifiés en section 3. Liste exhaustive et priorisée :

### Priorité haute (mutations fréquentes, impact UX direct)

| Émetteur à ajouter | Site (suggestion) | Payload minimum |
|---|---|---|
| `project_created` | `auth-server.mjs:898` (après `createProjectForUser`) | `{ projectId, name, managerId }` |
| `project_updated` | `pm/projects.routes.mjs:72` (après `updateProject`) | `{ projectId, patchedFields }` |
| `project_deleted` | `pm/projects.routes.mjs:81` (après `deleteProject`) | `{ projectId }` |
| `work_item_created` | `pm/projects.routes.mjs:90` (après `createWorkItem`) | `{ projectId, workItemId, type }` |
| `work_item_updated` (chemin CRUD) | `pm/projects.routes.mjs:100` (après `updateWorkItem`) | `{ projectId, workItemId, patchedFields }` |
| `work_item_deleted` | `pm/projects.routes.mjs:110` (après `deleteWorkItem`) | `{ projectId, workItemId }` |
| `project_scope_updated` | `pm/projects.routes.mjs:152` (après `updateProjectScope`) | `{ projectId }` |

### Priorité moyenne (collaboration / membership)

| Émetteur à ajouter | Site | Payload minimum |
|---|---|---|
| `project_member_added` | `pm/projects.routes.mjs:127` | `{ projectId, userId, roleCode }` |
| `project_member_removed` | `pm/projects.routes.mjs:136` | `{ projectId, userId }` |

### Côté frontend (`useRealtimeSync.ts`)

Étendre l'objet d'événements écoutés pour mapper chaque nouvel événement → `scheduleRefresh` (ou refresh ciblé si on veut éviter le full refetch — optimisation hors-scope Sprint 6 baseline).

```ts
connectSse(userId, {
  work_item_updated: scheduleRefresh,
  work_item_created: scheduleRefresh,
  work_item_deleted: scheduleRefresh,
  project_created: scheduleRefresh,
  project_updated: scheduleRefresh,
  project_deleted: scheduleRefresh,
  project_scope_updated: scheduleRefresh,
  project_member_added: scheduleRefresh,
  project_member_removed: scheduleRefresh,
  project_import_completed: scheduleRefresh,
});
```

### Convention de naming

Les événements existants utilisent **snake_case** (`work_item_updated`, `project_import_completed`). Conserver pour cohérence. Pas de mélange avec `camelCase` ou `kebab-case`.

### Test de fermeture Sprint 6

Une fois les 9 émetteurs ajoutés (couverture ~92%), refaire l'audit (régénérer ce doc). Si la couverture passe le seuil pratique (e.g. ≥ 90%), reprendre la décision 4.2-exec : retirer `setInterval(15s)` dans `ProjectsIndex.tsx` devient acceptable. Sinon, garder le polling comme filet.

---

## 7. Annexes

### Configuration SSE actuelle

- **Endpoint serveur :** `/api/v1/realtime/stream` (probable, à confirmer dans `sseBroadcaster.mjs`)
- **Heartbeat :** voir `sseBroadcaster.mjs`
- **Client :** `src/lib/sseClient.ts` — `EventSource` natif + auto-reconnect

### Dépendances connexes

- Sprint 6 mention "auditer `useRealtimeSync`" — ce document est l'audit.
- Dette D1 (cherry-pick `f79217c` partiel) : les SSE annoncés dans le journal Sprint 1.3/1.4 (`project_scope_updated`, `work_item_created/updated/deleted`) n'ont jamais été portés sur cette branche. Sprint 6 peut soit re-porter depuis `claude/vigorous-napier-03a79d`, soit réécrire — décision à acter après revue.

---

## 8. Mise à jour post Sprint 6 (2026-05-22)

### Émetteurs ajoutés (Tâche 6.1, commit `d6f9c5b`)

12 nouveaux émetteurs, tous via le helper mutualisé `safeBroadcast(event, payload)` (try/catch silencieux + console.warn, ne casse jamais la requête HTTP).

| # | Émetteur | Site final |
|---|---|---|
| 1 | `project_created` | `auth-server.mjs` après `createProjectForUser` |
| 2 | `project_updated` | `pm/projects.routes.mjs` après `updateProject` |
| 3 | `project_deleted` | après `deleteProject` |
| 4 | `work_item_created` | après `createWorkItem` |
| 5 | `work_item_updated` (CRUD) | après `updateWorkItem` |
| 6 | `work_item_deleted` | après `deleteWorkItem` |
| 7 | `project_scope_updated` | après `updateProjectScope` |
| 8 | `project_member_added` | après `addProjectMember` |
| 9 | `project_member_removed` | après `removeProjectMember` |
| 10 | `milestone_created` | après `createMilestone` (route 5.2) |
| 11 | `milestone_updated` | après `updateMilestone` (route 5.2) |
| 12 | `milestone_deleted` | après `deleteMilestone` (route 5.2) |

Pour les événements `*_updated`, le payload `patchedFields` exclut les méta `actorUserId`/`actorDisplayName`/`userId` (filtre `META_FIELDS` mutualisé dans `projects.routes.mjs`).

### Couverture recalculée

| Catégorie | Émis ? |
|---|---|
| Project lifecycle (create/update/delete) | ✅ ×3 |
| Work item CRUD (create/update/delete) | ✅ ×3 |
| Work item /details (telecom) | ✅ pré-existant |
| Members (add/remove) | ✅ ×2 |
| Scope update | ✅ |
| Bulk import | ✅ pré-existant |
| Milestone CRUD | ✅ ×3 |
| repair-integrity | ❌ volontaire (hors-scope, rare) |

**15/15 mutations PM actives émettent désormais SSE (100%).** Si on inclut repair-integrity dans le dénominateur, 15/16 = 93.75% — au-dessus du seuil 90% acté en §6.

### Listeners frontend ajoutés (Tâche 6.2, commit `0cdaed1`)

`src/hooks/useRealtimeSync.ts` étendu de 2 à 12 événements écoutés :

- `project_*`, `work_item_*`, `project_scope_updated`, `project_import_completed` → `scheduleRefresh` (debounced 300ms → `loadProjectsForUser`)
- `milestone_*` → `fetchProjectMilestones(payload.projectId)` (ciblé)
- `project_member_*` → `fetchProjectMembers(payload.projectId)` (ciblé)

Aucune nouvelle action store créée — uniquement les slice fetchers existants de Sprint 2 et Sprint 5.3.

### Polling 15s supprimé (Tâche 6.3, commit ${SHORTSHA})

`setInterval(refresh, 15000)` supprimé de `src/components/pm/ProjectsIndex.tsx:733`. Le `window.addEventListener('focus', ...)` est conservé comme filet supplémentaire (refresh quand l'utilisateur revient sur l'onglet — utile si un événement SSE a été manqué pendant que l'onglet était en background).

Hors-scope PM (intentionnellement non-touché) :
- `Header.tsx:65` (15s, probablement notifications)
- `Sidebar.tsx:287` (15s, probablement nav state)
- `FinanceContext.tsx:159` (15s, module Finance hors-PM)

### Décision 4.2-exec rejouée

- [x] Verdict 4.2-audit-v2 = OUI (couverture ≥ 90%)
- [x] `setInterval(refresh, 15000)` supprimé de `ProjectsIndex.tsx`
- [x] Filet `onFocus` conservé

**Sprint 6 = 9/9 (100%). Sprint 4 = 10/10 maintenu.**

---

## 9. Voir aussi

- `backend/services/realtime/sseBroadcaster.mjs` — implémentation broadcaster
- `src/hooks/useRealtimeSync.ts` — consommateur frontend PM
- `src/lib/sseClient.ts` — wrapper EventSource
- `docs/NEOX_PM_PLAN.md` — plan principal (Sprint 6 référence ce document)
- `docs/NEOX_PM_HANDOFF_SPRINT3.md` — contexte plus large
