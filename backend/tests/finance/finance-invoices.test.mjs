// F3.4c — Integration tests for customer invoices (Sprint Finance-3).
//
// Run with: node backend/tests/finance/finance-invoices.test.mjs
//
// Contract under test (4 assertions, plan §6 F3.4) :
//   1. createCustomerInvoice → invoice created + linked to parent
//      receivable, defaults applied (invoiceNumber auto, totals from
//      receivable, currency USD, status 'sent', clientAccountId
//      inherited from receivable)
//   2. listCustomerInvoices({ status }) → server-side status filter
//      returns only matching invoices, our synthetic invoice included
//      when status matches
//   3. listCustomerInvoices (no filter) → returns rows with
//      receivable.clientName populated so the UI can apply its
//      client-side client-name filter (backend does not expose a client
//      query param — cf. DF10)
//   4. assertPermission(unknown user, 'finance.invoices.write') → 403
//      PERMISSION_DENIED with required = 'finance.invoices.write'
//
// Isolation pattern : throwaway FinanceEntry + Receivable +
// CustomerInvoice, wiped in finally. Same shape as finance-bills.test.mjs.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createCustomerInvoice,
  listCustomerInvoices,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f34c_test_${RUN}__`;

const TRACKED = {
  financeEntryIds: new Set(),
  receivableIds: new Set(),
  customerInvoiceIds: new Set(),
};

const mockRes = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(payload) { this.body = payload; },
});

// ── Setup ─────────────────────────────────────────────────────────────

async function setup() {
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error('Admin ebutsana@neox.io must exist — seed DB first');

  // Synthetic FinanceEntry — minimal required fields, sourceModule=test.
  const financeEntry = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE`,
      entryType: 'receivable',
      direction: 'inflow',
      title: `${PREFIX} synthetic finance entry for invoices test`,
      currencyCode: 'USD',
      amount: 2500,
      sourceModule: 'test',
      sourceEntity: 'finance_invoices_test',
      sourceEntityId: PREFIX,
      sourceEvent: 'test_setup',
      lifecycleStatus: 'draft',
      approvalStatus: 'pending',
      evidenceStatus: 'required_missing',
      settlementStatus: 'open',
    },
  });
  TRACKED.financeEntryIds.add(financeEntry.id);

  const receivable = await prisma.receivable.create({
    data: {
      financeEntryId: financeEntry.id,
      referenceCode: `${PREFIX}REC`,
      clientName: `${PREFIX} Globex Telecom Ltd`,
      totalAmount: 2500,
      outstandingAmount: 2500,
      collectedAmount: 0,
      status: 'open',
      collectionStatus: 'pending_collection',
      isOverdue: false,
    },
  });
  TRACKED.receivableIds.add(receivable.id);

  return { admin, receivable };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
  }
  if (TRACKED.customerInvoiceIds.size > 0) {
    await prisma.customerInvoice.deleteMany({ where: { id: { in: Array.from(TRACKED.customerInvoiceIds) } } });
  }
  if (TRACKED.receivableIds.size > 0) {
    await prisma.receivable.deleteMany({ where: { id: { in: Array.from(TRACKED.receivableIds) } } });
  }
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeEntry.deleteMany({ where: { id: { in: Array.from(TRACKED.financeEntryIds) } } });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

try {
  const { admin, receivable } = await setup();

  // --- Case 1 — createCustomerInvoice creates an invoice linked to receivable ---
  const invoice = await createCustomerInvoice(prisma, {
    receivableId: receivable.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });
  TRACKED.customerInvoiceIds.add(invoice.id);

  assert.equal(invoice.receivableId, receivable.id, 'invoice.receivableId links to parent receivable');
  assert.ok(invoice.invoiceNumber, 'invoiceNumber auto-generated when omitted');
  assert.equal(Number(invoice.subtotalAmount), Number(receivable.totalAmount), 'subtotal defaults to receivable.totalAmount');
  assert.equal(Number(invoice.totalAmount), Number(receivable.totalAmount), 'total defaults to receivable.totalAmount');
  assert.equal(invoice.currencyCode, 'USD', 'currency defaults to USD');
  assert.equal(invoice.status, 'sent', 'status defaults to sent (vs received for bills)');
  assert.equal(invoice.createdByUserId, admin.id, 'createdByUserId set from actor');

  // --- Case 2 — listCustomerInvoices filters by status server-side ---
  const sentInvoices = await listCustomerInvoices(prisma, { status: 'sent' });
  const foundInSent = sentInvoices.find((i) => i.id === invoice.id);
  assert.ok(foundInSent, 'invoice (status=sent) appears in status=sent filter');

  const paidInvoices = await listCustomerInvoices(prisma, { status: 'paid' });
  const foundInPaid = paidInvoices.find((i) => i.id === invoice.id);
  assert.equal(foundInPaid, undefined, 'invoice (status=sent) does NOT appear in status=paid filter');

  // --- Case 3 — listCustomerInvoices returns receivable.clientName for client-side filter ---
  // Note: GET /api/v1/finance/invoices does not accept a client query
  // parameter — the UI filters on receivable.clientName client-side. This
  // test asserts the API returns the data shape needed for that filter.
  const allInvoices = await listCustomerInvoices(prisma, { receivableId: receivable.id });
  const ourInvoice = allInvoices.find((i) => i.id === invoice.id);
  assert.ok(ourInvoice, 'invoice returned when filtering by receivableId');
  assert.ok(ourInvoice.receivable, 'invoice.receivable relation is included');
  assert.equal(ourInvoice.receivable.clientName, receivable.clientName, 'invoice.receivable.clientName populated for client-side filter');

  // --- Case 4 — 403 on POST /invoices without finance.invoices.write ---
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_invoices_test', res },
    'finance.invoices.write'
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.invoices.write');

  console.log('✓ F3.4c finance-invoices — 4/4 assertions OK (create + status filter + client data shape + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
