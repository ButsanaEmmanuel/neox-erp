-- HRM-2.5 — TimesheetEntry approval workflow fields.
--
-- All additions are nullable so existing rows (which were created
-- before this sprint, default statusCode = "submitted") stay valid.
-- New rows created from the API will default to "draft" via the
-- service layer; the column default stays "submitted" to avoid
-- changing the runtime contract for any external writer that might
-- already exist.
--
-- Defensive: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DO $$ pg_constraint guard for the new approver FK.

ALTER TABLE "TimesheetEntry"
  ADD COLUMN IF NOT EXISTS "projectId"         TEXT,
  ADD COLUMN IF NOT EXISTS "weekStartDate"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId"  TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewerComment"   TEXT;

CREATE INDEX IF NOT EXISTS "TimesheetEntry_statusCode_idx"       ON "TimesheetEntry"("statusCode");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_weekStartDate_idx"    ON "TimesheetEntry"("weekStartDate");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_approvedByUserId_idx" ON "TimesheetEntry"("approvedByUserId");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_projectId_idx"        ON "TimesheetEntry"("projectId");

-- Approver FK. ON DELETE SET NULL — keep the timesheet row when the
-- approver leaves (we lose attribution, never the hours).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimesheetEntry_approvedByUserId_fkey') THEN
    ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill weekStartDate for existing rows so a service query that
-- assumes the column is populated still works on legacy data.
-- ISO week starts Monday. We compute it from workDate.
UPDATE "TimesheetEntry"
SET "weekStartDate" = date_trunc('week', "workDate")
WHERE "weekStartDate" IS NULL;
