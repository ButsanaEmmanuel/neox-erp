import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${table}"')::text AS reg`);
  return Array.isArray(rows) && rows[0] && rows[0].reg;
}

async function truncateIfExists(table) {
  const exists = await tableExists(table);
  if (!exists) return false;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
  return true;
}

async function main() {
  const truncated = [];

  // Core SCM table in current schema
  if (await truncateIfExists('PurchaseRequest')) truncated.push('PurchaseRequest');

  // Optional: clear SCM-only domain events / audit rows when present
  if (await tableExists('AuditLog')) {
    await prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE module = 'scm'`);
  }

  if (await tableExists('DomainEvent')) {
    await prisma.$executeRawUnsafe(`DELETE FROM "DomainEvent" WHERE "eventType" LIKE 'scm.%'`);
  }

  const checks = {};
  if (await tableExists('PurchaseRequest')) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "PurchaseRequest"`);
    checks.PurchaseRequest = rows[0].c;
  }

  console.log(JSON.stringify({ truncated, checks }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
