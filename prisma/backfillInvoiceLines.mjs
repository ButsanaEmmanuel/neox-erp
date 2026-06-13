// One-time backfill (Sprint AR-1): give every legacy 1:1 CustomerInvoice a
// CustomerInvoiceLine + projectId + recomputed totals. Idempotent.
// Run: node --env-file=.env prisma/backfillInvoiceLines.mjs
import { PrismaClient } from '@prisma/client';
import { backfillInvoiceLines } from '../backend/services/finance/financeEntries.service.mjs';

const prisma = new PrismaClient();
try {
  const result = await backfillInvoiceLines(prisma);
  console.log('Backfill complete:', JSON.stringify(result));
} catch (err) {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
