// F3.2c — Integration tests for payment disbursements (Sprint Finance-3).
//
// Run with: node backend/tests/finance/finance-payments.test.mjs
//
// Contract under test (4 assertions, plan §6 F3.2) :
//   1. createPaymentDisbursement → payment created + payableId linked,
//      defaults applied (paymentReference auto, currency USD,
//      method bank_transfer, status completed, executedByUserId set),
//      AND parent payable totals refreshed (outstandingAmount decreased,
//      paidAmount increased)
//   2. listPaymentDisbursements({ status }) → server-side status filter
//      returns only matching payments
//   3. listPaymentDisbursements (no filter) → returns rows with
//      payable.vendorName populated so the UI can apply its client-side
//      vendor filter (backend does not expose a vendor query param — DF10)
//   4. assertPermission(unknown user, 'finance.payments.write') → 403
//      PERMISSION_DENIED with required = 'finance.payments.write'
//
// Isolation pattern : throwaway FinanceEntry (sourceModule='test' to
// avoid SCM approval/evidence checks) + Payable + PaymentDisbursement,
// wiped in finally. Same shape as finance-bills.test.mjs.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createPaymentDisbursement,
  listPaymentDisbursements,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f32c_test_${RUN}__`;

const TRACKED = {
  financeEntryIds: new Set(),
  payableIds: new Set(),
  paymentIds: new Set(),
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

  // sourceModule='test' so createPaymentDisbursement skips the SCM-only
  // approval + transfer-proof requirement.
  const financeEntry = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE`,
      entryType: 'payable',
      direction: 'outflow',
      title: `${PREFIX} synthetic finance entry for payments test`,
      currencyCode: 'USD',
      amount: 1000,
      sourceModule: 'test',
      sourceEntity: 'finance_payments_test',
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
      vendorName: `${PREFIX} Initech Supply Co`,
      totalAmount: 1000,
      outstandingAmount: 1000,
      paidAmount: 0,
      status: 'pending_approval',
      paymentStatus: 'pending_payment',
      requiresEvidence: false,
    },
  });
  TRACKED.payableIds.add(payable.id);

  return { admin, payable };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
  }
  if (TRACKED.paymentIds.size > 0) {
    await prisma.paymentDisbursement.deleteMany({ where: { id: { in: Array.from(TRACKED.paymentIds) } } });
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

  // --- Case 1 — createPaymentDisbursement creates payment + refreshes payable totals ---
  // Service returns { payment, payable: refreshed } — destructure both.
  const PAID = 400;
  const result = await createPaymentDisbursement(prisma, {
    payableId: payable.id,
    amount: PAID,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });
  const { payment, payable: refreshedFromService } = result;
  assert.ok(payment, 'service returns a payment object');
  assert.ok(refreshedFromService, 'service returns the refreshed payable');
  TRACKED.paymentIds.add(payment.id);

  assert.equal(payment.payableId, payable.id, 'payment.payableId links to parent payable');
  assert.ok(payment.paymentReference, 'paymentReference auto-generated when omitted');
  assert.equal(Number(payment.amount), PAID, 'amount stored exactly as requested');
  assert.equal(payment.currencyCode, 'USD', 'currency defaults to USD');
  assert.equal(payment.method, 'bank_transfer', 'method defaults to bank_transfer');
  assert.equal(payment.status, 'completed', 'status defaults to completed (vs received/sent for documents)');
  assert.equal(payment.executedByUserId, admin.id, 'executedByUserId set from actor');

  // Parent payable totals refreshed by refreshPayableTotals after payment
  const refreshedPayable = await prisma.payable.findUnique({ where: { id: payable.id } });
  assert.equal(Number(refreshedPayable.paidAmount), PAID, 'payable.paidAmount = sum of payments');
  assert.equal(Number(refreshedPayable.outstandingAmount), Number(payable.totalAmount) - PAID, 'payable.outstandingAmount decreased by payment amount');

  // --- Case 2 — listPaymentDisbursements filters by status server-side ---
  const completed = await listPaymentDisbursements(prisma, { status: 'completed' });
  const foundInCompleted = completed.find((p) => p.id === payment.id);
  assert.ok(foundInCompleted, 'payment (status=completed) appears in status=completed filter');

  const pendingList = await listPaymentDisbursements(prisma, { status: 'pending' });
  const foundInPending = pendingList.find((p) => p.id === payment.id);
  assert.equal(foundInPending, undefined, 'payment (status=completed) does NOT appear in status=pending filter');

  // --- Case 3 — listPaymentDisbursements returns payable.vendorName for client-side filter ---
  const allByPayable = await listPaymentDisbursements(prisma, { payableId: payable.id });
  const ourPayment = allByPayable.find((p) => p.id === payment.id);
  assert.ok(ourPayment, 'payment returned when filtering by payableId');
  assert.ok(ourPayment.payable, 'payment.payable relation is included');
  assert.equal(ourPayment.payable.vendorName, payable.vendorName, 'payment.payable.vendorName populated for client-side filter');

  // --- Case 4 — 403 on POST /payments without finance.payments.write ---
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_payments_test', res },
    'finance.payments.write'
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.payments.write');

  console.log('✓ F3.2c finance-payments — 4/4 assertions OK (create + payable totals refresh + status filter + vendor data + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
