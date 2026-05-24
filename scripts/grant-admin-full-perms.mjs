// One-shot: ensure ebutsana@neox.io (super_admin) holds every Permission
// row defined in the registry. The seeded role grant was incomplete — admin
// was missing 10+ finance.* keys that exist in the registry but were never
// assigned (notably finance.settings.manage, finance.entries.read).
//
// Idempotent: upserts (userId, module, resource, action) → no-op on re-run.
// Run via:  node scripts/grant-admin-full-perms.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const admin = await prisma.user.findFirst({
    where: { email: 'ebutsana@neox.io' },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('admin user ebutsana@neox.io not found — aborting');
    process.exit(1);
  }

  const allPerms = await prisma.permission.findMany({
    select: { id: true, key: true, module: true, resource: true, action: true },
  });

  let created = 0;
  let skipped = 0;
  for (const perm of allPerms) {
    const result = await prisma.userPermissionSet.upsert({
      where: {
        userId_module_resource_action: {
          userId: admin.id,
          module: perm.module,
          resource: perm.resource,
          action: perm.action,
        },
      },
      create: {
        userId: admin.id,
        module: perm.module,
        resource: perm.resource,
        action: perm.action,
        effect: 'allow',
        permissionId: perm.id,
        reason: 'super_admin full grant (D6 closure 2026-05-24)',
        isActive: true,
      },
      update: { isActive: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    else skipped += 1;
  }

  console.log(`Admin: ${admin.email} (${admin.id})`);
  console.log(`Registry size: ${allPerms.length} permissions`);
  console.log(`Granted (new): ${created}`);
  console.log(`Re-asserted (existing): ${skipped}`);
} finally {
  await prisma.$disconnect();
}
