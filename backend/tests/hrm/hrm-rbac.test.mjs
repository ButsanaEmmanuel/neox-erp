// HRM-2.7 — Integration tests for the RBAC resolution layer.
//
// Run with: node backend/tests/hrm/hrm-rbac.test.mjs
// or         npm run test:hrm-rbac
//
// Coverage:
//   1. Fresh user with no role → assertPermission denies + 403 body
//   2. Override effect="allow" adds a permission on top of the role
//   3. Override effect="deny" removes a permission the role grants
//   4. Expired override is ignored (expiresAt < now)
//   5. invalidateCache forces a fresh resolve on the next lookup

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  assertPermission,
  getUserPermissions,
  hasPermission,
  invalidateCache,
} from '../../services/auth/rbac.service.mjs';
import {
  assignRoleToUser,
  revokeUserRole,
  upsertUserOverride,
  removeUserOverride,
} from '../../services/hrm/rbacAdmin.service.mjs';

const prisma = new PrismaClient();
const RUN = Date.now();
const PREFIX = `__hrm_rbac_test_${RUN}__`;
const DOMAIN = `${RUN}.rbac-test.invalid`;

const TRACKED = { userIds: new Set(), roleIds: new Set() };

function fakeRes() {
  let status = null;
  let body = null;
  return {
    res: {
      headersSent: false,
      writeHead(s) { status = s; this.headersSent = true; },
      end(b) { body = b; },
    },
    get status() { return status; },
    get body() { return body ? JSON.parse(body) : null; },
  };
}

async function setup() {
  // A fresh user with NO role — used for the bare-403 path.
  const naked = await prisma.user.create({
    data: { email: `naked-${RUN}@${DOMAIN}`, name: `${PREFIX} naked`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(naked.id);

  // A user we'll attach a custom role to. The role grants ONE permission
  // (hrm.leave.read) so we can prove role-based resolution works.
  const roleUser = await prisma.user.create({
    data: { email: `role-${RUN}@${DOMAIN}`, name: `${PREFIX} role-user`, isActive: true, hasSystemAccess: true },
  });
  TRACKED.userIds.add(roleUser.id);

  const leaveReadPerm = await prisma.permission.findFirst({ where: { key: 'hrm.leave.read' } });
  const trainingReadPerm = await prisma.permission.findFirst({ where: { key: 'hrm.training.read' } });
  if (!leaveReadPerm || !trainingReadPerm) throw new Error('Seed missing hrm.leave.read / hrm.training.read');

  const role = await prisma.role.create({
    data: {
      code: `${PREFIX}role`, name: `${PREFIX}role`, label: 'Test minimal role',
      isActive: true, isSystem: false,
    },
  });
  TRACKED.roleIds.add(role.id);

  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: leaveReadPerm.id },
  });

  await assignRoleToUser(prisma, roleUser.id, role.id, { assignedBy: roleUser.id });

  return { naked, roleUser, role, leaveReadPerm, trainingReadPerm };
}

async function teardown() {
  for (const uid of TRACKED.userIds) {
    await prisma.userRole.deleteMany({ where: { userId: uid } });
    await prisma.userPermissionSet.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
    invalidateCache(uid);
  }
  for (const rid of TRACKED.roleIds) {
    await prisma.rolePermission.deleteMany({ where: { roleId: rid } });
    await prisma.userRole.deleteMany({ where: { roleId: rid } });
    await prisma.role.deleteMany({ where: { id: rid } });
  }
}

async function checkNakedUserDeniedEverywhere({ naked }) {
  const probe = fakeRes();
  const allowed = await assertPermission({ userId: naked.id, res: probe.res }, 'hrm.leave.read');
  assert.equal(allowed, false);
  assert.equal(probe.status, 403);
  assert.equal(probe.body.code, 'PERMISSION_DENIED');
  assert.equal(probe.body.required, 'hrm.leave.read');

  // Sanity: getUserPermissions returns an empty set, not undefined.
  const perms = await getUserPermissions(naked.id);
  assert.ok(perms instanceof Set);
  assert.equal(perms.size, 0);
  console.log('  ✓ user without any role → 403 PERMISSION_DENIED + empty permission set');
}

async function checkOverrideAllowAdds({ roleUser, trainingReadPerm }) {
  // The role only grants hrm.leave.read. Confirm hrm.training.read is
  // NOT there pre-override, then ADD it via an "allow" override.
  invalidateCache(roleUser.id);
  let perms = await getUserPermissions(roleUser.id);
  assert.ok(perms.has('hrm.leave.read'), 'role grants hrm.leave.read');
  assert.ok(!perms.has('hrm.training.read'), 'role does NOT grant hrm.training.read');

  await upsertUserOverride(prisma, roleUser.id, {
    permissionId: trainingReadPerm.id,
    effect: 'allow',
    reason: 'temp project access',
    assignedBy: roleUser.id,
  });
  // upsertUserOverride invalidates the cache internally.
  perms = await getUserPermissions(roleUser.id);
  assert.ok(perms.has('hrm.training.read'), 'override "allow" added the permission');
  console.log('  ✓ override effect="allow" adds a permission on top of the role');
}

async function checkOverrideDenyRemoves({ roleUser, leaveReadPerm }) {
  // Role grants leave.read. Add a "deny" override on the same key.
  await upsertUserOverride(prisma, roleUser.id, {
    permissionId: leaveReadPerm.id,
    effect: 'deny',
    reason: 'temporarily under review',
    assignedBy: roleUser.id,
  });
  const perms = await getUserPermissions(roleUser.id);
  assert.ok(!perms.has('hrm.leave.read'), 'deny override removes the role-granted permission');
  console.log('  ✓ override effect="deny" removes a permission even when the role grants it');

  // Restore so the next test sees the role grant cleanly.
  await removeUserOverride(prisma, roleUser.id, leaveReadPerm.id);
  invalidateCache(roleUser.id);
  const post = await getUserPermissions(roleUser.id);
  assert.ok(post.has('hrm.leave.read'), 'leave.read is back after deny override removed');
}

async function checkExpiredOverrideIgnored({ roleUser, trainingReadPerm }) {
  // Set the training.read override (still active from check #2) to expire
  // a minute ago. The resolver must filter it out.
  await prisma.userPermissionSet.updateMany({
    where: { userId: roleUser.id, permissionId: trainingReadPerm.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  invalidateCache(roleUser.id);
  const perms = await getUserPermissions(roleUser.id);
  assert.ok(!perms.has('hrm.training.read'), 'expired allow override is ignored');
  console.log('  ✓ override with expiresAt < now is ignored');

  // Cleanup so the next round-trip is clean.
  await removeUserOverride(prisma, roleUser.id, trainingReadPerm.id);
}

async function checkCacheInvalidationAfterRoleChange({ roleUser, role }) {
  // Warm the cache.
  let perms = await getUserPermissions(roleUser.id);
  assert.ok(perms.has('hrm.leave.read'));

  // Mutate UserRole DIRECTLY through prisma — bypassing rbacAdmin's
  // built-in invalidateCache call — so we can prove the cache really
  // is the gatekeeper. Setting validTo = now revokes the assignment
  // at the DB level.
  const active = await prisma.userRole.findFirst({
    where: { userId: roleUser.id, roleId: role.id, validTo: null },
  });
  assert.ok(active, 'an active UserRole exists pre-revoke');
  await prisma.userRole.update({ where: { id: active.id }, data: { validTo: new Date() } });

  // The cache still serves the pre-revoke set.
  perms = await getUserPermissions(roleUser.id);
  assert.ok(perms.has('hrm.leave.read'), 'cache still serves pre-revoke set (no invalidate yet)');

  // Now invalidate explicitly and confirm the next lookup is fresh.
  invalidateCache(roleUser.id);
  perms = await getUserPermissions(roleUser.id);
  assert.ok(!perms.has('hrm.leave.read'), 'after invalidateCache, the DB revocation is visible');

  // hasPermission goes through the same cache path.
  const hp = await hasPermission(roleUser.id, 'hrm.leave.read');
  assert.equal(hp, false);
  console.log('  ✓ invalidateCache forces the next getUserPermissions to re-resolve from DB');

  // Re-assign via the admin path (which invalidates) so any
  // downstream check would see the role back.
  void revokeUserRole;  // silence unused-import for the moment
  await assignRoleToUser(prisma, roleUser.id, role.id, { assignedBy: roleUser.id });
}

async function main() {
  console.log('🧪 HRM-2.7 — RBAC integration tests');
  console.log('');
  try {
    console.log('Setup:');
    const ctx = await setup();
    console.log(`  ✓ naked=${ctx.naked.email}, roleUser=${ctx.roleUser.email}, role=${ctx.role.code}`);
    console.log('');
    console.log('Integration:');
    await checkNakedUserDeniedEverywhere(ctx);
    await checkOverrideAllowAdds(ctx);
    await checkOverrideDenyRemoves(ctx);
    await checkExpiredOverrideIgnored(ctx);
    await checkCacheInvalidationAfterRoleChange(ctx);
    console.log('');
    console.log('✅ All HRM-2.7 RBAC tests passed.');
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
  console.error('❌ RBAC tests failed:', e);
  process.exit(1);
});
