// Seed des catégories finance (FinanceCategorySetting).
//
// Idempotent : upsert par `code`. À lancer avec :
//   node --env-file=.env prisma/seedFinanceCategories.mjs
//
// Les lignes de budget (BudgetLine) exigent une catégorie ACTIVE ; sans seed,
// aucun budget n'est exploitable. Les deux premières (cat_project_*) doivent
// exister pour que les écritures FinanceEntry déjà en base s'agrègent dans les
// budgets (jointure logique par `code`, cf. budgets.service.mjs [2]).
//
// Convention id = code (alignée sur financeSnapshot.service.mjs).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  // Recettes (inflow)
  { code: 'cat_project_receivables', name: 'Project Receivables', direction: 'inflow', description: 'Encaissements attendus sur PO projet complétés.' },
  { code: 'cat_client_revenue', name: 'Client Revenue', direction: 'inflow', description: 'Revenus facturés aux clients.' },
  // Dépenses (outflow)
  { code: 'cat_project_payables', name: 'Project Contractor Payables', direction: 'outflow', description: 'Sommes dues aux sous-traitants sur projets.' },
  { code: 'cat_salaries', name: 'Salaries & Wages', direction: 'outflow', description: 'Rémunération des employés.' },
  { code: 'cat_marketing', name: 'Marketing & Advertising', direction: 'outflow', description: 'Campagnes, publicité, événements.' },
  { code: 'cat_travel', name: 'Travel & Expenses', direction: 'outflow', description: 'Déplacements professionnels et per diem.' },
  { code: 'cat_equipment', name: 'Equipment & Supplies', direction: 'outflow', description: 'Matériel, outils, fournitures de bureau.' },
  { code: 'cat_services', name: 'Professional Services', direction: 'outflow', description: 'Consultants, juridique, audit.' },
  { code: 'cat_rent_utilities', name: 'Rent & Utilities', direction: 'outflow', description: 'Loyer, électricité, internet.' },
];

let created = 0;
let updated = 0;

try {
  for (const cat of CATEGORIES) {
    const existing = await prisma.financeCategorySetting.findUnique({ where: { code: cat.code } });
    await prisma.financeCategorySetting.upsert({
      where: { code: cat.code },
      update: { name: cat.name, direction: cat.direction, description: cat.description, isActive: true },
      create: { id: cat.code, code: cat.code, name: cat.name, direction: cat.direction, description: cat.description, isActive: true },
    });
    if (existing) updated += 1;
    else created += 1;
  }
  console.log(`Finance categories seeded: ${created} created, ${updated} updated (${CATEGORIES.length} total).`);
} catch (e) {
  console.error('Seed failed:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
