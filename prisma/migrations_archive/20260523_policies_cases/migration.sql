-- HRM-2.4 — HR policies + acknowledgements + cases (incidents, grievances).
--
-- Defensive: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DO $$ pg_constraint guards on every FK.
--
-- FK referential actions:
--   HrmPolicy.createdByUserId        ON DELETE RESTRICT  (keep authorship history)
--   PolicyAcknowledgement.policyId   ON DELETE CASCADE   (ack is meaningless without the policy)
--   PolicyAcknowledgement.userId     ON DELETE RESTRICT  (keep audit trail)
--   HrmCase.reportedByUserId         ON DELETE RESTRICT
--   HrmCase.assignedToUserId         ON DELETE SET NULL  (case survives an assignee leaving)

-- ============================================================
-- HrmPolicy
-- ============================================================
CREATE TABLE IF NOT EXISTS "HrmPolicy" (
  "id"                TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "category"          TEXT NOT NULL DEFAULT 'other',  -- conduct | safety | leave | it | other
  "content"           TEXT NOT NULL,
  "version"           TEXT NOT NULL DEFAULT '1.0',
  "statusCode"        TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  "publishedAt"       TIMESTAMP(3),
  "archivedAt"        TIMESTAMP(3),
  "createdByUserId"   TEXT NOT NULL,
  "isDeleted"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  "deletedAt"         TIMESTAMP(3),
  CONSTRAINT "HrmPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrmPolicy_statusCode_idx"      ON "HrmPolicy"("statusCode");
CREATE INDEX IF NOT EXISTS "HrmPolicy_category_idx"        ON "HrmPolicy"("category");
CREATE INDEX IF NOT EXISTS "HrmPolicy_isDeleted_idx"       ON "HrmPolicy"("isDeleted");
CREATE INDEX IF NOT EXISTS "HrmPolicy_createdByUserId_idx" ON "HrmPolicy"("createdByUserId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrmPolicy_createdByUserId_fkey') THEN
    ALTER TABLE "HrmPolicy" ADD CONSTRAINT "HrmPolicy_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- PolicyAcknowledgement
-- ============================================================
CREATE TABLE IF NOT EXISTS "PolicyAcknowledgement" (
  "id"        TEXT NOT NULL,
  "policyId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "signedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"      TEXT,
  CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);
-- @@unique([policyId, userId]) — each user can ack a given policy
-- at most once. Service still does an upfront lookup so we return a
-- structured 409 ALREADY_ACKNOWLEDGED instead of a Prisma P2002.
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyAcknowledgement_policyId_userId_key"
  ON "PolicyAcknowledgement"("policyId", "userId");
CREATE INDEX IF NOT EXISTS "PolicyAcknowledgement_userId_idx"   ON "PolicyAcknowledgement"("userId");
CREATE INDEX IF NOT EXISTS "PolicyAcknowledgement_policyId_idx" ON "PolicyAcknowledgement"("policyId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PolicyAcknowledgement_policyId_fkey') THEN
    ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "HrmPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PolicyAcknowledgement_userId_fkey') THEN
    ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- HrmCase
-- ============================================================
CREATE TABLE IF NOT EXISTS "HrmCase" (
  "id"                  TEXT NOT NULL,
  "caseType"            TEXT NOT NULL DEFAULT 'inquiry',   -- grievance | incident | disciplinary | inquiry
  "title"               TEXT NOT NULL,
  "description"         TEXT NOT NULL,
  "reportedByUserId"    TEXT NOT NULL,
  "assignedToUserId"    TEXT,
  "statusCode"          TEXT NOT NULL DEFAULT 'open',      -- open | investigating | resolved | escalated | closed
  "priority"            TEXT NOT NULL DEFAULT 'medium',    -- low | medium | high
  "escalatedAt"         TIMESTAMP(3),
  "resolvedAt"          TIMESTAMP(3),
  "closedAt"            TIMESTAMP(3),
  "resolution"          TEXT,
  "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  "deletedAt"           TIMESTAMP(3),
  CONSTRAINT "HrmCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrmCase_statusCode_idx"       ON "HrmCase"("statusCode");
CREATE INDEX IF NOT EXISTS "HrmCase_priority_idx"         ON "HrmCase"("priority");
CREATE INDEX IF NOT EXISTS "HrmCase_caseType_idx"         ON "HrmCase"("caseType");
CREATE INDEX IF NOT EXISTS "HrmCase_reportedByUserId_idx" ON "HrmCase"("reportedByUserId");
CREATE INDEX IF NOT EXISTS "HrmCase_assignedToUserId_idx" ON "HrmCase"("assignedToUserId");
CREATE INDEX IF NOT EXISTS "HrmCase_isDeleted_idx"        ON "HrmCase"("isDeleted");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrmCase_reportedByUserId_fkey') THEN
    ALTER TABLE "HrmCase" ADD CONSTRAINT "HrmCase_reportedByUserId_fkey"
      FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrmCase_assignedToUserId_fkey') THEN
    ALTER TABLE "HrmCase" ADD CONSTRAINT "HrmCase_assignedToUserId_fkey"
      FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- HrmCaseEvent — append-only status / note history for a case.
--
-- Decided to add this beyond DRAFT_2 because the HRM-2.4 exit
-- criterion "Historique de statuts visible sur le détail d'un cas"
-- needs it, and shoehorning a JSON column into HrmCase would prevent
-- querying who-did-what-when from SQL.
-- ============================================================
CREATE TABLE IF NOT EXISTS "HrmCaseEvent" (
  "id"            TEXT NOT NULL,
  "caseId"        TEXT NOT NULL,
  "eventType"     TEXT NOT NULL,         -- status_change | note | assignment
  "fromStatus"    TEXT,
  "toStatus"      TEXT,
  "note"          TEXT,
  "authorUserId"  TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HrmCaseEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrmCaseEvent_caseId_idx"       ON "HrmCaseEvent"("caseId");
CREATE INDEX IF NOT EXISTS "HrmCaseEvent_authorUserId_idx" ON "HrmCaseEvent"("authorUserId");
CREATE INDEX IF NOT EXISTS "HrmCaseEvent_createdAt_idx"    ON "HrmCaseEvent"("createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrmCaseEvent_caseId_fkey') THEN
    ALTER TABLE "HrmCaseEvent" ADD CONSTRAINT "HrmCaseEvent_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "HrmCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HrmCaseEvent_authorUserId_fkey') THEN
    ALTER TABLE "HrmCaseEvent" ADD CONSTRAINT "HrmCaseEvent_authorUserId_fkey"
      FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
