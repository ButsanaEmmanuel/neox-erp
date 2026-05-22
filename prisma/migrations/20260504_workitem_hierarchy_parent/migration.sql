ALTER TABLE "WorkItem"
ADD COLUMN "parentWorkItemId" TEXT;

CREATE INDEX "WorkItem_parentWorkItemId_idx" ON "WorkItem"("parentWorkItemId");

ALTER TABLE "WorkItem"
ADD CONSTRAINT "WorkItem_parentWorkItemId_fkey"
FOREIGN KEY ("parentWorkItemId") REFERENCES "WorkItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
