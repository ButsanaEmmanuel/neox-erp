-- AR invoicing (Sprint AR-1): group multiple receivables into one invoice via
-- CustomerInvoiceLine; deprecate the 1:1 receivableId; track invoice-level
-- payment totals and receipt→invoice link.

-- CustomerInvoice: legacy receivableId becomes nullable; add project + payment rollup columns
ALTER TABLE "CustomerInvoice" ALTER COLUMN "receivableId" DROP NOT NULL;
ALTER TABLE "CustomerInvoice" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN "collectedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "CustomerInvoice" ADD COLUMN "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- ReceiptCollection: optional link to the invoice a receipt was recorded against
ALTER TABLE "ReceiptCollection" ADD COLUMN "invoiceId" TEXT;

-- CustomerInvoiceLine: one line per receivable on an invoice
CREATE TABLE "CustomerInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerInvoiceLine_receivableId_key" ON "CustomerInvoiceLine"("receivableId");
CREATE INDEX "CustomerInvoiceLine_invoiceId_idx" ON "CustomerInvoiceLine"("invoiceId");
CREATE INDEX "CustomerInvoice_projectId_status_idx" ON "CustomerInvoice"("projectId", "status");
CREATE INDEX "ReceiptCollection_invoiceId_idx" ON "ReceiptCollection"("invoiceId");

ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptCollection" ADD CONSTRAINT "ReceiptCollection_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
