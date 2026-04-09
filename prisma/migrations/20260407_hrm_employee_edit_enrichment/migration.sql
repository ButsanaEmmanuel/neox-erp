ALTER TABLE "HrmEmploymentProfile"
  ADD COLUMN IF NOT EXISTS "contractType" TEXT NOT NULL DEFAULT 'CDI',
  ADD COLUMN IF NOT EXISTS "contractStatus" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "probationEndDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terminationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "compensationAmount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "compensationCurrency" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "compensationFrequency" TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "compensationType" TEXT DEFAULT 'base_salary',
  ADD COLUMN IF NOT EXISTS "compensationEffectiveDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "compensationNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "systemAccessStatus" TEXT NOT NULL DEFAULT 'pending_activation';
CREATE INDEX IF NOT EXISTS "HrmEmploymentProfile_contractType_idx"
  ON "HrmEmploymentProfile"("contractType");

CREATE INDEX IF NOT EXISTS "HrmEmploymentProfile_systemAccessStatus_idx"
  ON "HrmEmploymentProfile"("systemAccessStatus");
