// F3.5d — Integration tests for receivables (Sprint Finance-3).
//
// Run with: node backend/tests/finance/finance-receivables.test.mjs
//
// Contract under test (4 assertions, plan §6 F3.5) :
//   1. listReceivables → returns our synthetic receivable with
//      financeEntry pre-included (the page consumes financeEntry.*
//      for derived fields). status filter works server-side.
//   2. listReceivables (no filter) → returns rows with clientName
//      populated for client-side filter (DF10 — no client query param)
//   3. getReceivableDetail (/:id) → returns financeEntry with the
//      sub-collections the rich drawer relies on: evidenceDocuments,
//      activities, sourceLinks (vs. the lighter list shape)
//   4. assertPermission(unknown user, 'finance.ledger.read') → 403
//      PERMISSION_DENIED. Note : the route uses finance.ledger.read,
//      not a finance.receivables.* permission — the latter doesn't
//      exist in the RBAC catalogue (corrected in plan §6).
//
// Isolation pattern : throwaway FinanceEntry + Receivable (no create
// endpoint to test — receivables are derived from invoices and other
// upstream flows). Synthetic FinanceActivity added to validate the
// drawer's activity panel data shape.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  listReceivables,
  getReceivableDetail,
} from '../../services/finance/financeEntries.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__f35d_test_${RUN}__`;

const TRACKED = {
  financeEntryIds: new Set(),
  receivableIds: new Set(),
  activityIds: new Set(),
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
      title: `${PREFIX} synthetic finance entry for receivables test`,
      currencyCode: 'USD',
      amount: 5000,
      sourceModule: 'test',
      sourceEntity: 'finance_receivables_test',
      sourceEntityId: PREFIX,
      sourceEvent: 'test_setup',
      lifecycleStatus: 'draft',
      approvalStatus: 'pending',
      evidenceStatus: 'required_missing',
      settlementStatus: 'open',
    },
  });
  TRACKED.financeEntryIds.add(financeEntry.id);

  // Receivable with outstanding > 0 so aging logic in UI has data to grade.
  const receivable = await prisma.receivable.create({
    data: {
      financeEntryId: financeEntry.id,
      referenceCode: `${PREFIX}REC`,
      clientName: `${PREFIX} Wayne Enterprises`,
      totalAmount: 5000,
      outstandingAmount: 5000,
      collectedAmount: 0,
      status: 'open',
      collectionStatus: 'pending_collection',
      isOverdue: false,
    },
  });
  TRACKED.receivableIds.add(receivable.id);

  // One activity so the drawer's "Recent Activity" panel data shape is
  // validated by getReceivableDetail.
  const activity = await prisma.financeActivity.create({
    data: {
      financeEntryId: financeEntry.id,
      actorUserId: admin.id,
      actorDisplayName: admin.name,
      actionType: 'test_setup',
      message: `${PREFIX} synthetic activity for drawer test`,
      eventSource: 'system',
    },
  });
  TRACKED.activityIds.add(activity.id);

  return { admin, receivable };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  if (TRACKED.financeEntryIds.size > 0) {
    await prisma.financeActivity.deleteMany({
      where: { financeEntryId: { in: Array.from(TRACKED.financeEntryIds) } },
    });
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
  const { receivable } = await setup();

  // --- Case 1 — listReceivables returns our synthetic receivable with financeEntry + filters by status ---
  const openList = await listReceivables(prisma, { status: 'open' });
  const foundInOpen = openList.find((r) => r.id === receivable.id);
  assert.ok(foundInOpen, 'receivable (status=open) appears in status=open filter');
  assert.ok(foundInOpen.financeEntry, 'receivable.financeEntry pre-included in list shape');
  assert.equal(foundInOpen.financeEntry.id, receivable.financeEntryId, 'financeEntry FK matches');

  const paidList = await listReceivables(prisma, { status: 'paid' });
  const foundInPaid = paidList.find((r) => r.id === receivable.id);
  assert.equal(foundInPaid, undefined, 'receivable (status=open) does NOT appear in status=paid filter');

  // --- Case 2 — listReceivables returns clientName for client-side filter ---
  const allList = await listReceivables(prisma, {});
  const ours = allList.find((r) => r.id === receivable.id);
  assert.ok(ours, 'receivable present in unfiltered list');
  assert.equal(ours.clientName, receivable.clientName, 'clientName populated for client-side filter');

  // --- Case 3 — getReceivableDetail returns rich shape for the drawer ---
  // The drawer relies on financeEntry.evidenceDocuments + activities +
  // sourceLinks being available. List shape only includes a 5-item slice;
  // detail shape includes everything (no take limit).
  const detail = await getReceivableDetail(prisma, receivable.id);
  assert.ok(detail, 'getReceivableDetail returns the receivable');
  assert.equal(detail.id, receivable.id, 'detail id matches');
  assert.ok(detail.financeEntry, 'detail.financeEntry included');
  assert.ok(Array.isArray(detail.financeEntry.evidenceDocuments), 'evidenceDocuments array present');
  assert.ok(Array.isArray(detail.financeEntry.activities), 'activities array present');
  assert.ok(Array.isArray(detail.financeEntry.sourceLinks), 'sourceLinks array present (drawer-only field, NOT in list shape)');
  assert.ok(
    detail.financeEntry.activities.some((a) => a.actionType === 'test_setup'),
    'our synthetic activity is included — drawer Recent Activity panel will render it'
  );

  // --- Case 4 — 403 on GET /receivables without finance.ledger.read ---
  // The route uses finance.ledger.read (not finance.receivables.read which
  // doesn't exist in the RBAC catalogue — corrected in plan §6).
  const res = mockRes();
  const ok = await assertPermission(
    { userId: 'usr_does_not_exist_finance_receivables_test', res },
    'finance.ledger.read'
  );
  assert.equal(ok, false, 'assertPermission returns false for unknown user');
  assert.equal(res.statusCode, 403, '403 written to response');
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PERMISSION_DENIED');
  assert.equal(body.required, 'finance.ledger.read');

  console.log('✓ F3.5d finance-receivables — 4/4 assertions OK (list+filter + clientName + rich detail + 403)');
} finally {
  try {
    await teardown();
  } catch (cleanupErr) {
    console.warn('⚠ teardown error:', cleanupErr.message);
  }
  await prisma.$disconnect();
}
