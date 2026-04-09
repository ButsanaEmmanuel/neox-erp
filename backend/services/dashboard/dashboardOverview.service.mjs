function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const out = Number(raw);
  return Number.isFinite(out) ? out : 0;
}

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthEnd(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export async function getDashboardOverview(prisma) {
  const now = new Date();
  const thisMonthStart = monthStart(now);
  const thisMonthEnd = monthEnd(now);

  const [
    openDeals,
    allDeals,
    purchaseRequests,
    users,
    departments,
    timesheetApproved,
    timesheetSubmitted,
    timesheetRejected,
    projects,
    projectItems,
  ] = await Promise.all([
    prisma.crmDeal.findMany({
      where: { isDeleted: false, status: 'open' },
      select: { id: true, valueAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    }),
    prisma.crmDeal.count({ where: { isDeleted: false } }),
    prisma.purchaseRequest.findMany({
      where: { isDeleted: false },
      select: { id: true, statusCode: true, requesterDepartmentId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    prisma.user.findMany({
      where: { isDeleted: false, isActive: true, hasSystemAccess: true },
      select: { id: true, departmentId: true },
    }),
    prisma.department.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
    }),
    prisma.timesheetEntry.count({
      where: { isDeleted: false, statusCode: 'approved', workDate: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    prisma.timesheetEntry.count({
      where: { isDeleted: false, statusCode: 'submitted', workDate: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    prisma.timesheetEntry.count({
      where: { isDeleted: false, statusCode: 'rejected', workDate: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    prisma.project.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.workItem.findMany({
      where: { isDeleted: false },
      select: { id: true, projectId: true, status: true, manualCompletionStatus: true, financeSyncStatus: true },
      take: 10000,
    }),
  ]);

  const departmentById = new Map(departments.map((d) => [d.id, d.name]));

  const crmRevenue = openDeals.reduce((sum, d) => sum + toNumber(d.valueAmount), 0);
  const monthlyDealBuckets = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    const end = monthEnd(start);
    const value = openDeals
      .filter((d) => new Date(d.createdAt).getTime() >= start.getTime() && new Date(d.createdAt).getTime() <= end.getTime())
      .reduce((sum, d) => sum + toNumber(d.valueAmount), 0);
    return value;
  });

  const maxDealBucket = Math.max(1, ...monthlyDealBuckets);
  const crmBars = monthlyDealBuckets.map((value) => Math.round((value / maxDealBucket) * 100));

  const prByDept = new Map();
  let delayedCount = 0;
  for (const request of purchaseRequests) {
    const dept = request.requesterDepartmentId || 'Unassigned';
    if (!prByDept.has(dept)) prByDept.set(dept, { count: 0, delayed: 0 });
    const item = prByDept.get(dept);
    item.count += 1;
    const isDelayed = ['rejected', 'blocked', 'overdue', 'cancelled'].includes(String(request.statusCode || '').toLowerCase());
    if (isDelayed) {
      item.delayed += 1;
      delayedCount += 1;
    }
  }

  const clusterRows = [...prByDept.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([departmentId, data]) => ({
      name: departmentById.get(departmentId) || departmentId,
      region: `${data.count} requests`,
      status: data.delayed > 0 ? 'Delayed' : 'Track',
    }));

  while (clusterRows.length < 2) {
    clusterRows.push({ name: 'No data', region: '0 requests', status: 'Track' });
  }

  const workforceCount = users.length;
  const timesheetTotal = timesheetApproved + timesheetSubmitted + timesheetRejected;
  const workforceEfficiency = Math.round(pct(timesheetApproved, Math.max(1, timesheetApproved + timesheetSubmitted)));

  const hseEnvironment = Number(pct(timesheetApproved, Math.max(1, timesheetTotal)).toFixed(1));
  const hseProtocol = Number(pct(timesheetSubmitted, Math.max(1, timesheetTotal)).toFixed(1));
  const hseEquipment = Number((100 - pct(timesheetRejected, Math.max(1, timesheetTotal))).toFixed(1));

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectRisk = new Map();
  for (const item of projectItems) {
    const row = projectRisk.get(item.projectId) || { total: 0, risk: 0 };
    row.total += 1;
    const flags = [item.status, item.manualCompletionStatus, item.financeSyncStatus]
      .map((v) => String(v || '').toLowerCase());
    if (flags.some((f) => ['error', 'blocked', 'at-risk', 'pending', 'needs_manual_completion'].includes(f))) row.risk += 1;
    projectRisk.set(item.projectId, row);
  }

  const criticalRows = [...projectRisk.entries()]
    .map(([projectId, metrics]) => {
      const project = projectById.get(projectId);
      const progress = metrics.total > 0 ? Math.max(1, Math.round(((metrics.total - metrics.risk) / metrics.total) * 100)) : 0;
      return {
        projectId,
        name: project?.name || 'Unnamed Project',
        progress,
        status: metrics.risk > 0 ? 'at-risk' : 'active',
        riskCount: metrics.risk,
      };
    })
    .sort((a, b) => b.riskCount - a.riskCount)
    .slice(0, 3);

  const criticalCount = criticalRows.filter((row) => row.status === 'at-risk').length;

  return {
    generatedAt: now.toISOString(),
    crm: {
      pipelineRevenue: Number(crmRevenue.toFixed(2)),
      openDeals: openDeals.length,
      totalDeals: allDeals,
      bars: crmBars,
    },
    scm: {
      clustersValue: purchaseRequests.length,
      delayedCount,
      rows: clusterRows,
    },
    workforce: {
      pxCount: workforceCount,
      efficiency: workforceEfficiency,
      approvedTimesheets: timesheetApproved,
      pendingTimesheets: timesheetSubmitted,
    },
    hse: {
      environment: hseEnvironment,
      protocol: hseProtocol,
      equipment: hseEquipment,
    },
    projects: {
      criticalCount,
      rows: criticalRows,
    },
  };
}
