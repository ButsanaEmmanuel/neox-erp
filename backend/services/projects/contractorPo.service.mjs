// Contractor PO grouping service.
//
// One open PO per (projectId, contractorId), enforced by the partial unique
// index on the DB. The service finds-or-creates that PO whenever a work
// item's contractor payable becomes non-null, links the row, recomputes
// totals, and auto-closes the PO when every linked work item has
// qaStatus='approved' AND a non-null contractor payable.
//
// All entry points expect a Prisma transaction (`tx`) — the caller wraps
// the WorkItem state save and this in the same atomic unit so the PO
// counters never drift from the underlying WorkItem rows.

function nullableDecimalToNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const n = Number(value.toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// fmCONTNNNNNN — same scheme as FinanceEntry.displayCode but in its own
// namespace so users can tell a contractor PO from a finance entry at a
// glance. Lookup-max-and-increment; the partial unique index covers the
// "one open PO" invariant, this just keeps the codes pretty.
async function nextDisplayCode(tx) {
  const prefix = 'fmCONT';
  const last = await tx.contractorPurchaseOrder.findFirst({
    where: { displayCode: { startsWith: prefix } },
    orderBy: { displayCode: 'desc' },
    select: { displayCode: true },
  });
  let next = 1;
  if (last?.displayCode) {
    const tail = last.displayCode.slice(prefix.length);
    const parsed = Number(tail);
    if (Number.isFinite(parsed) && parsed >= 1) next = parsed + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

async function findOrCreateOpenPO(tx, projectId, contractorId) {
  const existing = await tx.contractorPurchaseOrder.findFirst({
    where: { projectId, contractorId, status: 'open' },
    select: { id: true },
  });
  if (existing) return existing.id;
  const displayCode = await nextDisplayCode(tx);
  const created = await tx.contractorPurchaseOrder.create({
    data: {
      displayCode,
      projectId,
      contractorId,
      status: 'open',
      totalAmount: 0,
      itemCount: 0,
      approvedCount: 0,
    },
    select: { id: true },
  });
  return created.id;
}

// Recompute totals + close decision for a PO. Cheap aggregate query —
// runs once per save, never enumerates beyond the PO's own work items.
async function recomputePO(tx, poId) {
  const items = await tx.workItem.findMany({
    where: {
      contractorPurchaseOrderId: poId,
      isDeleted: false,
    },
    select: {
      id: true,
      qaStatus: true,
      contractorPayableAmount: true,
    },
  });

  let total = 0;
  let approvedWithAmount = 0;
  let withAmount = 0;
  for (const wi of items) {
    const amt = nullableDecimalToNumber(wi.contractorPayableAmount);
    if (amt !== null && amt > 0) {
      total += amt;
      withAmount += 1;
      if ((wi.qaStatus || '').toLowerCase() === 'approved') approvedWithAmount += 1;
    }
  }

  const itemCount = items.length;
  // Close rule: every linked item has a non-null payable AND every one of
  // those is QA-approved. Empty POs (no items left after detach) also
  // close — leaving an empty open PO would block a fresh cycle.
  const allReady = itemCount > 0 && withAmount === itemCount && approvedWithAmount === itemCount;
  const status = allReady || itemCount === 0 ? 'closed' : 'open';

  await tx.contractorPurchaseOrder.update({
    where: { id: poId },
    data: {
      totalAmount: total.toFixed(2),
      itemCount,
      approvedCount: approvedWithAmount,
      status,
      closedAt: status === 'closed' ? new Date() : null,
    },
  });

  return { status, itemCount, approvedCount: approvedWithAmount, totalAmount: total };
}

// Main entry point. Call after a WorkItem's finance fields have been
// written (inside the same tx). Idempotent — re-running with the same
// inputs is a no-op once the row is correctly linked.
//
// payload: {
//   workItemId, projectId,
//   contractorId,             // current value on the row, may be null
//   contractorPayableAmount,  // current value after gating (null if QA not approved)
//   previousPurchaseOrderId,  // what the row was linked to before this save
// }
export async function reconcileContractorPO(tx, payload) {
  const {
    workItemId,
    projectId,
    contractorId,
    contractorPayableAmount,
    previousPurchaseOrderId,
  } = payload;

  const amount = nullableDecimalToNumber(contractorPayableAmount);
  const shouldLink = Boolean(contractorId) && amount !== null && amount > 0;

  let newPoId = null;
  if (shouldLink) {
    newPoId = await findOrCreateOpenPO(tx, projectId, contractorId);
  }

  // Update the link only when it actually changes. Avoids spurious
  // updatedAt churn on the WorkItem row.
  if (newPoId !== (previousPurchaseOrderId || null)) {
    await tx.workItem.update({
      where: { id: workItemId },
      data: { contractorPurchaseOrderId: newPoId },
    });
  }

  // Recompute whichever PO(s) were touched: the new one if we just
  // linked, the old one if we just detached. They can differ if the
  // contractor changed mid-flight.
  const touched = new Set();
  if (newPoId) touched.add(newPoId);
  if (previousPurchaseOrderId && previousPurchaseOrderId !== newPoId) {
    touched.add(previousPurchaseOrderId);
  }

  const recomputed = {};
  for (const poId of touched) {
    recomputed[poId] = await recomputePO(tx, poId);
  }

  return { linkedPurchaseOrderId: newPoId, recomputed };
}

export async function listContractorPOs(prisma, filters = {}) {
  const where = { };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.contractorId) where.contractorId = filters.contractorId;
  if (filters.status) where.status = filters.status;
  return prisma.contractorPurchaseOrder.findMany({
    where,
    orderBy: [{ status: 'asc' }, { openedAt: 'desc' }],
    include: {
      project: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true, email: true } },
      workItems: {
        where: { isDeleted: false },
        select: {
          id: true,
          title: true,
          qaStatus: true,
          contractorPayableAmount: true,
          status: true,
        },
      },
    },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function getContractorPO(prisma, poId) {
  return prisma.contractorPurchaseOrder.findUnique({
    where: { id: poId },
    include: {
      project: { select: { id: true, name: true } },
      contractor: { select: { id: true, name: true, email: true } },
      workItems: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          qaStatus: true,
          acceptanceStatus: true,
          contractorPayableAmount: true,
          poUnitPrice: true,
          ticketNumber: true,
          status: true,
        },
      },
    },
  });
}
