// F3.1c — Integration tests for vendor bills (Sprint Finance-3).
//
// Run with: node backend/tests/finance/finance-bills.test.mjs
//
// Contract under test (4 assertions, plan §6 F3.1) :
//   1. createVendorBill → bill created + linked to parent payable, defaults
//      applied (billNumber auto, totals from payable, currency USD, status received)
//   2. listVendorBills({ status }) → server-side status filter returns
//      only matching bills, our synthetic bill included when status matches
//   3. listVendorBills (no filter) → returns rows with payable.vendorName
//      populated so the UI can apply its client-side vendor filter
//      (backend does not expose a vendor query param — cf. DF10)
//   4. assertPermission(unknown user, 'finance.bills.write') → 403
//      PERMISSION_DENIED with required = 'finance.bills.write'
//
// Isolation pattern : throwaway FinanceEntry + Payable + VendorBill,
// wiped in finally. Same shape as pm-work-item-details-d2.test.mjs.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createVendorBill,
  listVendorBills,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f31c_test_${RUN}__`;

const TRACKED = {
  financeEntryIds: new Set(),
  payableIds: new Set(),
  vendorBillIds: new Set(),
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

  // Synthetic FinanceEntry — minimal required fields. sourceModule=test so
  // it is impossible to confuse with real ledger data.
  const financeEntry = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE`,
      entryType: 'payable',
      direction: 'outflow',
      title: `${PREFIX} synthetic finance entry for bills test`,
      currencyCode: 'USD',
      amount: 1500,
      sourceModule: 'test',
      sourceEntity: 'finance_bills_test',
      sourceEntityId: PREFIX,
      sourceEvent: 'test_setup',
      lifecycleStatus: 'draft',
      approvalStatus: 'pending',
      evidenceStatus: 'required_missing',
      settlementStatus: 'open',
    },
  });
  TRACKED.financeEntryIds.add(financeEntry.id);

  const payable = await prisma.payable.create({
    data: {
      financeEntryId: financeEntry.id,
      referenceCode: `${PREFIX}PAY`,
      vendorName: `${PREFIX} Acme Hardware Ltd`,
      totalAmount: 1500,
      outstandingAmount: 1500,
      paidAmount: 0,
      status: 'pending_approval',
      paymentStatus: 'pending_payment',
      requiresEvidence: true,
    },
  });
  TRACKED.payableIds.add(payable.id);

  return { admin, payable };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  // FinanceActivity rows referencing our FinanceEntry must go before the
  // entry itself (FK Restrict).
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
  }
  if (TRACKED.vendorBillIds.size > 0) {
    await prisma.vendorBill.deleteMany({ where: { id: { in: Array.from(TRACKED.vendorBillIds) } } });
  }
  if (TRACKED.payableIds.size > 0) {
    await prisma.payable.deleteMany({ where: { id: { in: Array.from(TRACKED.payableIds) } } });
  }
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeEntry.deleteMany({ where: { id: { in: Array.from(TRACKED.financeEntryIds) } } });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

try {
  const { admin, payable } = await setup();

  // --- Case 1 — createVendorBill creates a bill linked to the payable ---
  const bill = await createVendorBill(prisma, {
    payableId: payable.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });
  TRACKED.vendorBillIds.add(bill.id);

  assert.equal(bill.payableId, payable.id, 'bill.payableId links to parent payable');
  assert.ok(bill.billNumber, 'billNumber auto-generated when omitted');
  assert.equal(Number(bill.subtotalAmount), Number(payable.totalAmount), 'subtotal defaults to payable.totalAmount');
  assert.equal(Number(bill.totalAmount), Number(payable.totalAmount), 'total defaults to payable.totalAmount');
  assert.equal(bill.currencyCode, 'USD', 'currency defaults to USD');
  assert.equal(bill.status, 'received', 'status defaults to received');
  assert.equal(bill.createdByUserId, admin.id, 'createdByUserId set from actor');

  // --- Case 2 — listVendorBills filters by status server-side ---
  const receivedBills = await listVendorBills(prisma, { status: 'received' });
  const foundInReceived = receivedBills.find((b) => b.id === bill.id);
  assert.ok(foundInReceived, 'bill (status=received) appears in status=received filter');

  const paidBills = await listVendorBills(prisma, { status: 'paid' });
  const foundInPaid = paidBills.find((b) => b.id === bill.id);
  assert.equal(foundInPaid, undefined, 'bill (status=received) does NOT appear in status=paid filter');

  // --- Case 3 — listVendorBills returns payable.vendorName for client-side vendor filtering ---
  // Note: the GET /api/v1/finance/bills route does not accept a vendor query
  // parameter — the UI filters on payable.vendorName client-side. This test
  // asserts the API returns the data shape needed for that filter.
  const allBills = await listVendorBills(prisma, { payableId: payable.id });
  const ourBill = allBills.find((b) => b.id === bill.id);
  assert.ok(ourBill, 'bill returned when filtering by payableId');
  assert.ok(ourBill.payable, 'bill.payable relation is included');
  assert.equal(ourBill.payable.vendorName, payable.vendorName, 'bill.payable.vendorName populated for client-side filter');

  // --- Case 4 — 403 on POST /bills without finance.bills.write ---
  // We exercise assertPermission directly (same pattern as
  // finance-routes-rbac-d6) — gating an unknown user returns 403 with the
  // required-key payload the route layer relies on.
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_bills_test', res },
    'finance.bills.write'
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.bills.write');

  console.log('✓ F3.1c finance-bills — 4/4 assertions OK (create + status filter + vendor data shape + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
