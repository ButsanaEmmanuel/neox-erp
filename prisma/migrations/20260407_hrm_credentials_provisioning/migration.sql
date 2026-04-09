-- CreateTable
CREATE TABLE "HrmCredentialProvisioning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentProfileId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "temporaryPassword" TEXT NOT NULL,
    "statusCode" TEXT NOT NULL DEFAULT 'generated',
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrmCredentialProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_userId_idx" ON "HrmCredentialProvisioning"("userId");

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_employmentProfileId_idx" ON "HrmCredentialProvisioning"("employmentProfileId");

-- CreateIndex
CREATE INDEX "HrmCredentialProvisioning_statusCode_idx" ON "HrmCredentialProvisioning"("statusCode");

-- AddForeignKey
ALTER TABLE "HrmCredentialProvisioning" ADD CONSTRAINT "HrmCredentialProvisioning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrmCredentialProvisioning" ADD CONSTRAINT "HrmCredentialProvisioning_employmentProfileId_fkey" FOREIGN KEY ("employmentProfileId") REFERENCES "HrmEmploymentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;