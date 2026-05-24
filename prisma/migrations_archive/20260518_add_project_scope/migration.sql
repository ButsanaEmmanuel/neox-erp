-- CreateTable
CREATE TABLE "ProjectScope" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "outOfScope" JSONB NOT NULL DEFAULT '[]',
    "assumptions" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "ProjectScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScope_projectId_key" ON "ProjectScope"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectScope" ADD CONSTRAINT "ProjectScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
