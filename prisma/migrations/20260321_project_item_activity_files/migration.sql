-- Persistent project item details workflow storage.

CREATE TABLE IF NOT EXISTS "ProjectItemState" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "poUnitPrice" DECIMAL(14,2),
  "ticketNumber" DECIMAL(14,2),
  "qaStatus" TEXT DEFAULT 'pending',
  "acceptanceStatus" TEXT DEFAULT 'pending',
  "operationalManualFieldsJson" JSONB,
  "acceptanceManualFieldsJson" JSONB,
  "poUnitPriceCompleted" DECIMAL(14,2),
  "contractorPayableAmount" DECIMAL(14,2),
  "isFinanciallyEligible" BOOLEAN NOT NULL DEFAULT FALSE,
  "financialEligibilityReason" TEXT,
  "financeSyncStatus" TEXT DEFAULT 'blocked',
  "financeSyncAt" TIMESTAMP(3),
  "financeReferenceId" TEXT,
  "financeErrorMessage" TEXT,
  "updatedByUserId" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectItemState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectItemState_projectId_workItemId_key"
  ON "ProjectItemState"("projectId","workItemId");
CREATE INDEX IF NOT EXISTS "ProjectItemState_projectId_workItemId_idx"
  ON "ProjectItemState"("projectId","workItemId");

CREATE TABLE IF NOT EXISTS "ProjectItemActivity" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL DEFAULT 'project_item',
  "entityId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorDisplayName" TEXT,
  "actionType" TEXT NOT NULL,
  "fieldName" TEXT,
  "oldValueJson" JSONB,
  "newValueJson" JSONB,
  "message" TEXT NOT NULL,
  "eventSource" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectItemActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectItemActivity_projectId_workItemId_createdAt_idx"
  ON "ProjectItemActivity"("projectId","workItemId","createdAt");
CREATE INDEX IF NOT EXISTS "ProjectItemActivity_entityType_entityId_idx"
  ON "ProjectItemActivity"("entityType","entityId");

CREATE TABLE IF NOT EXISTS "ProjectItemFile" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "storedFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "uploadedByName" TEXT,
  "category" TEXT DEFAULT 'other',
  "visibility" TEXT DEFAULT 'private',
  "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProjectItemFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectItemFile_projectId_workItemId_createdAt_idx"
  ON "ProjectItemFile"("projectId","workItemId","createdAt");
CREATE INDEX IF NOT EXISTS "ProjectItemFile_deletedAt_idx"
  ON "ProjectItemFile"("deletedAt");

ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "importedFieldsJson" JSONB;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "planningAuditDate" TIMESTAMP(3);
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "planningAuditWeek" INTEGER;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "forecastDate" TIMESTAMP(3);
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "forecastWeek" INTEGER;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "actualAuditDate" TIMESTAMP(3);
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "actualAuditWeek" INTEGER;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "startVarianceDays" INTEGER;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "scheduleStatus" TEXT;
ALTER TABLE "ProjectItemState" ADD COLUMN IF NOT EXISTS "isDelayed" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "ProjectItemState"
  ALTER COLUMN "ticketNumber" TYPE DECIMAL(14,2) USING "ticketNumber"::DECIMAL(14,2);
