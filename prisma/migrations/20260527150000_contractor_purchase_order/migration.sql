-- Contractor PO grouping: one open PO per (project, contractor),
-- closed automatically when every linked WorkItem has qaStatus
-- 'approved' and a non-null contractor payable.

CREATE TABLE "ContractorPurchaseOrder" (
  "id"            TEXT NOT NULL,
  "displayCode"   TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "contractorId"  TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'open',
  "totalAmount"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "itemCount"     INTEGER NOT NULL DEFAULT 0,
  "approvedCount" INTEGER NOT NULL DEFAULT 0,
  "openedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"      TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorPurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorPurchaseOrder_displayCode_key"
  ON "ContractorPurchaseOrder"("displayCode");
CREATE INDEX "ContractorPurchaseOrder_projectId_idx"
  ON "ContractorPurchaseOrder"("projectId");
CREATE INDEX "ContractorPurchaseOrder_contractorId_idx"
  ON "ContractorPurchaseOrder"("contractorId");
CREATE INDEX "ContractorPurchaseOrder_status_idx"
  ON "ContractorPurchaseOrder"("status");

-- Partial unique: at most one OPEN PO per (project, contractor).
-- Closed POs accumulate freely so the audit trail stays intact.
CREATE UNIQUE INDEX "ContractorPurchaseOrder_open_per_pair"
  ON "ContractorPurchaseOrder"("projectId", "contractorId")
  WHERE status = 'open';

ALTER TABLE "ContractorPurchaseOrder"
  ADD CONSTRAINT "ContractorPurchaseOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractorPurchaseOrder_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkItem"
  ADD COLUMN "contractorId"              TEXT,
  ADD COLUMN "contractorPurchaseOrderId" TEXT;

CREATE INDEX "WorkItem_contractorId_idx" ON "WorkItem"("contractorId");
CREATE INDEX "WorkItem_contractorPurchaseOrderId_idx"
  ON "WorkItem"("contractorPurchaseOrderId");

ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkItem_contractorPurchaseOrderId_fkey"
  FOREIGN KEY ("contractorPurchaseOrderId") REFERENCES "ContractorPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
