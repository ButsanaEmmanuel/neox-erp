-- HRM-1.1 — Extension additive des modèles RBAC existants.
-- Décision architecture: brouillon DRAFT_1_rbac_decision.md + tranchée
-- 2026-05-23 (Hybride) — étendre l'existant, ne pas créer de doublon.
--
-- Modèles touchés (tous additifs, aucun champ supprimé, aucune contrainte
-- existante modifiée — notamment @@unique([userId, roleId, validFrom])
-- sur UserRole est préservée car le pattern temporel est intentionnel):
--
--   Permission
--     + key         TEXT  UNIQUE  (backfillé depuis module.resource.action)
--     + description TEXT?
--     + index (module)
--
--   Role
--     + label       TEXT          (backfillé depuis name)
--     + description TEXT?
--     + isSystem    BOOLEAN false
--     + index (isSystem)
--
--   UserRole
--     + assignedBy  TEXT?
--     + index (userId, validTo)   pour résolution "rôles actifs courants"
--
--   UserPermissionSet
--     + permissionId TEXT?  FK -> Permission(id) ON DELETE SET NULL
--     + assignedBy   TEXT?
--     + reason       TEXT?
--     + expiresAt    TIMESTAMP?
--     + index (permissionId)
--     + index (expiresAt)         pour purge périodique
--
-- Safe to re-run: ALTER ADD COLUMN IF NOT EXISTS, DO $$ guards on
-- indexes and constraints.

-- ============================================================
-- Permission — add key, description
-- ============================================================
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "key"         TEXT;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Backfill key for any existing row (idempotent — only fills NULLs).
UPDATE "Permission"
   SET "key" = "module" || '.' || "resource" || '.' || "action"
 WHERE "key" IS NULL;

-- Make key NOT NULL once backfill is guaranteed.
ALTER TABLE "Permission" ALTER COLUMN "key" SET NOT NULL;

-- Unique index on key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'Permission_key_key'
  ) THEN
    CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
  END IF;
END $$;

-- Helper index for module-grouped lookups (RBAC matrix UI in HRM-1.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'Permission_module_idx'
  ) THEN
    CREATE INDEX "Permission_module_idx" ON "Permission"("module");
  END IF;
END $$;

-- ============================================================
-- Role — add label, description, isSystem
-- ============================================================
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "label"       TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isSystem"    BOOLEAN NOT NULL DEFAULT false;

-- Backfill label from name for any row missing it (idempotent).
UPDATE "Role"
   SET "label" = "name"
 WHERE "label" IS NULL;

ALTER TABLE "Role" ALTER COLUMN "label" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'Role_isSystem_idx'
  ) THEN
    CREATE INDEX "Role_isSystem_idx" ON "Role"("isSystem");
  END IF;
END $$;

-- ============================================================
-- UserRole — add assignedBy + supporting index
-- ============================================================
ALTER TABLE "UserRole" ADD COLUMN IF NOT EXISTS "assignedBy" TEXT;

-- Index for "currently active roles of user X" — used by rbac.service.mjs
-- in HRM-1.2 to resolve effective permissions efficiently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'UserRole_userId_validTo_idx'
  ) THEN
    CREATE INDEX "UserRole_userId_validTo_idx" ON "UserRole"("userId", "validTo");
  END IF;
END $$;

-- ============================================================
-- UserPermissionSet — extend for overrides metadata + Permission FK
-- ============================================================
ALTER TABLE "UserPermissionSet" ADD COLUMN IF NOT EXISTS "permissionId" TEXT;
ALTER TABLE "UserPermissionSet" ADD COLUMN IF NOT EXISTS "assignedBy"   TEXT;
ALTER TABLE "UserPermissionSet" ADD COLUMN IF NOT EXISTS "reason"       TEXT;
ALTER TABLE "UserPermissionSet" ADD COLUMN IF NOT EXISTS "expiresAt"    TIMESTAMP(3);

-- Backfill permissionId from existing (module, resource, action) triplet
-- when a matching Permission row exists. NULL stays NULL otherwise —
-- the resolver falls back to triplet match for legacy rows.
UPDATE "UserPermissionSet" ups
   SET "permissionId" = p."id"
  FROM "Permission" p
 WHERE ups."permissionId" IS NULL
   AND p."module"   = ups."module"
   AND p."resource" = ups."resource"
   AND p."action"   = ups."action";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserPermissionSet_permissionId_fkey'
  ) THEN
    ALTER TABLE "UserPermissionSet"
      ADD CONSTRAINT "UserPermissionSet_permissionId_fkey"
      FOREIGN KEY ("permissionId") REFERENCES "Permission"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'UserPermissionSet_permissionId_idx'
  ) THEN
    CREATE INDEX "UserPermissionSet_permissionId_idx" ON "UserPermissionSet"("permissionId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'UserPermissionSet_expiresAt_idx'
  ) THEN
    CREATE INDEX "UserPermissionSet_expiresAt_idx" ON "UserPermissionSet"("expiresAt");
  END IF;
END $$;
