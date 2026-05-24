-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Milestone_parentId_idx" ON "Milestone"("parentId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
