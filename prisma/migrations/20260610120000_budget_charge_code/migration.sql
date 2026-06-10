-- Budget operational — charge code + department→project hierarchy.
-- Defensive pattern per NEOX_FINANCE_PLAN §10.4 : ADD COLUMN IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, pg_constraint guard on the self-referential FK.
-- Re-runnable: every statement is idempotent (DH6 — use migrate deploy).

-- Budget: charge code (imputation key, generated on create) + parent link (project budget → department budget).
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "chargeCode" TEXT;
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "parentBudgetId" TEXT;

-- chargeCode is globally unique. The unique index tolerates multiple NULLs
-- (legacy/unscoped budgets), so back-compat is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_chargeCode_key" ON "Budget"("chargeCode");
CREATE INDEX IF NOT EXISTS "Budget_parentBudgetId_idx" ON "Budget"("parentBudgetId");

-- FinanceEntry: explicit charge-code imputation. NULL = legacy/inferred attribution.
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "chargeCode" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceEntry_chargeCode_idx" ON "FinanceEntry"("chargeCode");

-- Self-referential FK: deleting a parent department budget detaches its children (SET NULL), never cascades.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Budget_parentBudgetId_fkey') THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_parentBudgetId_fkey"
            FOREIGN KEY ("parentBudgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
