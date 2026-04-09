function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysPastDue(dueDate, now) {
  const due = safeDate(dueDate);
  if (!due) return null;
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

function agingBucketLabel(days) {
  if (days === null || days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function newAgingBuckets() {
  return {
    current: { label: 'Current', amount: 0, count: 0 },
    '1-30': { label: '1-30 days', amount: 0, count: 0 },
    '31-60': { label: '31-60 days', amount: 0, count: 0 },
    '61-90': { label: '61-90 days', amount: 0, count: 0 },
    '90+': { label: '90+ days', amount: 0, count: 0 },
  };
}

function bucketsToList(buckets) {
  return ['current', '1-30', '31-60', '61-90', '90+'].map((key) => ({
    key,
    ...buckets[key],
  }));
}

export async function getFinanceReports(prisma) {
  const now = new Date();
  const [
    receivables,
    payables,
    receipts,
    disbursements,
    projectEntries,
    pendingEntries,
    evidenceEntries,
    reconciliations,
    discrepancies,
  ] = await Promise.all([
    prisma.receivable.findMany({
      include: {
        clientAccount: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
    prisma.payable.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
    prisma.receiptCollection.findMany({
      include: {
        receivable: {
          include: {
            clientAccount: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { receiptDate: 'desc' },
      take: 5000,
    }),
    prisma.paymentDisbursement.findMany({
      include: {
        payable: { select: { vendorName: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take: 5000,
    }),
    prisma.financeEntry.findMany({
      where: { isDeleted: false },
      select: {
        projectId: true,
        direction: true,
        amount: true,
        settlementStatus: true,
        evidenceStatus: true,
      },
      take: 10000,
    }),
    prisma.financeEntry.findMany({
      where: {
        isDeleted: false,
        OR: [
          { lifecycleStatus: { in: ['pending_evidence', 'pending_validation', 'draft'] } },
          { approvalStatus: 'pending' },
          { settlementStatus: { in: ['open', 'partial'] } },
        ],
      },
      select: {
        id: true,
        referenceCode: true,
        title: true,
        lifecycleStatus: true,
        approvalStatus: true,
        evidenceStatus: true,
        settlementStatus: true,
        amount: true,
        sourceModule: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.financeEntry.findMany({
      where: { isDeleted: false, direction: 'outflow' },
      select: {
        id: true,
        referenceCode: true,
        title: true,
        evidenceStatus: true,
      },
      take: 10000,
    }),
    prisma.financeReconciliation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.discrepancyCase.findMany({
      where: { status: { not: 'resolved' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reconciliation: {
          select: {
            id: true,
            reconciliationCode: true,
          },
        },
      },
    }),
  ]);

  const receivablesBuckets = newAgingBuckets();
  for (const row of receivables) {
    const outstanding = toNumber(row.outstandingAmount);
    if (outstanding <= 0) continue;
    const days = daysPastDue(row.dueDate, now);
    const key = agingBucketLabel(days);
    receivablesBuckets[key].amount += outstanding;
    receivablesBuckets[key].count += 1;
  }

  const payablesBuckets = newAgingBuckets();
  for (const row of payables) {
    const outstanding = toNumber(row.outstandingAmount);
    if (outstanding <= 0) continue;
    const days = daysPastDue(row.dueDate, now);
    const key = agingBucketLabel(days);
    payablesBuckets[key].amount += outstanding;
    payablesBuckets[key].count += 1;
  }

  const collectionsByClientMap = new Map();
  for (const receipt of receipts) {
    const key = receipt.receivable?.clientAccount?.id || receipt.receivable?.clientName || 'unknown_client';
    const current = collectionsByClientMap.get(key) || {
      clientId: receipt.receivable?.clientAccount?.id || null,
      clientName: receipt.receivable?.clientAccount?.name || receipt.receivable?.clientName || 'Unknown client',
      totalCollected: 0,
      entries: 0,
      lastReceiptAt: null,
    };
    current.totalCollected += toNumber(receipt.amount);
    current.entries += 1;
    current.lastReceiptAt = receipt.receiptDate?.toISOString() || current.lastReceiptAt;
    collectionsByClientMap.set(key, current);
  }
  const collectionsByClient = [...collectionsByClientMap.values()]
    .sort((a, b) => b.totalCollected - a.totalCollected)
    .slice(0, 30);

  const disbursementsBySupplierMap = new Map();
  for (const payment of disbursements) {
    const vendor = payment.payable?.vendorName || 'Unknown supplier';
    const current = disbursementsBySupplierMap.get(vendor) || {
      supplierName: vendor,
      totalDisbursed: 0,
      entries: 0,
      lastPaymentAt: null,
    };
    current.totalDisbursed += toNumber(payment.amount);
    current.entries += 1;
    current.lastPaymentAt = payment.paymentDate?.toISOString() || current.lastPaymentAt;
    disbursementsBySupplierMap.set(vendor, current);
  }
  const disbursementsBySupplier = [...disbursementsBySupplierMap.values()]
    .sort((a, b) => b.totalDisbursed - a.totalDisbursed)
    .slice(0, 30);

  const projectCashflowMap = new Map();
  for (const entry of projectEntries) {
    if (!entry.projectId) continue;
    const amount = toNumber(entry.amount);
    const current = projectCashflowMap.get(entry.projectId) || {
      projectId: entry.projectId,
      inflow: 0,
      outflow: 0,
      net: 0,
      pendingSettlement: 0,
    };
    if (entry.direction === 'inflow') current.inflow += amount;
    if (entry.direction === 'outflow') current.outflow += amount;
    if (entry.settlementStatus !== 'settled') current.pendingSettlement += amount;
    current.net = current.inflow - current.outflow;
    projectCashflowMap.set(entry.projectId, current);
  }

  const projectNames = await prisma.project.findMany({
    where: { id: { in: [...projectCashflowMap.keys()] } },
    select: { id: true, name: true },
  });
  const projectNameById = new Map(projectNames.map((p) => [p.id, p.name]));
  const projectCashflow = [...projectCashflowMap.values()]
    .map((row) => ({
      ...row,
      projectName: projectNameById.get(row.projectId) || row.projectId,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 50);

  const requiredEvidence = evidenceEntries.length;
  const compliantEvidence = evidenceEntries.filter((row) => row.evidenceStatus !== 'required_missing').length;
  const missingEvidence = requiredEvidence - compliantEvidence;

  const pendingValidation = pendingEntries.map((row) => ({
    id: row.id,
    referenceCode: row.referenceCode,
    title: row.title,
    amount: toNumber(row.amount),
    lifecycleStatus: row.lifecycleStatus,
    approvalStatus: row.approvalStatus,
    evidenceStatus: row.evidenceStatus,
    settlementStatus: row.settlementStatus,
    sourceModule: row.sourceModule,
    updatedAt: row.updatedAt.toISOString(),
  }));

  const latestReconciliation = reconciliations[0] || null;
  const reconciliationExceptions = {
    latestReconciliationId: latestReconciliation?.id || null,
    latestReconciliationCode: latestReconciliation?.reconciliationCode || null,
    openDiscrepancies: discrepancies.length,
    highSeverity: discrepancies.filter((row) => row.severity === 'high' || row.severity === 'critical').length,
    unresolvedCases: discrepancies.map((row) => ({
      id: row.id,
      caseType: row.caseType,
      severity: row.severity,
      status: row.status,
      title: row.title,
      sourceModule: row.sourceModule,
      sourceEntity: row.sourceEntity,
      sourceEntityId: row.sourceEntityId,
      reconciliationCode: row.reconciliation?.reconciliationCode || null,
      createdAt: row.createdAt.toISOString(),
    })),
  };

  return {
    generatedAt: now.toISOString(),
    receivablesAging: bucketsToList(receivablesBuckets),
    payablesAging: bucketsToList(payablesBuckets),
    collectionsByClient,
    disbursementsBySupplier,
    projectCashflow,
    evidenceCompliance: {
      requiredEntries: requiredEvidence,
      compliantEntries: compliantEvidence,
      missingEntries: missingEvidence,
      complianceRate: requiredEvidence > 0 ? Number(((compliantEvidence / requiredEvidence) * 100).toFixed(2)) : 100,
    },
    pendingValidation,
    reconciliationExceptions,
  };
}
