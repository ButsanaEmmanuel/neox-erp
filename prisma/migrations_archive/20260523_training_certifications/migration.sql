-- HRM-2.3 — Training catalogue + per-employee enrollments.
--
-- Defensive: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DO $$ pg_constraint guards on every FK.
--
-- FK referential actions:
--   TrainingEnrollment.userId   ON DELETE RESTRICT  (keep history when
--                                                    a user is soft-deleted)
--   TrainingEnrollment.courseId ON DELETE RESTRICT  (refuse to drop a
--                                                    course that still
--                                                    has enrollments)

-- ============================================================
-- TrainingCourse
-- ============================================================
CREATE TABLE IF NOT EXISTS "TrainingCourse" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "provider"       TEXT,
  "category"       TEXT,
  "durationHours"  INTEGER,
  "isInternal"     BOOLEAN NOT NULL DEFAULT true,
  "isMandatory"    BOOLEAN NOT NULL DEFAULT false,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "isDeleted"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "deletedAt"      TIMESTAMP(3),
  CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrainingCourse_isActive_idx"    ON "TrainingCourse"("isActive");
CREATE INDEX IF NOT EXISTS "TrainingCourse_isDeleted_idx"   ON "TrainingCourse"("isDeleted");
CREATE INDEX IF NOT EXISTS "TrainingCourse_isMandatory_idx" ON "TrainingCourse"("isMandatory");

-- ============================================================
-- TrainingEnrollment
-- ============================================================
CREATE TABLE IF NOT EXISTS "TrainingEnrollment" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "courseId"     TEXT NOT NULL,
  "statusCode"   TEXT NOT NULL DEFAULT 'enrolled',  -- enrolled | in_progress | completed | cancelled
  "enrolledAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "cancelledAt"  TIMESTAMP(3),
  "dueDate"      TIMESTAMP(3),
  "score"        DECIMAL(5, 2),
  "certificate"  TEXT,
  "notes"        TEXT,
  "isDeleted"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);
-- @@unique([userId, courseId]) — enforced at the DB level so a double
-- POST never gets through. The service still does an upfront lookup so
-- we can return a structured 409 instead of a Prisma P2002.
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingEnrollment_userId_courseId_key"
  ON "TrainingEnrollment"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "TrainingEnrollment_userId_idx"     ON "TrainingEnrollment"("userId");
CREATE INDEX IF NOT EXISTS "TrainingEnrollment_courseId_idx"   ON "TrainingEnrollment"("courseId");
CREATE INDEX IF NOT EXISTS "TrainingEnrollment_statusCode_idx" ON "TrainingEnrollment"("statusCode");
CREATE INDEX IF NOT EXISTS "TrainingEnrollment_isDeleted_idx"  ON "TrainingEnrollment"("isDeleted");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingEnrollment_userId_fkey') THEN
    ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingEnrollment_courseId_fkey') THEN
    ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
