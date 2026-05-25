// Diagnostic read-only : confirme l'hypothèse A (DB pas re-seedée) ou B (admin sur mauvais rôle)
// pour le bug "POST /api/v1/crm/clients renvoie 403 en admin".

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function header(title) {
  console.log('\n' + '═'.repeat(72));
  console.log(' ' + title);
  console.log('═'.repeat(72));
}

try {
  header('1. Permissions CRM présentes en DB');
  const crmPerms = await prisma.permission.findMany({
    where: { module: 'crm' },
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });
  console.log(`Total: ${crmPerms.length}`);
  for (const p of crmPerms) {
    console.log(`  - key="${p.key}" (module=${p.module}/resource=${p.resource}/action=${p.action}) active=${p.isActive}`);
  }
  const hasClientsWrite = crmPerms.some((p) => p.key === 'crm.clients.write');
  console.log(`\n>> crm.clients.write présente en DB : ${hasClientsWrite ? '✅ OUI' : '❌ NON (hypothèse A confirmée)'}`);

  header('2. Utilisateurs candidats admin');
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'admin', mode: 'insensitive' } },
        { email: { contains: 'butsana', mode: 'insensitive' } },
        { email: { contains: 'ebutsana', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, name: true, isDeleted: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Trouvés : ${candidates.length}`);
  for (const u of candidates) {
    console.log(`  - id=${u.id}  email=${u.email}  name="${u.name}"  deleted=${u.isDeleted}  created=${u.createdAt.toISOString()}`);
  }

  if (candidates.length === 0) {
    console.log('\n⚠ Aucun utilisateur admin/butsana trouvé. Liste des 5 premiers users :');
    const firstFive = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true },
    });
    for (const u of firstFive) console.log(`    ${u.email} — ${u.name}`);
  }

  header('3. Rôles + permissions effectives par candidat');
  const now = new Date();
  for (const u of candidates) {
    console.log(`\n--- ${u.email} (id=${u.id}) ---`);

    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: u.id,
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (userRoles.length === 0) {
      console.log('  ⚠ Aucun rôle actif assigné — utilisateur sans permissions');
      continue;
    }

    const allKeys = new Set();
    for (const ur of userRoles) {
      const roleCode = ur.role.code;
      const roleName = ur.role.name;
      const isActive = ur.role.isActive;
      const isDeleted = ur.role.isDeleted;
      const permCount = ur.role.permissions.length;
      console.log(`  • role code=${roleCode}  name=${roleName}  active=${isActive}  deleted=${isDeleted}  permissions=${permCount}`);
      for (const rp of ur.role.permissions) {
        if (rp.permission && rp.permission.isActive) allKeys.add(rp.permission.key);
      }
    }

    const crmKeys = [...allKeys].filter((k) => k.startsWith('crm.') || k.startsWith('crm:')).sort();
    console.log(`  CRM keys effectives (${crmKeys.length}): ${crmKeys.join(', ') || '(aucune)'}`);
    console.log(`  >> crm.clients.write effective : ${allKeys.has('crm.clients.write') ? '✅ OUI' : '❌ NON'}`);
  }

  header('4. Inventaire des rôles');
  const roles = await prisma.role.findMany({
    select: { code: true, name: true, isActive: true, isDeleted: true, _count: { select: { permissions: true } } },
    orderBy: { code: 'asc' },
  });
  for (const r of roles) {
    console.log(`  - code=${r.code.padEnd(25)} name=${(r.name || '').padEnd(25)} permissions=${r._count.permissions}  active=${r.isActive}  deleted=${r.isDeleted}`);
  }
} catch (err) {
  console.error('\n❌ Diagnostic failed:', err.message);
  console.error(err.stack);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
