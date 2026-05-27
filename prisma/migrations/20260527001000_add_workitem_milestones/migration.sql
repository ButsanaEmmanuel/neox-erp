-- Delivery milestone timestamps on WorkItem:
--   completedDate — when the work was finished / submitted to the client
--   signedDate    — when the client (or PM) signed off (final closure)
-- acceptanceDate already exists from the telecom schema; we keep it as
-- the middle stage (client accepted but not yet signed).
ALTER TABLE "WorkItem"
  ADD COLUMN "completedDate" TIMESTAMP(3),
  ADD COLUMN "signedDate"    TIMESTAMP(3);
