// F3.3c — Integration tests for receipt collections (Sprint Finance-3).
//
// Run with: node backend/tests/finance/finance-receipts.test.mjs
//
// Contract under test (4 assertions, plan §6 F3.3) :
//   1. createReceiptCollection → { receipt, receivable: refreshed } —
//      receipt.receivableId linked, defaults applied (receiptReference
//      auto, currency USD, method bank_transfer, status completed,
//      receivedByUserId set), AND parent receivable totals refreshed
//      (outstandingAmount decreased, collectedAmount increased)
//   2. listReceiptCollections({ status }) → server-side status filter
//      returns only matching receipts
//   3. listReceiptCollections (no filter) → returns rows with
//      receivable.clientName populated for client-side client filter (DF10)
//   4. assertPermission(unknown user, 'finance.receipts.write') → 403
//      PERMISSION_DENIED
//
// Isolation pattern : throwaway FinanceEntry + Receivable +
// ReceiptCollection, wiped in finally. createReceiptCollection requires
// proofReference (no SCM exception, unlike payments) — provided in test.
// The synthetic FinanceEvidenceDocument generated from the proofReference
// is also wiped.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createReceiptCollection,
  listReceiptCollections,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f33c_test_${RUN}__`;

const TRACKED = {
  financeEntryIds: new Set(),
  receivableIds: new Set(),
  receiptIds: new Set(),
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

  const financeEntry = await prisma.financeEntry.create({
    data: {
      referenceCode: `${PREFIX}FE`,
      entryType: 'receivable',
      direction: 'inflow',
      title: `${PREFIX} synthetic finance entry for receipts test`,
      currencyCode: 'USD',
      amount: 2000,
      sourceModule: 'test',
      sourceEntity: 'finance_receipts_test',
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
      clientName: `${PREFIX} Stark Industries`,
      totalAmount: 2000,
      outstandingAmount: 2000,
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
  // createReceiptCollection attaches a synthetic FinanceEvidenceDocument
  // from proofReference (financeEntries.service.mjs:1348) — wipe those too.
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeEvidenceDocument.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
  }
  if (TRACKED.receiptIds.size > 0) {
    await prisma.receiptCollection.deleteMany({ where: { id: { in: Array.from(TRACKED.receiptIds) } } });
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

  // --- Case 1 — createReceiptCollection creates receipt + refreshes receivable totals ---
  // proofReference is REQUIRED by the service (no SCM exception) — provided.
  const COLLECTED = 750;
  const result = await createReceiptCollection(prisma, {
    receivableId: receivable.id,
    amount: COLLECTED,
    proofReference: `${PREFIX}BANK_REF_001`,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });
  const { receipt, receivable: refreshedFromService } = result;
  assert.ok(receipt, 'service returns a receipt object');
  assert.ok(refreshedFromService, 'service returns the refreshed receivable');
  TRACKED.receiptIds.add(receipt.id);

  assert.equal(receipt.receivableId, receivable.id, 'receipt.receivableId links to parent receivable');
  assert.ok(receipt.receiptReference, 'receiptReference auto-generated when omitted');
  assert.equal(Number(receipt.amount), COLLECTED, 'amount stored exactly as requested');
  assert.equal(receipt.currencyCode, 'USD', 'currency defaults to USD');
  assert.equal(receipt.method, 'bank_transfer', 'method defaults to bank_transfer');
  assert.equal(receipt.status, 'completed', 'status defaults to completed');
  assert.equal(receipt.receivedByUserId, admin.id, 'receivedByUserId set from actor');
  assert.ok(receipt.proofDocumentId, 'proofDocumentId set — synthetic evidence attached from proofReference');

  // Parent receivable totals refreshed by refreshReceivableTotals
  const refreshedReceivable = await prisma.receivable.findUnique({ where: { id: receivable.id } });
  assert.equal(Number(refreshedReceivable.collectedAmount), COLLECTED, 'receivable.collectedAmount = sum of receipts');
  assert.equal(Number(refreshedReceivable.outstandingAmount), Number(receivable.totalAmount) - COLLECTED, 'receivable.outstandingAmount decreased by receipt amount');

  // --- Case 2 — listReceiptCollections filters by status server-side ---
  const completed = await listReceiptCollections(prisma, { status: 'completed' });
  const foundInCompleted = completed.find((r) => r.id === receipt.id);
  assert.ok(foundInCompleted, 'receipt (status=completed) appears in status=completed filter');

  const pendingList = await listReceiptCollections(prisma, { status: 'pending' });
  const foundInPending = pendingList.find((r) => r.id === receipt.id);
  assert.equal(foundInPending, undefined, 'receipt (status=completed) does NOT appear in status=pending filter');

  // --- Case 3 — listReceiptCollections returns receivable.clientName for client-side filter ---
  const allByReceivable = await listReceiptCollections(prisma, { receivableId: receivable.id });
  const ourReceipt = allByReceivable.find((r) => r.id === receipt.id);
  assert.ok(ourReceipt, 'receipt returned when filtering by receivableId');
  assert.ok(ourReceipt.receivable, 'receipt.receivable relation is included');
  assert.equal(ourReceipt.receivable.clientName, receivable.clientName, 'receipt.receivable.clientName populated for client-side filter');

  // --- Case 4 — 403 on POST /receipts without finance.receipts.write ---
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_receipts_test', res },
    'finance.receipts.write'
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.receipts.write');

  console.log('✓ F3.3c finance-receipts — 4/4 assertions OK (create + receivable totals refresh + status filter + client data + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
