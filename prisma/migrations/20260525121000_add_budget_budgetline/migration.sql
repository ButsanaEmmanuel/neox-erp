-- Sprint Finance-4 (F4.1) — Budget + BudgetLine models.
-- Defensive pattern per NEOX_FINANCE_PLAN §10.4 : CREATE … IF NOT EXISTS + pg_constraint guards.

-- CreateTable Budget
CREATE TABLE IF NOT EXISTS "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT,
    "projectId" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable BudgetLine
CREATE TABLE IF NOT EXISTS "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "plannedAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Budget_status_idx" ON "Budget"("status");
CREATE INDEX IF NOT EXISTS "Budget_periodStart_periodEnd_idx" ON "Budget"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "Budget_departmentId_idx" ON "Budget"("departmentId");
CREATE INDEX IF NOT EXISTS "Budget_projectId_idx" ON "Budget"("projectId");
CREATE INDEX IF NOT EXISTS "Budget_isDeleted_idx" ON "Budget"("isDeleted");
CREATE INDEX IF NOT EXISTS "BudgetLine_categoryId_idx" ON "BudgetLine"("categoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "BudgetLine_budgetId_categoryId_key" ON "BudgetLine"("budgetId", "categoryId");

-- AddForeignKey (idempotent via pg_constraint guard)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Budget_departmentId_fkey') THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_departmentId_fkey"
            FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Budget_projectId_fkey') THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetLine_budgetId_fkey') THEN
        ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey"
            FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetLine_categoryId_fkey') THEN
        ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_fkey"
            FOREIGN KEY ("categoryId") REFERENCES "FinanceCategorySetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
