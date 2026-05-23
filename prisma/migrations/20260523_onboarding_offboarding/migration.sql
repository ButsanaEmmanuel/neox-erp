-- HRM-2.2 — Onboarding / Offboarding templates + checklists (8 tables).
--
-- Defensive: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DO $$ pg_constraint guards on every FK.
--
-- FK referential actions:
--   <Template>.departmentId          ON DELETE SET NULL  (templates outlive depts)
--   <TemplateTask>.templateId        ON DELETE CASCADE   (tasks belong to template)
--   <ChecklistTask>.checklistId      ON DELETE CASCADE   (tasks belong to checklist)
--   <Checklist>.templateId           ON DELETE RESTRICT  (keep history)
--   <Checklist>.userId               ON DELETE RESTRICT
--   <ChecklistTask>.templateTaskId   ON DELETE RESTRICT
--   <ChecklistTask>.completedByUserId ON DELETE SET NULL

-- ============================================================
-- OnboardingTemplate
-- ============================================================
CREATE TABLE IF NOT EXISTS "OnboardingTemplate" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "departmentId" TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "isDeleted"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OnboardingTemplate_isActive_idx"     ON "OnboardingTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "OnboardingTemplate_isDeleted_idx"    ON "OnboardingTemplate"("isDeleted");
CREATE INDEX IF NOT EXISTS "OnboardingTemplate_departmentId_idx" ON "OnboardingTemplate"("departmentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTemplate_departmentId_fkey') THEN
    ALTER TABLE "OnboardingTemplate" ADD CONSTRAINT "OnboardingTemplate_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OnboardingTemplateTask
-- ============================================================
CREATE TABLE IF NOT EXISTS "OnboardingTemplateTask" (
  "id"            TEXT NOT NULL,
  "templateId"    TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
  "assignedRole"  TEXT,
  "isRequired"    BOOLEAN NOT NULL DEFAULT true,
  "order"         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OnboardingTemplateTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OnboardingTemplateTask_templateId_idx" ON "OnboardingTemplateTask"("templateId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTemplateTask_templateId_fkey') THEN
    ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OnboardingChecklist
-- ============================================================
CREATE TABLE IF NOT EXISTS "OnboardingChecklist" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "statusCode"  TEXT NOT NULL DEFAULT 'in_progress',
  "completedAt" TIMESTAMP(3),
  "isDeleted"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OnboardingChecklist_userId_idx"     ON "OnboardingChecklist"("userId");
CREATE INDEX IF NOT EXISTS "OnboardingChecklist_statusCode_idx" ON "OnboardingChecklist"("statusCode");
CREATE INDEX IF NOT EXISTS "OnboardingChecklist_isDeleted_idx"  ON "OnboardingChecklist"("isDeleted");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingChecklist_userId_fkey') THEN
    ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingChecklist_templateId_fkey') THEN
    ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OnboardingChecklistTask
-- ============================================================
CREATE TABLE IF NOT EXISTS "OnboardingChecklistTask" (
  "id"                TEXT NOT NULL,
  "checklistId"       TEXT NOT NULL,
  "templateTaskId"    TEXT NOT NULL,
  "statusCode"        TEXT NOT NULL DEFAULT 'pending',
  "completedByUserId" TEXT,
  "completedAt"       TIMESTAMP(3),
  "note"              TEXT,
  CONSTRAINT "OnboardingChecklistTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OnboardingChecklistTask_checklistId_idx" ON "OnboardingChecklistTask"("checklistId");
CREATE INDEX IF NOT EXISTS "OnboardingChecklistTask_statusCode_idx" ON "OnboardingChecklistTask"("statusCode");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingChecklistTask_checklistId_fkey') THEN
    ALTER TABLE "OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_checklistId_fkey"
      FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingChecklistTask_templateTaskId_fkey') THEN
    ALTER TABLE "OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_templateTaskId_fkey"
      FOREIGN KEY ("templateTaskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingChecklistTask_completedByUserId_fkey') THEN
    ALTER TABLE "OnboardingChecklistTask" ADD CONSTRAINT "OnboardingChecklistTask_completedByUserId_fkey"
      FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OffboardingTemplate
-- ============================================================
CREATE TABLE IF NOT EXISTS "OffboardingTemplate" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "departmentId" TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "isDeleted"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "OffboardingTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OffboardingTemplate_isActive_idx"     ON "OffboardingTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "OffboardingTemplate_isDeleted_idx"    ON "OffboardingTemplate"("isDeleted");
CREATE INDEX IF NOT EXISTS "OffboardingTemplate_departmentId_idx" ON "OffboardingTemplate"("departmentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingTemplate_departmentId_fkey') THEN
    ALTER TABLE "OffboardingTemplate" ADD CONSTRAINT "OffboardingTemplate_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OffboardingTemplateTask
-- ============================================================
CREATE TABLE IF NOT EXISTS "OffboardingTemplateTask" (
  "id"            TEXT NOT NULL,
  "templateId"    TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
  "assignedRole"  TEXT,
  "isRequired"    BOOLEAN NOT NULL DEFAULT true,
  "order"         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OffboardingTemplateTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OffboardingTemplateTask_templateId_idx" ON "OffboardingTemplateTask"("templateId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingTemplateTask_templateId_fkey') THEN
    ALTER TABLE "OffboardingTemplateTask" ADD CONSTRAINT "OffboardingTemplateTask_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "OffboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OffboardingChecklist
-- ============================================================
CREATE TABLE IF NOT EXISTS "OffboardingChecklist" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "templateId"  TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "statusCode"  TEXT NOT NULL DEFAULT 'in_progress',
  "completedAt" TIMESTAMP(3),
  "isDeleted"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "OffboardingChecklist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OffboardingChecklist_userId_idx"     ON "OffboardingChecklist"("userId");
CREATE INDEX IF NOT EXISTS "OffboardingChecklist_statusCode_idx" ON "OffboardingChecklist"("statusCode");
CREATE INDEX IF NOT EXISTS "OffboardingChecklist_isDeleted_idx"  ON "OffboardingChecklist"("isDeleted");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingChecklist_userId_fkey') THEN
    ALTER TABLE "OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingChecklist_templateId_fkey') THEN
    ALTER TABLE "OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "OffboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- OffboardingChecklistTask
-- ============================================================
CREATE TABLE IF NOT EXISTS "OffboardingChecklistTask" (
  "id"                TEXT NOT NULL,
  "checklistId"       TEXT NOT NULL,
  "templateTaskId"    TEXT NOT NULL,
  "statusCode"        TEXT NOT NULL DEFAULT 'pending',
  "completedByUserId" TEXT,
  "completedAt"       TIMESTAMP(3),
  "note"              TEXT,
  CONSTRAINT "OffboardingChecklistTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OffboardingChecklistTask_checklistId_idx" ON "OffboardingChecklistTask"("checklistId");
CREATE INDEX IF NOT EXISTS "OffboardingChecklistTask_statusCode_idx" ON "OffboardingChecklistTask"("statusCode");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingChecklistTask_checklistId_fkey') THEN
    ALTER TABLE "OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_checklistId_fkey"
      FOREIGN KEY ("checklistId") REFERENCES "OffboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingChecklistTask_templateTaskId_fkey') THEN
    ALTER TABLE "OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_templateTaskId_fkey"
      FOREIGN KEY ("templateTaskId") REFERENCES "OffboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OffboardingChecklistTask_completedByUserId_fkey') THEN
    ALTER TABLE "OffboardingChecklistTask" ADD CONSTRAINT "OffboardingChecklistTask_completedByUserId_fkey"
      FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
