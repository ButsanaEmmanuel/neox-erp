-- Human-friendly displayCode for FinanceEntry (fm<TAG>NNNNNN).
-- Backfills existing rows in insertion order so old entries keep a
-- stable code from now on. New rows get one assigned by the service
-- on upsert (financeEntries.service.mjs).
ALTER TABLE "FinanceEntry" ADD COLUMN "displayCode" TEXT;

-- Backfill: number existing rows per "entryType" in createdAt order.
WITH ranked AS (
  SELECT
    id,
    CASE "entryType"
      WHEN 'receivable' THEN 'REC'
      WHEN 'payable'    THEN 'PAY'
      WHEN 'salary'     THEN 'SAL'
      WHEN 'reimbursement' THEN 'RMB'
      WHEN 'invoice'    THEN 'INV'
      WHEN 'bill'       THEN 'BIL'
      ELSE 'GEN'
    END AS tag,
    ROW_NUMBER() OVER (
      PARTITION BY "entryType"
      ORDER BY "createdAt" ASC, id ASC
    ) AS n
  FROM "FinanceEntry"
)
UPDATE "FinanceEntry" fe
SET "displayCode" = 'fm' || r.tag || LPAD(r.n::text, 6, '0')
FROM ranked r
WHERE fe.id = r.id;

CREATE UNIQUE INDEX "FinanceEntry_displayCode_key" ON "FinanceEntry"("displayCode");
