-- HRM-1.0 T1 — Tighten FK referential actions on PM tables.
-- Closes PM debt D5: dangerous ON DELETE CASCADE on Project relations.
--
-- Before this migration:
--   ProjectScope.projectId         -> ON DELETE CASCADE
--   Milestone.projectId            -> ON DELETE CASCADE
--   ProjectMember.projectId        -> ON DELETE (default, schema-unspecified)
--   ProjectMember.userId           -> ON DELETE (default, schema-unspecified)
--   WorkItem.projectId             -> ON DELETE (default, schema-unspecified)
--
-- After: all five become ON DELETE RESTRICT so that deleting a Project
-- (or a User who is still a ProjectMember) requires explicit teardown.
-- The expected interaction with the codebase is soft-delete via the
-- isDeleted/deletedAt pattern; hard DELETE on Project is now blocked
-- at the DB level when child rows exist.
--
-- Safe to re-run: each constraint is dropped IF EXISTS before being
-- recreated with the desired action.

-- ProjectScope.projectId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectScope_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectScope" DROP CONSTRAINT "ProjectScope_projectId_fkey";
  END IF;
END $$;

ALTER TABLE "ProjectScope"
  ADD CONSTRAINT "ProjectScope_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Milestone.projectId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Milestone_projectId_fkey'
  ) THEN
    ALTER TABLE "Milestone" DROP CONSTRAINT "Milestone_projectId_fkey";
  END IF;
END $$;

ALTER TABLE "Milestone"
  ADD CONSTRAINT "Milestone_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProjectMember.projectId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";
  END IF;
END $$;

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProjectMember.userId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_userId_fkey'
  ) THEN
    ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";
  END IF;
END $$;

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- WorkItem.projectId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkItem_projectId_fkey'
  ) THEN
    ALTER TABLE "WorkItem" DROP CONSTRAINT "WorkItem_projectId_fkey";
  END IF;
END $$;

ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
