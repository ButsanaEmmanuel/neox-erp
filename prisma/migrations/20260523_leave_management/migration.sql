-- HRM-1.5 — Leave management schema.
--
-- Adds three tables (LeavePolicy, LeaveBalance, LeaveRequest) and the
-- three User inverse relations the Prisma client expects. All-or-nothing
-- migration — no backfill needed since there is no pre-existing data.
--
-- Safe to re-run: each CREATE TABLE uses IF NOT EXISTS, each index too,
-- and the FK additions are wrapped in DO $$ pg_constraint guards
-- (matches the convention from 20260523_fk_restrict_cleanup and
-- 20260523_rbac_models_extension).
--
-- Decimal precision matches DRAFT_2_schema_diff:
--   daysPerYear / carryOverMax / request.days  Decimal(5, 2)
--   balance.allocated/used/pending/carryOver   Decimal(6, 2)
--
-- StatusCode lifecycle (LeaveRequest):
--   pending -> approved | rejected | cancelled
-- Application-level transitions live in
-- backend/services/hrm/leave.service.mjs.

-- ============================================================
-- LeavePolicy
-- ============================================================
CREATE TABLE IF NOT EXISTS "LeavePolicy" (
  "id"               TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "leaveType"        TEXT NOT NULL,
  "daysPerYear"      DECIMAL(5, 2) NOT NULL,
  "carryOverMax"     DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "noticeDays"       INTEGER NOT NULL DEFAULT 0,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "isDeleted"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "deletedAt"        TIMESTAMP(3),

  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeavePolicy_isActive_idx"  ON "LeavePolicy"("isActive");
CREATE INDEX IF NOT EXISTS "LeavePolicy_isDeleted_idx" ON "LeavePolicy"("isDeleted");
CREATE INDEX IF NOT EXISTS "LeavePolicy_leaveType_idx" ON "LeavePolicy"("leaveType");

-- ============================================================
-- LeaveBalance
-- ============================================================
CREATE TABLE IF NOT EXISTS "LeaveBalance" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "policyId"   TEXT NOT NULL,
  "year"       INTEGER NOT NULL,
  "allocated"  DECIMAL(6, 2) NOT NULL,
  "used"       DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "pending"    DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "carryOver"  DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveBalance_userId_policyId_year_key"
  ON "LeaveBalance"("userId", "policyId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_userId_idx" ON "LeaveBalance"("userId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_year_idx"   ON "LeaveBalance"("year");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveBalance_userId_fkey') THEN
    ALTER TABLE "LeaveBalance"
      ADD CONSTRAINT "LeaveBalance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveBalance_policyId_fkey') THEN
    ALTER TABLE "LeaveBalance"
      ADD CONSTRAINT "LeaveBalance_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- LeaveRequest
-- ============================================================
CREATE TABLE IF NOT EXISTS "LeaveRequest" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "policyId"    TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "days"        DECIMAL(5, 2) NOT NULL,
  "reason"      TEXT,
  "statusCode"  TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy"  TEXT,
  "reviewedAt"  TIMESTAMP(3),
  "reviewNote"  TEXT,
  "isDeleted"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_statusCode_idx"
  ON "LeaveRequest"("userId", "statusCode");
CREATE INDEX IF NOT EXISTS "LeaveRequest_policyId_idx"
  ON "LeaveRequest"("policyId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_endDate_idx"
  ON "LeaveRequest"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "LeaveRequest_isDeleted_idx"
  ON "LeaveRequest"("isDeleted");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_userId_fkey') THEN
    ALTER TABLE "LeaveRequest"
      ADD CONSTRAINT "LeaveRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_policyId_fkey') THEN
    ALTER TABLE "LeaveRequest"
      ADD CONSTRAINT "LeaveRequest_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequest_reviewedBy_fkey') THEN
    ALTER TABLE "LeaveRequest"
      ADD CONSTRAINT "LeaveRequest_reviewedBy_fkey"
      FOREIGN KEY ("reviewedBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
