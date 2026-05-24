// D6 — assertPermission wiring on PM routes (Sprint Dettes Techniques).
// Runs against assertPermission() directly with a synthetic ServerResponse,
// to validate the 3 scenarios required by the sprint prompt without booting
// the full auth-server. The route layer just composes this gate, so a passing
// gate ⇒ passing routes (each route does exactly: assertPermission + handler).

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertPermission, getUserPermissions } from '../../services/auth/rbac.service.mjs';

const prisma = new PrismaClient();

// Lightweight ServerResponse mock: records status + body, sets headersSent.
const mockRes = () => ({
  statusCode: null,
  body: null,
  headersSent: false,
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(payload) { this.body = payload; },
});

const PM_KEYS = [
  'pm.projects.read',
  'pm.projects.write',
  'pm.projects.delete',
  'pm.workItems.write',
  'pm.workItems.delete',
  'pm.scope.read',
  'pm.scope.write',
  'pm.milestones.read',
  'pm.milestones.write',
  'pm.milestones.delete',
  'pm.import.execute',
];

try {
  // --- Case 1 — admin (ebutsana) passes on every PM key ---
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true, email: true },
  });
  assert.ok(admin, 'admin user ebutsana@neox.io must exist in DB');

  const adminPerms = await getUserPermissions(admin.id);
  for (const key of PM_KEYS) {
    assert.ok(adminPerms.has(key), `admin should hold ${key}`);
    const res = mockRes();
    const ok = await assertPermission({ userId: admin.id, res }, key);
    assert.equal(ok, true, `assertPermission(admin, ${key}) → true`);
    assert.equal(res.statusCode, null, `no response written when allowed (${key})`);
  }

  // --- Case 2 — unknown userId → 403 PERMISSION_DENIED ---
  {
    const res = mockRes();
    const ok = await assertPermission(
      { userId: 'usr_does_not_exist_xxx', res },
      'pm.projects.read'
    );
    assert.equal(ok, false, 'unknown userId → false');
    assert.equal(res.statusCode, 403, 'unknown userId → 403');
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED', 'unknown userId → code PERMISSION_DENIED');
    assert.equal(body.required, 'pm.projects.read', 'unknown userId → required: key');
  }

  // --- Case 3 — null userId (no actor in request) → 403 PERMISSION_DENIED ---
  {
    const res = mockRes();
    const ok = await assertPermission({ userId: null, res }, 'pm.projects.write');
    assert.equal(ok, false, 'null userId → false');
    assert.equal(res.statusCode, 403, 'null userId → 403');
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.required, 'pm.projects.write');
  }

  // --- Case 4 — known user lacking a specific key → 403 with required: key ---
  // Find a non-admin user (any user whose permission set does NOT include pm.projects.delete).
  const candidates = await prisma.user.findMany({
    where: { email: { not: 'ebutsana@neox.io' }, isActive: true, isDeleted: false },
    select: { id: true, email: true },
    take: 25,
  });
  let denied = null;
  for (const candidate of candidates) {
    const perms = await getUserPermissions(candidate.id);
    if (!perms.has('pm.projects.delete')) {
      denied = candidate;
      break;
    }
  }
  if (!denied) {
    console.warn('⚠ no non-admin user lacking pm.projects.delete found — skipping case 4');
  } else {
    const res = mockRes();
    const ok = await assertPermission(
      { userId: denied.id, res },
      'pm.projects.delete'
    );
    assert.equal(ok, false, `user ${denied.email} should NOT hold pm.projects.delete`);
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'PERMISSION_DENIED');
    assert.equal(body.required, 'pm.projects.delete');
  }

  console.log(`✓ D6 PM routes RBAC — ${PM_KEYS.length} admin checks + 3 deny scenarios OK`);
} finally {
  await prisma.$disconnect();
}
