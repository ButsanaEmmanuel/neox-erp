// DH12 — Milestone parent/child hierarchy integration tests.
// Run via: node backend/tests/pm/pm-milestones-hierarchy.test.mjs
//
// Same isolation pattern as pm-subtasks.test.mjs : a throwaway test project
// (plus a second one for the cross-project move case) wiped in finally.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createSubMilestone,
  listSubMilestones,
  moveSubMilestone,
} from '../../services/pm/milestoneHierarchy.service.mjs';
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '../../services/pm/milestones.service.mjs';

const prisma = new PrismaClient();
const TEST_PREFIX = `__dh12_test_${Date.now()}__`;

const dueDate = (offsetDays = 30) =>
  new Date(Date.now() + offsetDays * 24 * 3600 * 1000).toISOString();

// --- helpers ---------------------------------------------------------

async function setupProject(label) {
  const manager = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, departmentId: true },
  });
  if (!manager) throw new Error('No active user available — seed the DB first');

  return prisma.project.create({
    data: {
      name: `${TEST_PREFIX} ${label}`,
      clientName: `${TEST_PREFIX} client`,
      managerId: manager.id,
      ownerDepartmentId: manager.departmentId || undefined,
      status: 'active',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-12-31'),
    },
  });
}

async function teardown(projectIds) {
  for (const pid of projectIds.filter(Boolean)) {
    // MilestoneDependency cascade-deletes via Milestone FK ON DELETE Cascade,
    // but Milestone self-relation is Restrict — wipe leaves first.
    let safety = 0;
    while (safety < 10) {
      const leaves = await prisma.milestone.findMany({
        where: { projectId: pid, children: { none: {} } },
        select: { id: true },
      });
      if (leaves.length === 0) break;
      await prisma.milestoneDependency.deleteMany({
        where: { OR: [{ milestoneId: { in: leaves.map((l) => l.id) } }, { dependsOnId: { in: leaves.map((l) => l.id) } }] },
      });
      await prisma.milestone.deleteMany({ where: { id: { in: leaves.map((l) => l.id) } } });
      safety += 1;
    }
    await prisma.projectMember.deleteMany({ where: { projectId: pid } });
    await prisma.project.delete({ where: { id: pid } }).catch(() => {});
  }
}

async function expectRejectsWithCode(promise, expectedCode, label) {
  let caught;
  try { await promise; } catch (e) { caught = e; }
  assert.ok(caught, `${label}: expected to throw`);
  assert.equal(caught.code, expectedCode, `${label}: code = ${expectedCode}, got ${caught.code}`);
}

const mkRoot = (projectId, title, status = 'planned') =>
  createMilestone(prisma, projectId, { title, dueDate: dueDate(30), status });

// --- run -------------------------------------------------------------

let projectId = null;
let project2Id = null;
try {
  console.log('\n🧪 DH12 — Milestone parent/child hierarchy');
  const p1 = await setupProject('p1');
  projectId = p1.id;
  const p2 = await setupProject('p2');
  project2Id = p2.id;

  // Case 1 — createSubMilestone sets parentId + inherits projectId.
  const root = await mkRoot(projectId, 'root-A');
  const child = await createSubMilestone(prisma, root.id, { title: 'child-A1', dueDate: dueDate(40) });
  assert.equal(child.parentId, root.id, 'child.parentId === root.id');
  assert.equal(child.projectId, projectId, 'child inherits projectId');
  console.log('  ✓ createSubMilestone sets parentId and inherits projectId');

  // Case 2 — Depth > 3 rejected.
  const grand = await createSubMilestone(prisma, child.id, { title: 'grand-A1a', dueDate: dueDate(50) });
  await expectRejectsWithCode(
    createSubMilestone(prisma, grand.id, { title: 'great-grand', dueDate: dueDate(60) }),
    'MAX_DEPTH_EXCEEDED',
    'depth=4 creation',
  );
  console.log('  ✓ depth > 3 rejected with MAX_DEPTH_EXCEEDED');

  // Case 3 — Rollup: all children 'done' → parent 'done'.
  const root2 = await mkRoot(projectId, 'root-B');
  const b1 = await createSubMilestone(prisma, root2.id, { title: 'B-c1', dueDate: dueDate(35) });
  const b2 = await createSubMilestone(prisma, root2.id, { title: 'B-c2', dueDate: dueDate(36) });
  await updateMilestone(prisma, projectId, b1.id, { status: 'done' });
  await updateMilestone(prisma, projectId, b2.id, { status: 'done' });
  const root2After = await prisma.milestone.findUnique({ where: { id: root2.id } });
  assert.equal(root2After.status, 'done', 'parent rolled up to done');
  console.log('  ✓ all children done → parent done');

  // Case 4 — Rollup: ≥1 child 'blocked' → parent 'blocked'.
  const root3 = await mkRoot(projectId, 'root-C');
  const c1 = await createSubMilestone(prisma, root3.id, { title: 'C-c1', dueDate: dueDate(35) });
  const c2 = await createSubMilestone(prisma, root3.id, { title: 'C-c2', dueDate: dueDate(36) });
  await updateMilestone(prisma, projectId, c1.id, { status: 'in_progress' });
  await updateMilestone(prisma, projectId, c2.id, { status: 'blocked' });
  const root3After = await prisma.milestone.findUnique({ where: { id: root3.id } });
  assert.equal(root3After.status, 'blocked', 'parent rolled up to blocked on blocked child');
  console.log('  ✓ ≥1 child blocked → parent blocked');

  // Case 5 — Recursive rollup: A → B → C, C blocked → A blocked.
  const rootD = await mkRoot(projectId, 'root-D');
  const dB = await createSubMilestone(prisma, rootD.id, { title: 'D-B', dueDate: dueDate(35) });
  const dC = await createSubMilestone(prisma, dB.id,   { title: 'D-C', dueDate: dueDate(36) });
  await updateMilestone(prisma, projectId, dC.id, { status: 'blocked' });
  const dBAfter = await prisma.milestone.findUnique({ where: { id: dB.id } });
  const rootDAfter = await prisma.milestone.findUnique({ where: { id: rootD.id } });
  assert.equal(dBAfter.status, 'blocked', 'intermediate parent flagged blocked');
  assert.equal(rootDAfter.status, 'blocked', 'root flagged blocked via recursion');
  console.log('  ✓ rollup propagates recursively to root');

  // Case 6 — Move that creates a cycle → CYCLE_DETECTED.
  const rootE = await mkRoot(projectId, 'root-E');
  const eMid = await createSubMilestone(prisma, rootE.id, { title: 'E-mid', dueDate: dueDate(35) });
  await expectRejectsWithCode(
    moveSubMilestone(prisma, rootE.id, { parentId: eMid.id }),
    'CYCLE_DETECTED',
    'cycle root → its own descendant',
  );
  await expectRejectsWithCode(
    moveSubMilestone(prisma, rootE.id, { parentId: rootE.id }),
    'CYCLE_DETECTED',
    'self-loop',
  );
  console.log('  ✓ cycle creation rejected with CYCLE_DETECTED');

  // Case 7 — moveSubMilestone across projects rejected.
  const rootF = await mkRoot(projectId, 'root-F');
  const otherRoot = await mkRoot(project2Id, 'other-root');
  await expectRejectsWithCode(
    moveSubMilestone(prisma, rootF.id, { parentId: otherRoot.id }),
    'CROSS_PROJECT_MOVE',
    'cross-project move',
  );
  console.log('  ✓ cross-project move rejected with CROSS_PROJECT_MOVE');

  // Case 8 — Hard delete of parent with active children → Prisma FK Restrict.
  const rootG = await mkRoot(projectId, 'root-G');
  await createSubMilestone(prisma, rootG.id, { title: 'G-c1', dueDate: dueDate(35) });
  let fkError;
  try { await prisma.milestone.delete({ where: { id: rootG.id } }); } catch (e) { fkError = e; }
  assert.ok(fkError, 'hard delete should fail');
  assert.ok(
    String(fkError.code) === 'P2003' || String(fkError.message || '').includes('Foreign key'),
    `expected FK error (P2003), got code=${fkError.code} msg=${(fkError.message || '').slice(0, 120)}`,
  );
  console.log('  ✓ hard delete of parent with children → FK Restrict');

  // Case 9 — Soft-delete child → parent rollup re-evaluated.
  // Setup: rootH → h1 (blocked), h2 (done). Parent should be 'blocked'.
  // Soft-delete h1 → only h2 remains → parent should flip to 'done'.
  const rootH = await mkRoot(projectId, 'root-H');
  const h1 = await createSubMilestone(prisma, rootH.id, { title: 'H-c1', dueDate: dueDate(35) });
  const h2 = await createSubMilestone(prisma, rootH.id, { title: 'H-c2', dueDate: dueDate(36) });
  await updateMilestone(prisma, projectId, h1.id, { status: 'blocked' });
  await updateMilestone(prisma, projectId, h2.id, { status: 'done' });
  const rootHBefore = await prisma.milestone.findUnique({ where: { id: rootH.id } });
  assert.equal(rootHBefore.status, 'blocked', 'parent blocked before soft-delete');
  await deleteMilestone(prisma, projectId, h1.id);
  const rootHAfter = await prisma.milestone.findUnique({ where: { id: rootH.id } });
  assert.equal(rootHAfter.status, 'done', 'parent re-rolled up to done after soft-delete of blocked child');
  console.log('  ✓ soft-delete child → parent rollup re-evaluated');

  // Case 10 — listSubMilestones returns direct children + grandchildren nested.
  const rootI = await mkRoot(projectId, 'root-I');
  const i1 = await createSubMilestone(prisma, rootI.id, { title: 'I-c1', dueDate: dueDate(35) });
  await createSubMilestone(prisma, rootI.id, { title: 'I-c2', dueDate: dueDate(36) });
  await createSubMilestone(prisma, i1.id,   { title: 'I-c1-g1', dueDate: dueDate(40) });
  const subs = await listSubMilestones(prisma, rootI.id);
  assert.equal(subs.length, 2, 'two direct children');
  const i1Loaded = subs.find((s) => s.id === i1.id);
  assert.ok(i1Loaded, 'i1 present in listing');
  assert.equal(i1Loaded.children?.length ?? 0, 1, 'i1 has one nested grandchild');
  assert.equal(i1Loaded.children[0].title, 'I-c1-g1', 'grandchild title matches');
  console.log('  ✓ listSubMilestones returns children + grandchildren nested');

  console.log('\n✅ All DH12 milestone hierarchy tests passed.\n');
} finally {
  await teardown([projectId, project2Id]);
  await prisma.$disconnect();
}
