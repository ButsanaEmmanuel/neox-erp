-- HRM-2.1 — Recruitment: JobPosting table + RecruitmentCandidate extensions.
--
-- Defensive: CREATE TABLE IF NOT EXISTS, ALTER ADD COLUMN IF NOT EXISTS,
-- DO $$ pg_constraint guards on every FK. Safe to re-run.
--
-- Plan delta: the plan listed a separate `stage` column on
-- RecruitmentCandidate, but the existing `statusCode` column already
-- plays that role (recruitmentOnboarding.service.mjs branches on it).
-- We extend instead of duplicating — `statusCode` stays the single
-- source of truth for the lifecycle (sourced / screening / interview
-- / offer / hired / onboarding / rejected).

-- ============================================================
-- JobPosting
-- ============================================================
CREATE TABLE IF NOT EXISTS "JobPosting" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "departmentId"    TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "requirements"    TEXT,
  "statusCode"      TEXT NOT NULL DEFAULT 'draft',
  "closingDate"     TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "isDeleted"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "deletedAt"       TIMESTAMP(3),

  CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobPosting_statusCode_idx"   ON "JobPosting"("statusCode");
CREATE INDEX IF NOT EXISTS "JobPosting_departmentId_idx" ON "JobPosting"("departmentId");
CREATE INDEX IF NOT EXISTS "JobPosting_isDeleted_idx"    ON "JobPosting"("isDeleted");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobPosting_departmentId_fkey') THEN
    ALTER TABLE "JobPosting"
      ADD CONSTRAINT "JobPosting_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobPosting_createdByUserId_fkey') THEN
    ALTER TABLE "JobPosting"
      ADD CONSTRAINT "JobPosting_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- RecruitmentCandidate — additive columns + FK to JobPosting
-- ============================================================
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "jobPostingId"    TEXT;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "interviewDate"   TIMESTAMP(3);
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "offerDate"       TIMESTAMP(3);
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "offerAmount"     DECIMAL(14, 2);
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "offerCurrency"   TEXT;
ALTER TABLE "RecruitmentCandidate" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "RecruitmentCandidate_jobPostingId_idx"
  ON "RecruitmentCandidate"("jobPostingId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecruitmentCandidate_jobPostingId_fkey') THEN
    ALTER TABLE "RecruitmentCandidate"
      ADD CONSTRAINT "RecruitmentCandidate_jobPostingId_fkey"
      FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
