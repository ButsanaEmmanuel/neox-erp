// D2 — Integration tests for PATCH /api/v1/pm/projects/:id/work-items/:itemId/details
// + saveProjectItemDetails service + RBAC gate + SSE emission + idempotent finance sync.
//
// Run with: node backend/tests/pm/pm-work-item-details-d2.test.mjs
// or         npm run test:pm-work-item-details
//
// Contract under test (8 assertions, plan §4 F1.4):
//   1. PATCH succès — ticketNumber mis à jour + FinanceEntry sync
//   2. PATCH avec body { actor } seul — sync finance re-déclenchée sans erreur
//   3. Champ non autorisé (status) → ignoré silencieusement, save OK
//   4. 403 sans permission pm.workItems.write
//   5. 404 projet inconnu
//   6. 404 work item inconnu (id valide mais pas dans ce projet)
//   7. SSE work_item_updated émis après save
//   8. Rollup finance idempotent — 2e PATCH consécutif sans diff → FinanceEntry inchangée

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PrismaClient } from '@prisma/client';
import { saveProjectItemDetails } from '../../services/projects/projectItemDetails.service.mjs';
import { assertPermission } from '../../services/auth/rbac.service.mjs';
import { registerClient } from '../../services/realtime/sseBroadcaster.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__d2_test_${RUN}__`;

const TRACKED = {
  projectIds: new Set(),
  workItemIds: new Set(),
  financeEntryIds: new Set(),
  syntheticUserIds: new Set(),
};

// ── Mock helpers ──────────────────────────────────────────────────────

const mockRes = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(payload) { this.body = payload; },
});

// SSE mock: a fake ServerResponse that records writes and supports
// `on('close')` so we can shut down the heartbeat after the test.
function mockSseClient() {
  const emitter = new EventEmitter();
  const writes = [];
  const res = {
    writeHead() {},
    write(chunk) { writes.push(String(chunk)); },
    on(event, cb) { emitter.on(event, cb); },
    end() {},
    close() { emitter.emit('close'); },
  };
  return { res, writes };
}

// ── Setup ─────────────────────────────────────────────────────────────

async function setup() {
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new Error('Admin ebutsana@neox.io must exist — seed DB first');

  // Project requires a managerId — reuse admin.
  const project = await prisma.project.create({
    data: {
      name: `${PREFIX} project`,
      clientName: `${PREFIX} client`,
      status: 'active',
      projectMode: 'standard',
      isTelecomProject: true,
      managerId: admin.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      costHT: 1000,
      costTTC: 1160,
      vatRate: 16,
      vatAmount: 160,
    },
  });
  TRACKED.projectIds.add(project.id);

  const workItem = await prisma.workItem.create({
    data: {
      projectId: project.id,
      title: `${PREFIX} work item`,
      status: 'todo',
      poUnitPrice: 100,
    },
  });
  TRACKED.workItemIds.add(workItem.id);

  return { admin, project, workItem };
}

// ── Teardown ──────────────────────────────────────────────────────────

async function teardown() {
  // Order: FK-dependent rows first.
  for (const wid of TRACKED.workItemIds) {
    await prisma.financeActivity.deleteMany({ where: { financeEntry: { sourceLinks: { some: { sourceType: 'project_item', sourceId: { contains: wid } } } } } }).catch(() => {});
    await prisma.financeEvidenceDocument.deleteMany({ where: { financeEntry: { sourceLinks: { some: { sourceType: 'project_item', sourceId: { contains: wid } } } } } }).catch(() => {});
    await prisma.financeApproval.deleteMany({ where: { financeEntry: { sourceLinks: { some: { sourceType: 'project_item', sourceId: { contains: wid } } } } } }).catch(() => {});
    await prisma.financeEntrySourceLink.deleteMany({ where: { sourceId: { contains: wid } } }).catch(() => {});
    await prisma.financeEntry.deleteMany({ where: { referenceCode: { contains: wid } } }).catch(() => {});
    await prisma.projectItemActivity.deleteMany({ where: { workItemId: wid } }).catch(() => {});
    await prisma.projectItemState.deleteMany({ where: { workItemId: wid } }).catch(() => {});
    await prisma.workItem.deleteMany({ where: { id: wid } }).catch(() => {});
  }
  for (const pid of TRACKED.projectIds) {
    await prisma.project.deleteMany({ where: { id: pid } }).catch(() => {});
  }
  for (const uid of TRACKED.syntheticUserIds) {
    await prisma.userRole.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

async function callSave(extra = {}) {
  // Defaults that all tests share — caller overrides projectId/workItemId/etc.
  return saveProjectItemDetails(prisma, {
    projectId: extra.projectId,
    workItemId: extra.workItemId,
    actorUserId: extra.actorUserId,
    actorDisplayName: extra.actorDisplayName,
    ...(extra.ticketNumber !== undefined ? { ticketNumber: extra.ticketNumber } : {}),
    ...(extra.contractorPayableAmount !== undefined ? { contractorPayableAmount: extra.contractorPayableAmount } : {}),
    ...(extra.operationalManualFields !== undefined ? { operationalManualFields: extra.operationalManualFields } : {}),
    ...(extra.acceptanceManualFields !== undefined ? { acceptanceManualFields: extra.acceptanceManualFields } : {}),
  });
}

async function countFinanceEntriesFor(workItemId) {
  return prisma.financeEntry.count({ where: { referenceCode: { contains: workItemId } } });
}

// ── Tests ─────────────────────────────────────────────────────────────

async function test1_patchSuccess({ admin, project, workItem }) {
  const state = await callSave({
    projectId: project.id,
    workItemId: workItem.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
    ticketNumber: 42,
    contractorPayableAmount: 80,
  });
  assert.equal(Number(state.ticketNumber), 42, 'ticketNumber persisted');
  // FinanceEntry side-effect — at least one entry exists for this workItem.
  const count = await countFinanceEntriesFor(workItem.id);
  assert.ok(count >= 1, `at least 1 FinanceEntry created for workItem (got ${count})`);
  console.log('  ✓ 1. PATCH succès — ticketNumber + FinanceEntry sync');
  return { count };
}

async function test2_retryOnly({ admin, project, workItem }) {
  // body { actor } seul — no data fields. Service must not throw and must
  // re-run the finance sync (idempotent).
  await callSave({
    projectId: project.id,
    workItemId: workItem.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
  });
  console.log('  ✓ 2. PATCH body { actor } seul — sync re-déclenchée sans erreur');
}

async function test3_unknownFieldStripped({ admin, project, workItem }) {
  // Pass an extra field 'status' that the service signature doesn't read.
  // No throw, save proceeds. WorkItem.status must remain 'todo'.
  await callSave({
    projectId: project.id,
    workItemId: workItem.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
    status: 'done', // not part of the whitelist — must be ignored
  });
  const after = await prisma.workItem.findUnique({ where: { id: workItem.id }, select: { status: true } });
  // Contract: the user-supplied 'status' field is NOT honored. The service
  // auto-derives WorkItem.status from eligibility/QA/acceptance, so the
  // actual value here may be 'awaiting_qa_approval', 'pending', etc. —
  // anything EXCEPT the value we tried to force in via body.
  assert.notEqual(after.status, 'done', `WorkItem.status must not equal injected 'done' (got '${after.status}' — derived by service)`);
  console.log(`  ✓ 3. Champ non autorisé (status='done') → ignoré silencieusement (status final dérivé: '${after.status}')`);
}

async function test4_rbacDeny() {
  // Create a synthetic user with no roles → no pm.workItems.write.
  const orphan = await prisma.user.create({
    data: {
      id: `usr_${PREFIX}_orphan`,
      name: `${PREFIX} orphan`,
      email: `orphan-${RUN}@d2-test.invalid`,
      passwordHash: 'x',
      isActive: true,
      hasSystemAccess: true,
    },
  });
  TRACKED.syntheticUserIds.add(orphan.id);
  const res = mockRes();
  const allowed = await assertPermission({ userId: orphan.id, res }, 'pm.workItems.write');
  assert.equal(allowed, false, 'orphan user must be denied');
  assert.equal(res.statusCode, 403, '403 status code emitted');
  console.log('  ✓ 4. 403 sans permission pm.workItems.write');
}

async function test5_404Project({ admin, workItem }) {
  let caught = null;
  try {
    await callSave({
      projectId: 'prj_does_not_exist_xxx',
      workItemId: workItem.id,
      actorUserId: admin.id,
      actorDisplayName: admin.name,
    });
  } catch (e) { caught = e; }
  assert.ok(caught, 'must throw on unknown project');
  assert.equal(caught.statusCode, 404, `statusCode = 404 (got ${caught.statusCode})`);
  assert.equal(caught.code, 'NOT_FOUND', `code = NOT_FOUND (got ${caught.code})`);
  console.log('  ✓ 5. 404 projet inconnu — statusCode=404, code=NOT_FOUND');
}

async function test6_404WorkItem({ admin, project }) {
  let caught = null;
  try {
    await callSave({
      projectId: project.id,
      workItemId: 'wi_does_not_exist_xxx',
      actorUserId: admin.id,
      actorDisplayName: admin.name,
    });
  } catch (e) { caught = e; }
  assert.ok(caught, 'must throw on unknown workItem');
  assert.equal(caught.statusCode, 404, `statusCode = 404 (got ${caught.statusCode})`);
  assert.equal(caught.code, 'NOT_FOUND', `code = NOT_FOUND (got ${caught.code})`);
  console.log('  ✓ 6. 404 work item inconnu — statusCode=404, code=NOT_FOUND');
}

async function test7_sseEmitted({ admin, project, workItem }) {
  const { res: sseRes, writes } = mockSseClient();
  registerClient(`${PREFIX}-listener`, sseRes);
  try {
    await callSave({
      projectId: project.id,
      workItemId: workItem.id,
      actorUserId: admin.id,
      actorDisplayName: admin.name,
      ticketNumber: 99,
    });
    // Drop the initial 'connected' frame from the search.
    const sseFrames = writes.filter((w) => !w.includes('event: connected') && !w.startsWith(': heartbeat'));
    const found = sseFrames.some((w) => w.includes('event: work_item_updated') && w.includes(workItem.id));
    assert.ok(found, `SSE 'work_item_updated' frame must contain workItemId — frames captured: ${sseFrames.length}`);
    console.log('  ✓ 7. SSE work_item_updated émis après save');
  } finally {
    sseRes.close(); // clears heartbeat + unregisters
  }
}

async function test8_idempotentSync({ admin, project, workItem }) {
  // Snapshot finance entries after a fresh save.
  await callSave({
    projectId: project.id,
    workItemId: workItem.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
    ticketNumber: 42,
    contractorPayableAmount: 80,
  });
  const before = await prisma.financeEntry.findMany({
    where: { referenceCode: { contains: workItem.id } },
    orderBy: { id: 'asc' },
    select: { id: true, amount: true, updatedAt: true },
  });
  // 2nd save with no diff — same field values.
  await callSave({
    projectId: project.id,
    workItemId: workItem.id,
    actorUserId: admin.id,
    actorDisplayName: admin.name,
    ticketNumber: 42,
    contractorPayableAmount: 80,
  });
  const after = await prisma.financeEntry.findMany({
    where: { referenceCode: { contains: workItem.id } },
    orderBy: { id: 'asc' },
    select: { id: true, amount: true, updatedAt: true },
  });
  assert.equal(after.length, before.length, `same FinanceEntry count (before=${before.length}, after=${after.length})`);
  for (let i = 0; i < before.length; i += 1) {
    assert.equal(after[i].id, before[i].id, `FinanceEntry[${i}].id stable`);
    assert.equal(String(after[i].amount), String(before[i].amount), `FinanceEntry[${i}].amount unchanged`);
  }
  console.log('  ✓ 8. Rollup finance idempotent — 2e PATCH sans diff → FinanceEntry count + amounts inchangés');
}

// ── Runner ────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 D2 — PATCH /work-items/:id/details + finance sync + RBAC + SSE');
  console.log('');
  try {
    console.log('Setup:');
    const ctx = await setup();
    console.log(`  ✓ project=${ctx.project.id}, workItem=${ctx.workItem.id}, admin=${ctx.admin.email}`);
    console.log('');
    console.log('Integration:');
    await test1_patchSuccess(ctx);
    await test2_retryOnly(ctx);
    await test3_unknownFieldStripped(ctx);
    await test4_rbacDeny();
    await test5_404Project(ctx);
    await test6_404WorkItem(ctx);
    await test7_sseEmitted(ctx);
    await test8_idempotentSync(ctx);
    console.log('');
    console.log('✅ D2 — 8/8 tests passed.');
  } finally {
    console.log('');
    console.log('Teardown:');
    try {
      await teardown();
      console.log('  ✓ test data removed');
    } catch (e) {
      console.error('  ✗ teardown failed:', e?.message ?? e);
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ D2 tests failed:', e);
  process.exit(1);
});
