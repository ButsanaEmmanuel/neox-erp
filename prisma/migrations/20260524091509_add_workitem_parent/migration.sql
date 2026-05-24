-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
