-- Telecom multi-site / bulk import extension for Project module.
-- Safe additive migration for PostgreSQL.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "projectMode" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "isTelecomProject" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "bulkImportRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "purchaseOrder" TEXT,
  ADD COLUMN IF NOT EXISTS "projectCategory" TEXT;

ALTER TABLE "WorkItem"
  ADD COLUMN IF NOT EXISTS "importBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "manualCompletionStatus" TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "financeSyncStatus" TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "financeSyncAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "financeReferenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "financeErrorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "isFinanciallyEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "financialEligibilityReason" TEXT,
  ADD COLUMN IF NOT EXISTS "poUnitPrice" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "ticketNumber" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "poUnitPriceCompleted" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "contractorPayableAmount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "importedFieldsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "operationalManualFieldsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "acceptanceManualFieldsJson" JSONB;

CREATE TABLE IF NOT EXISTS "ProjectImportBatch" (
  "id" TEXT NOT NULL,
  "parentProjectId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "successfulRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "errorSummary" TEXT,
  CONSTRAINT "ProjectImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectImportBatch_parentProjectId_uploadedAt_idx"
  ON "ProjectImportBatch"("parentProjectId", "uploadedAt");
CREATE INDEX IF NOT EXISTS "ProjectImportBatch_status_idx"
  ON "ProjectImportBatch"("status");
CREATE INDEX IF NOT EXISTS "WorkItem_importBatchId_idx"
  ON "WorkItem"("importBatchId");
CREATE INDEX IF NOT EXISTS "WorkItem_financeSyncStatus_idx"
  ON "WorkItem"("financeSyncStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProjectImportBatch_parentProjectId_fkey'
  ) THEN
    ALTER TABLE "ProjectImportBatch"
      ADD CONSTRAINT "ProjectImportBatch_parentProjectId_fkey"
      FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "WorkItem"
  ALTER COLUMN "ticketNumber" TYPE DECIMAL(14,2) USING "ticketNumber"::DECIMAL(14,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkItem_importBatchId_fkey'
  ) THEN
    ALTER TABLE "WorkItem"
      ADD CONSTRAINT "WorkItem_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "ProjectImportBatch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
