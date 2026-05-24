// DH7 — UserColumnPreference service smoke tests (Sprint Dettes Techniques).
// Hits the dev DB; cleans up after itself.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  getColumnPreference,
  setColumnPreference,
  CONTEXT_REGISTRY,
} from '../../services/preferences/columnPreferences.service.mjs';

const prisma = new PrismaClient();

async function expectThrowsCode(promise, expectedCode, label) {
  let caught;
  try { await promise; } catch (e) { caught = e; }
  assert.ok(caught, `${label}: expected to throw`);
  assert.equal(caught.code, expectedCode, `${label}: code = ${expectedCode}, got ${caught.code}`);
}

let userId = null;
try {
  console.log('\n🧪 DH7 — UserColumnPreference service');
  const user = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!user) throw new Error('No active user available');
  userId = user.id;
  // Clean any leftover from a previous failed run.
  await prisma.userColumnPreference.deleteMany({
    where: { userId, context: 'telecom_workitems' },
  });

  const defaults = CONTEXT_REGISTRY.telecom_workitems.defaults;

  // Case 1 — no row → defaults returned.
  const fresh = await getColumnPreference(prisma, userId, 'telecom_workitems');
  assert.deepEqual(fresh.columns, defaults, 'no row → defaults');
  console.log('  ✓ no preference row → returns the 9 defaults');

  // Case 2 — set a custom column list.
  const custom = ['site_id', 'site_name', 'team', 'comment'];
  const saved = await setColumnPreference(prisma, userId, { context: 'telecom_workitems', columns: custom });
  assert.deepEqual(saved.columns, custom, 'set returns the same list');
  const reloaded = await getColumnPreference(prisma, userId, 'telecom_workitems');
  assert.deepEqual(reloaded.columns, custom, 're-fetch returns saved list');
  console.log('  ✓ set + get round-trip persists order');

  // Case 3 — dedupe + reorder on second save.
  const dup = ['comment', 'site_id', 'site_id', 'team'];
  const saved2 = await setColumnPreference(prisma, userId, { context: 'telecom_workitems', columns: dup });
  assert.deepEqual(saved2.columns, ['comment', 'site_id', 'team'], 'duplicates silently dropped, order preserved');
  console.log('  ✓ duplicates dropped, order preserved');

  // Case 4 — unknown column key → UNKNOWN_COLUMN_KEY.
  await expectThrowsCode(
    setColumnPreference(prisma, userId, { context: 'telecom_workitems', columns: ['site_id', 'bogus_column'] }),
    'UNKNOWN_COLUMN_KEY',
    'unknown column',
  );

  // Case 5 — empty array rejected.
  await expectThrowsCode(
    setColumnPreference(prisma, userId, { context: 'telecom_workitems', columns: [] }),
    'EMPTY_COLUMNS',
    'empty columns',
  );

  // Case 6 — unknown context → UNKNOWN_CONTEXT.
  await expectThrowsCode(
    getColumnPreference(prisma, userId, 'unknown_table'),
    'UNKNOWN_CONTEXT',
    'unknown context (get)',
  );
  await expectThrowsCode(
    setColumnPreference(prisma, userId, { context: 'unknown_table', columns: ['site_id'] }),
    'UNKNOWN_CONTEXT',
    'unknown context (set)',
  );

  // Case 7 — missing userId on save → USER_ID_REQUIRED.
  await expectThrowsCode(
    setColumnPreference(prisma, null, { context: 'telecom_workitems', columns: ['site_id'] }),
    'USER_ID_REQUIRED',
    'null userId on save',
  );

  // Case 8 — null userId on read still returns defaults (server-side it
  // shouldn't happen because the route enforces auth, but the service must
  // not crash if it does).
  const anon = await getColumnPreference(prisma, null, 'telecom_workitems');
  assert.deepEqual(anon.columns, defaults, 'null userId on get → defaults');
  console.log('  ✓ validation errors surface with structured codes');

  console.log('\n✅ All DH7 column-preferences tests passed.\n');
} finally {
  if (userId) {
    await prisma.userColumnPreference.deleteMany({
      where: { userId, context: 'telecom_workitems' },
    });
  }
  await prisma.$disconnect();
}
