function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function toIsoDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function getHorizonRange(horizon, now) {
  const end = new Date(now);
  const start = new Date(now);
  switch ((horizon || '').toLowerCase()) {
    case 'q1':
      start.setUTCMonth(0, 1);
      break;
    case 'q2':
      start.setUTCMonth(3, 1);
      break;
    case 'q3':
      start.setUTCMonth(6, 1);
      break;
    case 'q4':
    case 'q4_forecast':
      start.setUTCMonth(9, 1);
      break;
    case '30d':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case '90d':
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    case '12m':
      start.setUTCMonth(start.getUTCMonth() - 12);
      break;
    default:
      start.setUTCDate(start.getUTCDate() - 90);
      break;
  }
  return { start, end };
}

function formatCompactMoney(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(0);
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

async function buildBarSeries(prisma, start, end) {
  const rows = await prisma.financeEntry.findMany({
    where: {
      isDeleted: false,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      id: true,
      createdAt: true,
      direction: true,
      amount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const bucketCount = 14;
  const dayMs = 86400000;
  const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
  const bucketSize = Math.max(1, Math.ceil(spanDays / bucketCount));

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    label: `P${index + 1}`,
    income: 0,
    expense: 0,
    events: 0,
    from: new Date(start.getTime() + index * bucketSize * dayMs),
    to: new Date(start.getTime() + (index + 1) * bucketSize * dayMs),
  }));

  for (const row of rows) {
    const ts = row.createdAt.getTime();
    const idx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((ts - start.getTime()) / (bucketSize * dayMs))),
    );
    const amount = toNumber(row.amount);
    buckets[idx].events += 1;
    if (row.direction === 'inflow') buckets[idx].income += amount;
    if (row.direction === 'outflow') buckets[idx].expense += amount;
  }

  const maxEvents = Math.max(1, ...buckets.map((b) => b.events));
  return {
    maxEvents,
    points: buckets.map((bucket) => ({
      label: bucket.label,
      events: bucket.events,
      normalized: Math.round((bucket.events / maxEvents) * 100),
      income: Number(bucket.income.toFixed(2)),
      expense: Number(bucket.expense.toFixed(2)),
    })),
  };
}

async function buildNodeHealth(prisma, start, end) {
  const [entriesCount, projectsCount, dealsCount, workItemsCount] = await Promise.all([
    prisma.financeEntry.count({ where: { isDeleted: false, createdAt: { gte: start, lte: end } } }),
    prisma.project.count({ where: { isDeleted: false } }),
    prisma.crmDeal.count(),
    prisma.workItem.count({ where: { isDeleted: false } }),
  ]);

  return [
    { id: 'FINANCE_DB', label: 'FINANCE_DB', metric: entriesCount, status: entriesCount > 0 ? 'active' : 'idle' },
    { id: 'CORE_ENGINE', label: 'CORE_ENGINE_v4.2', metric: projectsCount + dealsCount + workItemsCount, status: 'active' },
    { id: 'SCM_FLOW', label: 'SCM_FLOW', metric: workItemsCount, status: workItemsCount > 0 ? 'active' : 'idle' },
    { id: 'SYS_GATEWAY', label: 'SYS_GATEWAY', metric: dealsCount, status: dealsCount > 0 ? 'active' : 'idle' },
  ];
}

function summarizeInsights({ net, inflow, outflow, processLoadPct, latencyMs, uptimePct, query }) {
  const insights = [];
  const risks = [];
  const actions = [];

  insights.push(`Inflow ${formatCompactMoney(inflow)} vs outflow ${formatCompactMoney(outflow)} on selected horizon.`);
  insights.push(`Estimated net flow: ${formatCompactMoney(net)}.`);
  insights.push(`Operational processing load around ${processLoadPct.toFixed(1)}%.`);

  if (net < 0) risks.push('Net flow is negative for the selected period.');
  if (latencyMs > 24 * 3600 * 1000) risks.push('Settlement latency is above one day equivalent.');
  if (uptimePct < 95) risks.push('Data completeness and uptime indicators are below target.');

  actions.push('Prioritize pending validation entries with missing evidence.');
  actions.push('Accelerate receivable collection for open invoices.');
  actions.push('Review outflow-heavy projects for spend controls.');

  if (query && query.trim().length > 0) {
    insights.unshift(`Query focus: "${query.trim()}".`);
  }

  return {
    title: 'ERP Intelligence Synthesis',
    overview: 'Cross-module financial-operational synthesis generated from live database entries.',
    insights,
    risks,
    actions,
  };
}

async function buildIntelligence(prisma, options = {}) {
  const now = new Date();
  const horizon = options.timeHorizon || 'q4_forecast';
  const entityScope = options.entityScope || 'global_operations';
  const metrics = Array.isArray(options.metrics) ? options.metrics : ['net_efficiency'];
  const query = typeof options.query === 'string' ? options.query : '';
  const { start, end } = getHorizonRange(horizon, now);

  const [entries, series, nodes] = await Promise.all([
    prisma.financeEntry.findMany({
      where: {
        isDeleted: false,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        amount: true,
        direction: true,
        settlementStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    }),
    buildBarSeries(prisma, start, end),
    buildNodeHealth(prisma, start, end),
  ]);

  const inflow = entries.filter((row) => row.direction === 'inflow').reduce((sum, row) => sum + toNumber(row.amount), 0);
  const outflow = entries.filter((row) => row.direction === 'outflow').reduce((sum, row) => sum + toNumber(row.amount), 0);
  const net = inflow - outflow;
  const settled = entries.filter((row) => row.settlementStatus === 'settled').length;
  const processLoadPct = clampPercent(entries.length > 0 ? (settled / entries.length) * 100 : 0);

  const settledDurations = entries
    .filter((row) => row.settlementStatus === 'settled')
    .map((row) => Math.abs(new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime()));
  const latencyMs =
    settledDurations.length > 0
      ? Math.round(settledDurations.reduce((sum, value) => sum + value, 0) / settledDurations.length)
      : 0;

  const complianceBase = entries.length || 1;
  const uptimePct = clampPercent((settled / complianceBase) * 100);

  const narrative = summarizeInsights({
    net,
    inflow,
    outflow,
    processLoadPct,
    latencyMs,
    uptimePct,
    query,
  });

  return {
    generatedAt: now.toISOString(),
    query: {
      text: query,
      timeHorizon: horizon,
      entityScope,
      metrics,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    },
    summary: {
      processLoadPct: Number(processLoadPct.toFixed(2)),
      throughputLabel: formatCompactMoney(inflow + outflow),
      latencyMs,
      uptimePct: Number(uptimePct.toFixed(2)),
      inflow: Number(inflow.toFixed(2)),
      outflow: Number(outflow.toFixed(2)),
      net: Number(net.toFixed(2)),
      rateLabel: '200ms rate',
    },
    chart: {
      maxEvents: series.maxEvents,
      points: series.points,
    },
    nodes,
    dimensions: {
      timeHorizons: [
        { id: 'q4_forecast', label: 'Q4 Forecast' },
        { id: 'q3', label: 'Q3' },
        { id: '90d', label: 'Last 90 days' },
        { id: '30d', label: 'Last 30 days' },
        { id: '12m', label: 'Last 12 months' },
      ],
      entityScopes: [
        { id: 'global_operations', label: 'Global Operations' },
        { id: 'finance', label: 'Finance' },
        { id: 'projects', label: 'Projects' },
        { id: 'crm', label: 'CRM' },
      ],
      metricOptions: [
        { id: 'net_efficiency', label: 'Net Efficiency' },
        { id: 'throughput_delay', label: 'Throughput Delay' },
        { id: 'hse_compliance', label: 'HSE Compliance' },
      ],
    },
    narrative,
  };
}

export async function getReportsIntelligence(prisma, options = {}) {
  return buildIntelligence(prisma, options);
}

export async function synthesizeReportsIntelligence(prisma, options = {}) {
  return buildIntelligence(prisma, options);
}

