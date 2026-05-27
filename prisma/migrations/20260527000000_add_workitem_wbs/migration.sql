-- WBS bulk-import: weight % per task/sub-task, forecast & actual start
-- dates for schedule variance tracking. All nullable so existing rows
-- (telecom + legacy) keep working untouched.
ALTER TABLE "WorkItem"
  ADD COLUMN "weightPercent"       DECIMAL(5,2),
  ADD COLUMN "forecastDate"        TIMESTAMP(3),
  ADD COLUMN "actualStartDate"     TIMESTAMP(3),
  ADD COLUMN "scheduleStatus"      TEXT,
  ADD COLUMN "startVarianceDays"   INTEGER;

CREATE INDEX "WorkItem_scheduleStatus_idx" ON "WorkItem"("scheduleStatus");
