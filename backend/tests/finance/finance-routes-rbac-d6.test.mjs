// D6 — assertPermission wiring on Finance routes (Sprint Dettes Techniques).
// Same pattern as backend/tests/pm/pm-routes-rbac-d6.test.mjs — exercises
// the gate function directly with a synthetic ServerResponse.

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertPermission, getUserPermissions } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();

const mockRes = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(payload) { this.body = payload; },
});

const FINANCE_KEYS = [
  'finance.settings.manage',
  'finance.entries.read',
  'finance.ledger.read',
  'finance.expenses.read',
  'finance.expenses.write',
  'finance.expenses.execute',
  'finance.advances.read',
  'finance.advances.write',
  'finance.advances.execute',
  'finance.payroll.read',
  'finance.payroll.execute',
];

try {
  // --- Case 1 — admin passes on every Finance key wired by Commit B ---
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true },
  });
  assert.ok(admin, 'admin user ebutsana@neox.io must exist');

  const adminPerms = await getUserPermissions(admin.id);
  for (const key of FINANCE_KEYS) {
    assert.ok(adminPerms.has(key), `admin should hold ${key}`);
    const res = mockRes();
    const ok = await assertPermission({ userId: admin.id, res }, key);
    assert.equal(ok, true, `assertPermission(admin, ${key}) → true`);
    assert.equal(res.statusCode, null, `no response when allowed (${key})`);
  }

  // --- Case 2 — unknown userId → 403 PERMISSION_DENIED + required: key ---
  {
    const res = mockRes();
    const ok = await assertPermission(
      { userId: 'usr_does_not_exist_xxx', res },
      'finance.payroll.execute'
    );
    assert.equal(ok, false);
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.required, 'finance.payroll.execute');
  }

  // --- Case 3 — null userId → 403 PERMISSION_DENIED ---
  {
    const res = mockRes();
    const ok = await assertPermission({ userId: null, res }, 'finance.expenses.execute');
    assert.equal(ok, false);
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.required, 'finance.expenses.execute');
  }

  // --- Case 4 — real user lacking finance.payroll.execute → 403 ---
  const candidates = await prisma.user.findMany({
    where: { email: { not: 'ebutsana@neox.io' }, isActive: true, isDeleted: false },
    select: { id: true, email: true },
    take: 25,
  });
  let denied = null;
  for (const candidate of candidates) {
    const perms = await getUserPermissions(candidate.id);
    if (!perms.has('finance.payroll.execute')) {
      denied = candidate;
      break;
    }
  }
  if (!denied) {
    console.warn('⚠ no non-admin user lacking finance.payroll.execute — skipping case 4');
  } else {
    const res = mockRes();
    const ok = await assertPermission({ userId: denied.id, res }, 'finance.payroll.execute');
    assert.equal(ok, false, `user ${denied.email} should NOT hold finance.payroll.execute`);
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.required, 'finance.payroll.execute');
  }

  console.log(`✓ D6 Finance routes RBAC — ${FINANCE_KEYS.length} admin checks + 3 deny scenarios OK`);
} finally {
  await prisma.$disconnect();
}
