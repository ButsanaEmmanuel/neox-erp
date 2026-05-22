-- Add CHECK constraint on Milestone.completionPct (0-100 inclusive).
-- Resolves D12. Backend route already enforces this range at API boundary
-- (services/pm/milestones.service.mjs:62-69) — this adds the DB-level
-- guarantee for any path that bypasses the API (direct SQL, scripts, future
-- raw queries).

ALTER TABLE "Milestone"
  ADD CONSTRAINT "Milestone_completionPct_range_check"
  CHECK ("completionPct" >= 0 AND "completionPct" <= 100);
