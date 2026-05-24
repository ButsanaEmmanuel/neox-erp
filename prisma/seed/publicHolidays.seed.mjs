// DH2 — RDC (Congo) public holidays for 2025 + 2026.
// Idempotent: upsert by (date, country). Re-run safe.
//
// Easter dates hardcoded:
//   2025: Sunday 20 April  → Good Friday 18 Apr, Easter Monday 21 Apr, Ascension 29 May
//   2026: Sunday  5 April  → Good Friday  3 Apr, Easter Monday  6 Apr, Ascension 14 May
// (Re-seed each year as new years are added — no general computus needed.)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COUNTRY = 'CD';

// Fixed-date holidays repeated each year.
const FIXED = [
  { md: '01-01', name: 'Nouvel An' },
  { md: '01-04', name: 'Journée des Martyrs de l\'Indépendance' },
  { md: '01-16', name: 'Journée des Héros Nationaux (Laurent-Désiré Kabila)' },
  { md: '01-17', name: 'Journée des Héros Nationaux (Patrice Lumumba)' },
  { md: '05-01', name: 'Fête du Travail' },
  { md: '05-17', name: 'Journée de Libération Nationale' },
  { md: '06-30', name: 'Fête de l\'Indépendance' },
  { md: '08-01', name: 'Fête des Parents' },
  { md: '12-25', name: 'Noël' },
];

// Movable holidays — pre-computed per year.
const MOVABLE = {
  2025: [
    { date: '2025-04-18', name: 'Vendredi Saint' },
    { date: '2025-04-21', name: 'Lundi de Pâques' },
    { date: '2025-05-29', name: 'Ascension' },
  ],
  2026: [
    { date: '2026-04-03', name: 'Vendredi Saint' },
    { date: '2026-04-06', name: 'Lundi de Pâques' },
    { date: '2026-05-14', name: 'Ascension' },
  ],
};

const YEARS = [2025, 2026];

function buildEntries() {
  const out = [];
  for (const year of YEARS) {
    for (const { md, name } of FIXED) {
      out.push({ date: new Date(`${year}-${md}T00:00:00.000Z`), name });
    }
    for (const { date, name } of MOVABLE[year]) {
      out.push({ date: new Date(`${date}T00:00:00.000Z`), name });
    }
  }
  return out;
}

async function main() {
  const entries = buildEntries();
  const before = await prisma.publicHoliday.count({ where: { country: COUNTRY } });
  for (const entry of entries) {
    await prisma.publicHoliday.upsert({
      where: { date_country: { date: entry.date, country: COUNTRY } },
      create: { date: entry.date, name: entry.name, country: COUNTRY, isActive: true },
      update: { name: entry.name, isActive: true },
    });
  }
  const after = await prisma.publicHoliday.count({ where: { country: COUNTRY } });
  const created = after - before;
  const reasserted = entries.length - created;
  console.log(`PublicHoliday seed (${COUNTRY}): ${entries.length} processed · ${created} created · ${reasserted} re-asserted`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
