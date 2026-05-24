ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "jobTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "supervisorId" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "notifyCrm" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyProjects" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyFinance" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "quickStatus" TEXT NOT NULL DEFAULT 'online';

CREATE INDEX IF NOT EXISTS "User_supervisorId_idx" ON "User"("supervisorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_supervisorId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_supervisorId_fkey"
      FOREIGN KEY ("supervisorId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
