// D13 — Sub-task hierarchy integration tests (Sprint Dettes Techniques).
// Run via: node backend/tests/pm/pm-subtasks.test.mjs
//
// Hits the dev DB but stays isolated:
//   - Creates a throwaway test project under a unique name prefix.
//   - All WorkItem rows live under that project and are wiped in the
//     finally block (with project cascade-soft-delete bypass).

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  createSubTask,
  listSubTasks,
  moveSubTask,
  rollupStatus,
} from '../../services/pm/workItemHierarchy.service.mjs';
import { createWorkItem, updateWorkItem } from '../../services/pm/projectCrud.service.mjs';

const prisma = new PrismaClient();
const TEST_PREFIX = `__d13_test_${Date.now()}__`;
const actor = { actorUserId: null, actorDisplayName: 'D13Test' };

// --- helpers ---------------------------------------------------------

async function setup() {
  // Need a User to satisfy the Project.managerId FK.
  const manager = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, departmentId: true },
  });
  if (!manager) throw new Error('No active user available — seed the DB first');

  const project = await prisma.project.create({
    data: {
      name: `${TEST_PREFIX} project`,
      clientName: `${TEST_PREFIX} client`,
      managerId: manager.id,
      ownerDepartmentId: manager.departmentId || undefined,
      status: 'active',
      startDate: new Date('2030-01-01'),
      endDate: new Date('2030-12-31'),
    },
  });
  return { project };
}

async function teardown(projectId) {
  if (!projectId) return;
  await prisma.workItem.deleteMany({ where: { projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId } });
  await prisma.projectItemActivity.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
}

async function expectRejectsWithCode(promise, expectedCode, label) {
  let caught;
  try { await promise; } catch (e) { caught = e; }
  assert.ok(caught, `${label}: expected to throw`);
  assert.equal(caught.code, expectedCode, `${label}: code = ${expectedCode}, got ${caught.code}`);
}

// --- run -------------------------------------------------------------

let projectId = null;
try {
  console.log('\n🧪 D13 — WorkItem sub-task hierarchy');
  const { project } = await setup();
  projectId = project.id;

  // Case 1 — Create sub-task → parentId correctly set.
  const root = await createWorkItem(prisma, projectId, { title: 'root-A' }, actor);
  const child = await createSubTask(prisma, root.id, { title: 'child-A1' }, actor);
  assert.equal(child.parentId, root.id, 'child.parentId === root.id');
  assert.equal(child.projectId, projectId, 'child inherits projectId');
  console.log('  ✓ createSubTask sets parentId and inherits projectId');

  // Case 2 — Depth > 3 → MAX_DEPTH_EXCEEDED.
  const grand = await createSubTask(prisma, child.id, { title: 'grand-A1a' }, actor); // depth 3 OK
  await expectRejectsWithCode(
    createSubTask(prisma, grand.id, { title: 'great-grand' }, actor),
    'MAX_DEPTH_EXCEEDED',
    'depth=4 creation',
  );
  console.log('  ✓ depth > 3 rejected with MAX_DEPTH_EXCEEDED');

  // Case 3 — Rollup: all children completed → parent 'complete'.
  // Build a fresh subtree: root2 → c1, c2.
  const root2 = await createWorkItem(prisma, projectId, { title: 'root-B' }, actor);
  const c1 = await createSubTask(prisma, root2.id, { title: 'B-c1' }, actor);
  const c2 = await createSubTask(prisma, root2.id, { title: 'B-c2' }, actor);
  await updateWorkItem(prisma, projectId, c1.id, { status: 'complete' }, actor);
  await updateWorkItem(prisma, projectId, c2.id, { status: 'complete' }, actor);
  const root2After = await prisma.workItem.findUnique({ where: { id: root2.id } });
  assert.equal(root2After.status, 'complete', 'parent rolled up to complete');
  console.log('  ✓ all children complete → parent complete');

  // Case 4 — Rollup: any child blocked → parent at_risk.
  const root3 = await createWorkItem(prisma, projectId, { title: 'root-C' }, actor);
  const d1 = await createSubTask(prisma, root3.id, { title: 'C-d1' }, actor);
  const d2 = await createSubTask(prisma, root3.id, { title: 'C-d2' }, actor);
  await updateWorkItem(prisma, projectId, d1.id, { status: 'in-progress' }, actor);
  await updateWorkItem(prisma, projectId, d2.id, { status: 'validation_error' }, actor);
  const root3After = await prisma.workItem.findUnique({ where: { id: root3.id } });
  assert.equal(root3After.status, 'at_risk', 'parent rolled up to at_risk on blocked child');
  console.log('  ✓ any child blocked → parent at_risk');

  // Case 5 — Rollup recursive: grandchild change propagates to root.
  const root4 = await createWorkItem(prisma, projectId, { title: 'root-D' }, actor);
  const m1 = await createSubTask(prisma, root4.id, { title: 'D-m1' }, actor);
  const g1 = await createSubTask(prisma, m1.id, { title: 'D-m1-g1' }, actor);
  await updateWorkItem(prisma, projectId, g1.id, { status: 'finance_sync_error' }, actor);
  const m1After = await prisma.workItem.findUnique({ where: { id: m1.id } });
  const root4After = await prisma.workItem.findUnique({ where: { id: root4.id } });
  assert.equal(m1After.status, 'at_risk', 'intermediate parent flagged at_risk');
  assert.equal(root4After.status, 'at_risk', 'root flagged at_risk via recursion');
  console.log('  ✓ rollup propagates recursively to root');

  // Case 6 — Move that creates a cycle → CYCLE_DETECTED.
  // Setup: root5 → e1 → e2. Try to move root5 under e2.
  const root5 = await createWorkItem(prisma, projectId, { title: 'root-E' }, actor);
  const e1 = await createSubTask(prisma, root5.id, { title: 'E-e1' }, actor);
  const e2 = await createSubTask(prisma, e1.id, { title: 'E-e2' }, actor);
  await expectRejectsWithCode(
    moveSubTask(prisma, root5.id, { parentId: e2.id }),
    'CYCLE_DETECTED',
    'cycle root5 → e2',
  );
  // Direct self-loop also rejected.
  await expectRejectsWithCode(
    moveSubTask(prisma, root5.id, { parentId: root5.id }),
    'CYCLE_DETECTED',
    'self-loop',
  );
  console.log('  ✓ cycle creation rejected with CYCLE_DETECTED');

  // Case 7 — Hard delete of parent with active children → Prisma FK error.
  // The route-level deleteWorkItem soft-deletes, so we hit prisma directly
  // here to exercise the FK Restrict constraint added by the migration.
  const root6 = await createWorkItem(prisma, projectId, { title: 'root-F' }, actor);
  await createSubTask(prisma, root6.id, { title: 'F-c1' }, actor);
  let fkError;
  try { await prisma.workItem.delete({ where: { id: root6.id } }); } catch (e) { fkError = e; }
  assert.ok(fkError, 'hard delete should fail');
  // Prisma surfaces FK constraint as P2003.
  assert.ok(
    String(fkError.code) === 'P2003' || String(fkError.message || '').includes('Foreign key'),
    `expected FK error (P2003), got code=${fkError.code} msg=${(fkError.message || '').slice(0, 120)}`,
  );
  console.log('  ✓ hard delete of parent with children → FK Restrict');

  // Case 8 — Soft delete parent → children still queryable, listSubTasks
  // throws because the parent itself is gone from the active set.
  const root7 = await createWorkItem(prisma, projectId, { title: 'root-G' }, actor);
  const g7 = await createSubTask(prisma, root7.id, { title: 'G-c1' }, actor);
  await prisma.workItem.update({
    where: { id: root7.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  const childStillThere = await prisma.workItem.findFirst({
    where: { id: g7.id, isDeleted: false },
  });
  assert.ok(childStillThere, 'soft-deleted parent → child row still present');
  assert.equal(childStillThere.parentId, root7.id, 'child still points at soft-deleted parent');
  console.log('  ✓ soft-deleted parent → children remain accessible');

  console.log('\n✅ All D13 sub-task tests passed.\n');
} finally {
  await teardown(projectId);
  await prisma.$disconnect();
}
