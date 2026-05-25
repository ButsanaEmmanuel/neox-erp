// Seed 5 demo receivables across all aging buckets for visual QA of
// ReceivablesPage's aging report.
//
// Usage:
//   node scripts/seed-aging-demo-receivables.mjs           # create
//   node scripts/seed-aging-demo-receivables.mjs --wipe    # remove demo
//
// Idempotent : uses a PREFIX so re-running create-mode is safe (it skips
// existing rows). The wipe mode removes everything matching the PREFIX.
//
// Created receivables span 3 demo clients to validate the aging pivot:
//   - Acme Corp:        current, 31-60
//   - Globex Ltd:       1-30, 90+
//   - Initech LLC:      61-90

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIX = '__aging_demo__';

const DEMOS = [
  { client: 'Acme Corp',    total: 1500, daysUntilDue:  10, label: 'current' },   // +10d
  { client: 'Globex Ltd',   total: 2200, daysUntilDue: -15, label: '1-30' },      // 15d overdue
  { client: 'Acme Corp',    total:  800, daysUntilDue: -45, label: '31-60' },     // 45d overdue
  { client: 'Initech LLC',  total: 4500, daysUntilDue: -75, label: '61-90' },     // 75d overdue
  { client: 'Globex Ltd',   total: 3100, daysUntilDue: -120, label: '90+' },      // 120d overdue
];

const WIPE_MODE = process.argv.includes('--wipe');

function dueDateFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function wipe() {
  console.log(`Wiping demo aging data (PREFIX=${PREFIX})...`);

  const entries = await prisma.financeEntry.findMany({
    where: { sourceModule: 'aging_demo' },
    select: { id: true },
  });
  const entryIds = entries.map((e) => e.id);
  if (entryIds.length === 0) {
    console.log('  Nothing to wipe.');
    return;
  }

  const activities = await prisma.financeActivity.deleteMany({
    where: { financeEntryId: { in: entryIds } },
  });
  const receivables = await prisma.receivable.deleteMany({
    where: { financeEntryId: { in: entryIds } },
  });
  const entriesDel = await prisma.financeEntry.deleteMany({
    where: { id: { in: entryIds } },
  });

  console.log(`  Removed: ${entriesDel.count} entries, ${receivables.count} receivables, ${activities.count} activities.`);
}

async function seed() {
  console.log(`Seeding ${DEMOS.length} demo receivables (PREFIX=${PREFIX})...`);

  // The GET /receivables route scopes by project membership when userId
  // is passed. Demo rows with projectId=null get filtered out. Pick the
  // first project ebutsana (super_admin) is a member of so the demo rows
  // appear in her UI; fall back to first project if she has no membership.
  const admin = await prisma.user.findFirst({ where: { email: 'ebutsana@neox.io' }, select: { id: true } });
  let demoProjectId = null;
  if (admin) {
    const membership = await prisma.projectMember.findFirst({
      where: { userId: admin.id, isDeleted: false },
      select: { projectId: true },
      orderBy: { createdAt: 'asc' },
    });
    demoProjectId = membership?.projectId ?? null;
  }
  if (!demoProjectId) {
    const anyProject = await prisma.project.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    demoProjectId = anyProject?.id ?? null;
  }
  if (!demoProjectId) {
    console.warn('  ⚠ No project found to attach demo receivables to.');
  } else {
    console.log(`  Using projectId=${demoProjectId}.`);
    console.log(`  ⚠ NOTE: GET /receivables scopes by ProjectMember.userId. Demo rows`);
    console.log(`     appear in the UI only for users with membership on this project.`);
    console.log(`     Super_admin currently does NOT bypass this scope — pre-existing`);
    console.log(`     UX limitation, worth a future ticket (DF11 candidate).`);
  }

  let created = 0;
  let skipped = 0;

  for (const [i, demo] of DEMOS.entries()) {
    const refSuffix = `${PREFIX}${i + 1}_${demo.label}`;
    const existing = await prisma.financeEntry.findUnique({
      where: { referenceCode: `FE_${refSuffix}` },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const financeEntry = await prisma.financeEntry.create({
      data: {
        referenceCode: `FE_${refSuffix}`,
        entryType: 'receivable',
        direction: 'inflow',
        title: `${demo.client} — demo receivable (${demo.label})`,
        currencyCode: 'USD',
        amount: demo.total,
        sourceModule: 'aging_demo',
        sourceEntity: 'demo_seed',
        sourceEntityId: refSuffix,
        sourceEvent: 'seed_script',
        projectId: demoProjectId,
        lifecycleStatus: 'active',
        approvalStatus: 'approved',
        evidenceStatus: 'required_missing',
        settlementStatus: 'open',
      },
    });

    const due = dueDateFromNow(demo.daysUntilDue);
    const isOverdue = demo.daysUntilDue < 0;

    await prisma.receivable.create({
      data: {
        financeEntryId: financeEntry.id,
        referenceCode: `REC_${refSuffix}`,
        clientName: demo.client,
        totalAmount: demo.total,
        outstandingAmount: demo.total,
        collectedAmount: 0,
        dueDate: due,
        status: 'open',
        collectionStatus: isOverdue ? 'overdue' : 'pending_collection',
        isOverdue,
        projectId: demoProjectId,
      },
    });

    created += 1;
    console.log(`  + ${demo.client.padEnd(15)} ${demo.label.padEnd(8)} due=${due.toISOString().slice(0, 10)} total=${demo.total}`);
  }

  console.log(`Done: ${created} created, ${skipped} skipped (already exist).`);
  console.log('Switch ReceivablesPage to Aging view to see the colored pivot.');
}

try {
  if (WIPE_MODE) {
    await wipe();
  } else {
    await seed();
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
