function amountToNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function toTransactionStatus(entry) {
  if (entry.lifecycleStatus === 'rejected' || entry.approvalStatus === 'rejected') return 'failed';
  if (entry.settlementStatus === 'settled' || entry.lifecycleStatus === 'approved') return 'completed';
  if (entry.lifecycleStatus === 'cancelled') return 'cancelled';
  return 'pending';
}

function buildStaticAccounts(now, syncedExpenses, expectedReceivables) {
  return [
    {
      id: 'acc_project_payables',
      name: 'Project Payables Ledger',
      type: 'bank',
      currency: 'USD',
      balance: -syncedExpenses,
      institution: 'ERP Internal Ledger',
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'acc_project_receivables',
      name: 'Project Receivables Ledger',
      type: 'bank',
      currency: 'USD',
      balance: expectedReceivables,
      institution: 'ERP Internal Ledger',
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
}

function buildStaticCategories() {
  return [
    {
      id: 'cat_project_payables',
      name: 'Project Contractor Payables',
      type: 'expense',
      colorToken: '#14b8a6',
    },
    {
      id: 'cat_project_receivables',
      name: 'Project PO Completed (Expected Cash)',
      type: 'income',
      colorToken: '#10b981',
    },
  ];
}

async function buildFromFinanceEntries(prisma) {
  const entries = await prisma.financeEntry.findMany({
    where: { isDeleted: false },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });

  if (!entries.length) return null;

  const projectIds = [...new Set(entries.map((row) => row.projectId).filter(Boolean))];
  const workItemIds = [...new Set(entries.map((row) => row.workItemId).filter(Boolean))];

  const [projects, workItems] = await Promise.all([
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, clientName: true, clientAccountId: true },
        })
      : Promise.resolve([]),
    workItemIds.length > 0
      ? prisma.workItem.findMany({
          where: { id: { in: workItemIds } },
          select: { id: true, title: true, projectId: true },
        })
      : Promise.resolve([]),
  ]);

  const projectById = new Map(projects.map((row) => [row.id, row]));
  const workItemById = new Map(workItems.map((row) => [row.id, row]));
  const now = new Date();

  const transactions = entries.map((entry) => {
    const amount = amountToNumber(entry.amount);
    const project = projectById.get(entry.projectId);
    const workItem = workItemById.get(entry.workItemId);
    return {
      id: `tx_${entry.id}`,
      date: (entry.expectedAt || entry.updatedAt).toISOString(),
      type: entry.direction === 'inflow' ? 'income' : 'expense',
      amount,
      currency: entry.currencyCode || 'USD',
      accountId: entry.accountCode || (entry.direction === 'inflow' ? 'acc_project_receivables' : 'acc_project_payables'),
      categoryId: entry.categoryCode || (entry.direction === 'inflow' ? 'cat_project_receivables' : 'cat_project_payables'),
      memo: entry.memo || `${entry.title} - ${project?.name || entry.projectId || 'Finance'}`,
      status: toTransactionStatus(entry),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      companyId: entry.clientAccountId || project?.clientAccountId || entry.companyName || project?.clientName || undefined,
      personId: undefined,
      dealId: entry.projectId || undefined,
    };
  });

  const receivableEntries = entries.filter((entry) => entry.entryType === 'receivable');
  const payableEntries = entries.filter((entry) => entry.entryType === 'payable');
  const expectedReceivables = receivableEntries.reduce((sum, entry) => sum + amountToNumber(entry.amount), 0);
  const syncedExpenses = payableEntries
    .filter((entry) => toTransactionStatus(entry) === 'completed')
    .reduce((sum, entry) => sum + amountToNumber(entry.amount), 0);

  const monthlyExpenses = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === 'expense' && d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const monthlyExpectedIncome = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === 'income' && d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const invoices = receivableEntries.map((entry) => {
    const project = projectById.get(entry.projectId);
    const workItem = workItemById.get(entry.workItemId);
    const total = amountToNumber(entry.amount);
    const issueDate = entry.expectedAt || entry.updatedAt;
    const dueDate = new Date(issueDate.getTime() + 14 * 86400000);
    return {
      id: `inv_${entry.id}`,
      number: `INV-EXP-${entry.id.slice(-8).toUpperCase()}`,
      companyId: entry.clientAccountId || project?.clientAccountId || entry.companyName || project?.clientName || entry.projectId,
      contactPersonId: undefined,
      dealId: entry.projectId || undefined,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      subtotal: total,
      tax: 0,
      total,
      currency: entry.currencyCode || 'USD',
      status: entry.settlementStatus === 'settled' ? 'paid' : 'sent',
      lineItems: [
        {
          id: `line_${entry.id}`,
          description: `Expected cash for ${workItem?.title || entry.workItemId}`,
          quantity: 1,
          unitPrice: total,
          amount: total,
          taxRate: 0,
        },
      ],
      notes: 'Auto-generated from FinanceEntry receivable.',
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  });

  const accounts = buildStaticAccounts(now, syncedExpenses, expectedReceivables);
  const summary = {
    totalBalance: accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0),
    monthlyBurnRate: monthlyExpenses,
    unpaidAccountsReceivable: expectedReceivables,
    monthlyIncome: monthlyExpectedIncome,
    monthlyExpenses,
    currency: 'USD',
  };

  return {
    source: 'database',
    generatedAt: now.toISOString(),
    accounts,
    transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    invoices,
    payments: [],
    budgets: [],
    categories: buildStaticCategories(),
    summary,
  };
}

async function buildLegacySnapshot(prisma) {
  const states = await prisma.projectItemState.findMany({
    where: {
      OR: [
        { contractorPayableAmount: { not: null } },
        { poUnitPriceCompleted: { not: null } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });

  const projectIds = [...new Set(states.map((row) => row.projectId).filter(Boolean))];
  const workItemIds = [...new Set(states.map((row) => row.workItemId).filter(Boolean))];

  const [projects, workItems] = await Promise.all([
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, clientName: true, clientAccountId: true },
        })
      : Promise.resolve([]),
    workItemIds.length > 0
      ? prisma.workItem.findMany({
          where: { id: { in: workItemIds } },
          select: { id: true, title: true, projectId: true },
        })
      : Promise.resolve([]),
  ]);

  const projectById = new Map(projects.map((row) => [row.id, row]));
  const workItemById = new Map(workItems.map((row) => [row.id, row]));
  const now = new Date();

  const payableTransactions = states
    .filter((row) => amountToNumber(row.contractorPayableAmount) > 0)
    .map((row) => {
      const amount = amountToNumber(row.contractorPayableAmount);
      const project = projectById.get(row.projectId);
      const workItem = workItemById.get(row.workItemId);
      const status =
        row.financeSyncStatus === 'synced'
          ? 'completed'
          : row.financeSyncStatus === 'error'
          ? 'failed'
          : 'pending';

      return {
        id: `tx_payable_${row.id}`,
        date: (row.financeSyncAt || row.updatedAt).toISOString(),
        type: 'expense',
        amount,
        currency: 'USD',
        accountId: 'acc_project_payables',
        categoryId: 'cat_project_payables',
        memo: `Contractor payable - ${project?.name || row.projectId} / ${workItem?.title || row.workItemId}`,
        status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        companyId: project?.clientAccountId || project?.clientName || undefined,
        personId: undefined,
        dealId: row.projectId,
      };
    });

  const receivableTransactions = states
    .filter((row) => amountToNumber(row.poUnitPriceCompleted) > 0)
    .map((row) => {
      const amount = amountToNumber(row.poUnitPriceCompleted);
      const project = projectById.get(row.projectId);
      const workItem = workItemById.get(row.workItemId);
      return {
        id: `tx_receivable_${row.id}`,
        date: row.updatedAt.toISOString(),
        type: 'income',
        amount,
        currency: 'USD',
        accountId: 'acc_project_receivables',
        categoryId: 'cat_project_receivables',
        memo: `Expected cash (PO completed) - ${project?.name || row.projectId} / ${workItem?.title || row.workItemId}`,
        status: 'pending',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        companyId: project?.clientAccountId || project?.clientName || undefined,
        personId: undefined,
        dealId: row.projectId,
      };
    });

  const transactions = [...receivableTransactions, ...payableTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const syncedExpenses = payableTransactions
    .filter((tx) => tx.status === 'completed')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const expectedReceivables = receivableTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const monthlyExpenses = payableTransactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const monthlyExpectedIncome = receivableTransactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const invoices = states
    .filter((row) => amountToNumber(row.poUnitPriceCompleted) > 0)
    .map((row) => {
      const project = projectById.get(row.projectId);
      const workItem = workItemById.get(row.workItemId);
      const issueDate = row.updatedAt;
      const dueDate = new Date(issueDate.getTime() + 14 * 86400000);
      const total = amountToNumber(row.poUnitPriceCompleted);
      return {
        id: `inv_receivable_${row.id}`,
        number: `INV-EXP-${row.id.slice(-8).toUpperCase()}`,
        companyId: project?.clientAccountId || project?.clientName || row.projectId,
        contactPersonId: undefined,
        dealId: row.projectId,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        subtotal: total,
        tax: 0,
        total,
        currency: 'USD',
        status: 'sent',
        lineItems: [
          {
            id: `line_${row.id}`,
            description: `Expected cash for ${workItem?.title || row.workItemId}`,
            quantity: 1,
            unitPrice: total,
            amount: total,
            taxRate: 0,
          },
        ],
        notes: 'Auto-generated from PO Unit Price Completed (legacy fallback).',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

  const accounts = buildStaticAccounts(now, syncedExpenses, expectedReceivables);
  const categories = buildStaticCategories();
  const summary = {
    totalBalance: accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0),
    monthlyBurnRate: monthlyExpenses,
    unpaidAccountsReceivable: expectedReceivables,
    monthlyIncome: monthlyExpectedIncome,
    monthlyExpenses,
    currency: 'USD',
  };

  return {
    source: 'database',
    generatedAt: now.toISOString(),
    accounts,
    transactions,
    invoices,
    payments: [],
    budgets: [],
    categories,
    summary,
  };
}

export async function buildFinanceSnapshot(prisma) {
  const fromEntries = await buildFromFinanceEntries(prisma);
  if (fromEntries) return fromEntries;
  return buildLegacySnapshot(prisma);
}

