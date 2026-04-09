import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FINANCE_TABLES = [
  'DiscrepancyCase',
  'ReconciliationLine',
  'FinanceReconciliation',
  'FinanceEvidenceDocument',
  'FinanceActivity',
  'FinanceApproval',
  'FinanceEntrySourceLink',
  'PaymentDisbursement',
  'ReceiptCollection',
  'CustomerInvoice',
  'VendorBill',
  'Receivable',
  'Payable',
  'PayrollAdjustment',
  'PayrollCalculationDetail',
  'PayrollRunTimesheetLink',
  'PayrollRunLog',
  'PayrollNotification',
  'PayrollRunEmployee',
  'PayrollRun',
  'PayrollPeriod',
  'PayrollScheduleHistory',
  'PayrollSchedule',
  'PayrollDisbursementLine',
  'PayrollBatch',
  'ExpenseClaim',
  'EmployeeAdvance',
  'FinanceEntry',
  'FinanceCategorySetting',
  'FinanceEvidenceRule',
  'FinanceApprovalThreshold',
  'FinanceNumberingScheme',
  'FinancePaymentMethodSetting',
  'FinanceLedgerMapping',
  'EmployeeSalaryProfile'
];

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
  for (const table of FINANCE_TABLES) {
    const done = await truncateIfExists(table);
    if (done) truncated.push(table);
  }

  // Clear finance-related audit/domain events if tables exist
  if (await tableExists('AuditLog')) {
    await prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE module = 'finance' OR module = 'hrm-finance-payroll'`);
  }
  if (await tableExists('DomainEvent')) {
    await prisma.$executeRawUnsafe(`DELETE FROM "DomainEvent" WHERE "eventType" LIKE 'finance.%' OR "eventType" LIKE 'payroll.%'`);
  }

  // Clear legacy fallback mirrors if tables exist
  if (await tableExists('ProjectItemState')) {
    await prisma.$executeRawUnsafe(`
      UPDATE "ProjectItemState"
      SET "poUnitPriceCompleted" = NULL,
          "contractorPayableAmount" = NULL,
          "isFinanciallyEligible" = FALSE,
          "financialEligibilityReason" = NULL,
          "financeSyncStatus" = 'blocked',
          "financeSyncAt" = NULL,
          "financeReferenceId" = NULL,
          "financeErrorMessage" = NULL
    `);
  }

  if (await tableExists('WorkItem')) {
    await prisma.$executeRawUnsafe(`
      UPDATE "WorkItem"
      SET "poUnitPriceCompleted" = NULL,
          "contractorPayableAmount" = NULL,
          "isFinanciallyEligible" = FALSE,
          "financialEligibilityReason" = NULL,
          "financeSyncStatus" = 'pending',
          "financeSyncAt" = NULL,
          "financeReferenceId" = NULL,
          "financeErrorMessage" = NULL
    `);
  }

  const checks = {};
  for (const t of ['FinanceEntry', 'Payable', 'Receivable', 'PayrollBatch', 'PayrollRun', 'FinanceEvidenceDocument']) {
    if (await tableExists(t)) {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      checks[t] = rows[0].c;
    }
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
