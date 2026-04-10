import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = 'ebutsana@neox.io';
const PASSWORD = 'Neox2026@Secure';

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

try {
  const email = EMAIL.trim().toLowerCase();
  const passwordHash = hashPassword(PASSWORD);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      username: email,
      passwordHash,
      isActive: true,
      hasSystemAccess: true,
      forcePasswordChange: false,
      emailVerified: new Date()
    },
    create: {
      email,
      username: email,
      name: 'System Administrator',
      passwordHash,
      isActive: true,
      hasSystemAccess: true,
      forcePasswordChange: false,
      emailVerified: new Date(),
      isDeleted: false
    }
  });

  const role = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'System Administrator', isActive: true, isDeleted: false },
    create: { code: 'ADMIN', name: 'System Administrator', isActive: true, isDeleted: false }
  });

  const link = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, validTo: null }
  });

  if (!link) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id, validFrom: new Date() }
    });
  }

  console.log('Admin user fixed:', email);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
