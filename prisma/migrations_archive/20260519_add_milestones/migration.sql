-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "ownerId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_ownerId_idx" ON "Milestone"("ownerId");

-- CreateIndex
CREATE INDEX "Milestone_isDeleted_idx" ON "Milestone"("isDeleted");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MilestoneDependency" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDependency_milestoneId_dependsOnId_key" ON "MilestoneDependency"("milestoneId", "dependsOnId");

-- CreateIndex
CREATE INDEX "MilestoneDependency_milestoneId_idx" ON "MilestoneDependency"("milestoneId");

-- CreateIndex
CREATE INDEX "MilestoneDependency_dependsOnId_idx" ON "MilestoneDependency"("dependsOnId");

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDependency" ADD CONSTRAINT "MilestoneDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
