-- CRM Reference Data Management (RDM)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "crm_ref_industries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "crm_ref_pipeline_stages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "crm_ref_sources" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "crm_ref_statuses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "crm_ref_activity_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "crm_ref_industries_active_sort_idx" ON "crm_ref_industries" ("is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "crm_ref_pipeline_stages_active_sort_idx" ON "crm_ref_pipeline_stages" ("is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "crm_ref_sources_active_sort_idx" ON "crm_ref_sources" ("is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "crm_ref_statuses_active_sort_idx" ON "crm_ref_statuses" ("is_active", "sort_order");
CREATE INDEX IF NOT EXISTS "crm_ref_activity_types_active_sort_idx" ON "crm_ref_activity_types" ("is_active", "sort_order");

ALTER TABLE "ClientAccount" ADD COLUMN IF NOT EXISTS "industryRefId" TEXT;
ALTER TABLE "ClientAccount" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "stageRefId" TEXT;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "statusRefId" TEXT;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "sourceRefId" TEXT;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "ClientAccount_industryRefId_idx" ON "ClientAccount" ("industryRefId");
CREATE INDEX IF NOT EXISTS "ClientAccount_ownerUserId_idx" ON "ClientAccount" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "CrmDeal_stageRefId_idx" ON "CrmDeal" ("stageRefId");
CREATE INDEX IF NOT EXISTS "CrmDeal_statusRefId_idx" ON "CrmDeal" ("statusRefId");
CREATE INDEX IF NOT EXISTS "CrmDeal_sourceRefId_idx" ON "CrmDeal" ("sourceRefId");
CREATE INDEX IF NOT EXISTS "CrmDeal_ownerUserId_idx" ON "CrmDeal" ("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientAccount_industryRefId_fkey') THEN
    ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_industryRefId_fkey"
      FOREIGN KEY ("industryRefId") REFERENCES "crm_ref_industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClientAccount_ownerUserId_fkey') THEN
    ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CrmDeal_stageRefId_fkey') THEN
    ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_stageRefId_fkey"
      FOREIGN KEY ("stageRefId") REFERENCES "crm_ref_pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CrmDeal_statusRefId_fkey') THEN
    ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_statusRefId_fkey"
      FOREIGN KEY ("statusRefId") REFERENCES "crm_ref_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CrmDeal_sourceRefId_fkey') THEN
    ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_sourceRefId_fkey"
      FOREIGN KEY ("sourceRefId") REFERENCES "crm_ref_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CrmDeal_ownerUserId_fkey') THEN
    ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "crm_ref_pipeline_stages" ("label", "value", "is_active", "sort_order") VALUES
  ('Discovery', 'discovery', TRUE, 10),
  ('Qualified', 'qualified', TRUE, 20),
  ('Proposal', 'proposal', TRUE, 30),
  ('Negotiation', 'negotiation', TRUE, 40),
  ('Closing', 'closing', TRUE, 50)
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "crm_ref_statuses" ("label", "value", "is_active", "sort_order") VALUES
  ('Open', 'open', TRUE, 10),
  ('Won', 'won', TRUE, 20),
  ('Lost', 'lost', TRUE, 30)
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "crm_ref_sources" ("label", "value", "is_active", "sort_order") VALUES
  ('Referral', 'referral', TRUE, 10),
  ('Inbound', 'inbound', TRUE, 20),
  ('Outbound', 'outbound', TRUE, 30),
  ('Event', 'event', TRUE, 40)
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "crm_ref_industries" ("label", "value", "is_active", "sort_order") VALUES
  ('Technology', 'technology', TRUE, 10),
  ('Manufacturing', 'manufacturing', TRUE, 20),
  ('Logistics', 'logistics', TRUE, 30),
  ('Retail', 'retail', TRUE, 40),
  ('Financial Services', 'financial-services', TRUE, 50)
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "crm_ref_activity_types" ("label", "value", "is_active", "sort_order") VALUES
  ('Call', 'call', TRUE, 10),
  ('Email', 'email', TRUE, 20),
  ('Meeting', 'meeting', TRUE, 30),
  ('Demo', 'demo', TRUE, 40),
  ('Note', 'note', TRUE, 50)
ON CONFLICT ("value") DO NOTHING;

-- Optional backfill for existing stage strings -> stageRefId
UPDATE "CrmDeal" d
SET "stageRefId" = s."id"
FROM "crm_ref_pipeline_stages" s
WHERE d."stageRefId" IS NULL
  AND lower(trim(d."stage")) = lower(trim(s."label"));

UPDATE "CrmDeal" d
SET "statusRefId" = s."id"
FROM "crm_ref_statuses" s
WHERE d."statusRefId" IS NULL
  AND lower(trim(d."status")) = lower(trim(s."value"));
