CREATE TABLE "HrmEmploymentProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "employmentType" TEXT NOT NULL DEFAULT 'employee',
  "statusCode" TEXT NOT NULL DEFAULT 'active',
  "roleTitle" TEXT NOT NULL,
  "managerUserId" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "workLocation" TEXT,
  "authorityLevel" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
  "creationSource" TEXT NOT NULL DEFAULT 'MANUAL',
  "requiresAdminReview" BOOLEAN NOT NULL DEFAULT false,
  "reviewNotesJson" JSONB,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HrmEmploymentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrmEmploymentProfile_userId_key" ON "HrmEmploymentProfile"("userId");
CREATE UNIQUE INDEX "HrmEmploymentProfile_employeeCode_key" ON "HrmEmploymentProfile"("employeeCode");
CREATE INDEX "HrmEmploymentProfile_statusCode_idx" ON "HrmEmploymentProfile"("statusCode");
CREATE INDEX "HrmEmploymentProfile_employmentType_idx" ON "HrmEmploymentProfile"("employmentType");
CREATE INDEX "HrmEmploymentProfile_managerUserId_idx" ON "HrmEmploymentProfile"("managerUserId");
CREATE INDEX "HrmEmploymentProfile_isDeleted_idx" ON "HrmEmploymentProfile"("isDeleted");

ALTER TABLE "HrmEmploymentProfile"
  ADD CONSTRAINT "HrmEmploymentProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HrmEmploymentProfile"
  ADD CONSTRAINT "HrmEmploymentProfile_managerUserId_fkey"
  FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
