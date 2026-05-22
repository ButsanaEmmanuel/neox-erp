ALTER TABLE "WorkItem"
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "plannedStartDate" TIMESTAMP(3),
ADD COLUMN "plannedEndDate" TIMESTAMP(3);

CREATE INDEX "WorkItem_assigneeId_idx" ON "WorkItem"("assigneeId");

ALTER TABLE "WorkItem"
ADD CONSTRAINT "WorkItem_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
