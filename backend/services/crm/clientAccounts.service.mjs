import { randomUUID } from 'node:crypto';

function normalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toAmount(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function buildReference(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 9000 + 1000).toString();
  return `${prefix}-${stamp}-${rand}`;
}

function toLookupRow(row, labelField = 'label', valueField = 'value') {
  const label = String(row?.[labelField] ?? '').trim();
  const value = String(row?.[valueField] ?? '').trim();
  return {
    id: String(row?.id ?? ''),
    label,
    value: value || label,
  };
}

export async function listCrmLookups(prisma, params = {}) {
  const rawTypes = String(params?.types || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const requestedTypes = rawTypes.length
    ? [...new Set(rawTypes)]
    : ['industries', 'stages', 'sources', 'statuses', 'activity_types', 'owners', 'companies', 'organizations', 'tags'];

  const includeType = (key) => requestedTypes.includes(key);
  const q = String(params?.q || '').trim();

  const response = {};

  if (includeType('industries')) {
    const rows = await prisma.crmRefIndustry.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    response.industries = rows.map((row) => toLookupRow(row));
  }

  if (includeType('stages')) {
    const rows = await prisma.crmRefPipelineStage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    response.stages = rows.map((row) => toLookupRow(row));
  }

  if (includeType('sources')) {
    const rows = await prisma.crmRefSource.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    response.sources = rows.map((row) => toLookupRow(row));
  }

  if (includeType('statuses')) {
    const rows = await prisma.crmRefStatus.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    response.statuses = rows.map((row) => toLookupRow(row));
  }

  if (includeType('activity_types')) {
    const rows = await prisma.crmRefActivityType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    response.activityTypes = rows.map((row) => toLookupRow(row));
  }

  if (includeType('owners')) {
    const rows = await prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        roles: {
          some: {
            validTo: null,
            role: {
              code: 'SALES',
              isDeleted: false,
              isActive: true,
            },
          },
        },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [{ name: 'asc' }],
      take: 500,
    });
    response.owners = rows.map((row) => ({
      id: row.id,
      label: row.name || row.email || 'Unknown Owner',
      value: row.id,
      email: row.email || null,
    }));
  }

  if (includeType('companies')) {
    const rows = await prisma.clientAccount.findMany({
      where: {
        isDeleted: false,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        industry: true,
      },
      orderBy: [{ name: 'asc' }],
      take: 500,
    });
    response.companies = rows.map((row) => ({
      id: row.id,
      label: row.name,
      value: row.id,
      industry: row.industry || null,
    }));
  }

  if (includeType('organizations')) {
    // Organization in CRM Person flow is backed by real company records.
    const rows = await prisma.clientAccount.findMany({
      where: {
        isDeleted: false,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        industry: true,
      },
      orderBy: [{ name: 'asc' }],
      take: 500,
    });
    response.organizations = rows.map((row) => ({
      id: row.id,
      label: row.name,
      value: row.id,
      industry: row.industry || null,
    }));
  }

  if (includeType('tags')) {
    const rows = await prisma.clientAccount.findMany({
      where: { isDeleted: false, tagsJson: { not: null } },
      select: { tagsJson: true },
      take: 1000,
    });
    const seen = new Set();
    for (const row of rows) {
      const tags = Array.isArray(row.tagsJson) ? row.tagsJson : [];
      for (const tag of tags) {
        const normalized = String(tag || '').trim();
        if (normalized) seen.add(normalized);
      }
    }
    response.tags = [...seen]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ id: tag, label: tag, value: tag }));
  }

  return response;
}

async function writeAudit(tx, userId, entity, entityId, actionType, oldValueJson, newValueJson, metaJson = null) {
  const txId = randomUUID();
  await tx.auditLog.create({
    data: {
      txId,
      occurredAt: new Date(),
      userId: userId || null,
      module: 'crm',
      entity,
      entityId,
      actionType,
      oldValueJson: oldValueJson ?? null,
      newValueJson: newValueJson ?? null,
      metaJson: metaJson ?? null,
    },
  });
  await tx.domainEvent.create({
    data: {
      txId,
      eventType: `crm.${entity}.${actionType}`,
      payloadJson: {
        entity,
        entityId,
        actionType,
        metaJson,
      },
    },
  });
}

async function writeFinanceActivity(tx, financeEntryId, actor, actionType, message, oldValueJson = null, newValueJson = null, fieldName = null) {
  return tx.financeActivity.create({
    data: {
      financeEntryId,
      actorUserId: actor?.actorUserId || null,
      actorDisplayName: actor?.actorDisplayName || 'System',
      actionType,
      fieldName,
      oldValueJson,
      newValueJson,
      message,
      eventSource: 'crm',
    },
  });
}

export async function listClientAccounts(prisma, query = '', take = 200) {
  const q = String(query || '').trim();
  const where = {
    isDeleted: false,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { normalizedName: { contains: normalizeName(q) } },
            { email: { contains: q, mode: 'insensitive' } },
            { taxRegistrationNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  return prisma.clientAccount.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: Number(take) || 200,
  });
}

export async function suggestClientDuplicates(prisma, probe) {
  const name = String(probe?.name || '').trim();
  const normalized = normalizeName(name);
  const email = String(probe?.email || '').trim().toLowerCase();
  const tax = String(probe?.taxRegistrationNumber || '').trim();

  if (!name && !email && !tax) return [];

  const candidates = await prisma.clientAccount.findMany({
    where: {
      isDeleted: false,
      OR: [
        ...(name ? [{ name: { contains: name, mode: 'insensitive' } }] : []),
        ...(normalized ? [{ normalizedName: { contains: normalized } }] : []),
        ...(email ? [{ email: { equals: email, mode: 'insensitive' } }] : []),
        ...(tax ? [{ taxRegistrationNumber: { equals: tax, mode: 'insensitive' } }] : []),
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  return candidates;
}

export async function createClientAccount(prisma, payload, actor) {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('Client name is required.');

  const normalizedName = normalizeName(name);
  const duplicates = await suggestClientDuplicates(prisma, payload);
  const exactDuplicate = duplicates.find((row) => String(row.name || '').toLowerCase() === name.toLowerCase());
  if (exactDuplicate) {
    throw new Error(`Client already exists: ${exactDuplicate.name}`);
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.clientAccount.create({
      data: {
        name,
        normalizedName,
        industry: payload?.industry || null,
        industryRefId: payload?.industryRefId || null,
        contactPerson: payload?.contactPerson || null,
        email: payload?.email ? String(payload.email).toLowerCase() : null,
        phone: payload?.phone || null,
        billingAddress: payload?.billingAddress || null,
        country: payload?.country || null,
        taxRegistrationNumber: payload?.taxRegistrationNumber || null,
        notes: payload?.notes || null,
        ownerId: payload?.ownerId || actor?.actorUserId || null,
        ownerUserId: payload?.ownerUserId || actor?.actorUserId || null,
        tagsJson: payload?.tags || [],
        profileStatus: payload?.profileStatus || 'needs_completion',
      },
    });

    await writeAudit(tx, actor?.actorUserId, 'client_account', created.id, 'created', null, created, {
      source: 'inline_or_crm_form',
      actorDisplayName: actor?.actorDisplayName || 'User',
    });

    return created;
  });
}

export async function updateClientAccount(prisma, clientId, payload, actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.clientAccount.findUnique({ where: { id: clientId } });
    if (!existing || existing.isDeleted) throw new Error('Client account not found.');

    const nextName = payload?.name !== undefined ? String(payload.name || '').trim() : undefined;
    if (nextName !== undefined && !nextName) throw new Error('Client name is required.');
    const nextNormalizedName = nextName !== undefined ? normalizeName(nextName) : undefined;

    if (nextNormalizedName && nextNormalizedName !== existing.normalizedName) {
      const conflict = await tx.clientAccount.findFirst({
        where: {
          normalizedName: nextNormalizedName,
          isDeleted: false,
          id: { not: clientId },
        },
        select: { id: true, name: true },
      });
      if (conflict) throw new Error(`Client already exists: ${conflict.name}`);
    }

    const updated = await tx.clientAccount.update({
      where: { id: clientId },
      data: {
        ...(nextName !== undefined ? { name: nextName, normalizedName: nextNormalizedName } : {}),
        ...(payload?.industry !== undefined ? { industry: payload.industry || null } : {}),
        ...(payload?.industryRefId !== undefined ? { industryRefId: payload.industryRefId || null } : {}),
        ...(payload?.contactPerson !== undefined ? { contactPerson: payload.contactPerson || null } : {}),
        ...(payload?.email !== undefined ? { email: payload.email ? String(payload.email).toLowerCase() : null } : {}),
        ...(payload?.phone !== undefined ? { phone: payload.phone || null } : {}),
        ...(payload?.billingAddress !== undefined ? { billingAddress: payload.billingAddress || null } : {}),
        ...(payload?.country !== undefined ? { country: payload.country || null } : {}),
        ...(payload?.taxRegistrationNumber !== undefined ? { taxRegistrationNumber: payload.taxRegistrationNumber || null } : {}),
        ...(payload?.notes !== undefined ? { notes: payload.notes || null } : {}),
        ...(payload?.ownerUserId !== undefined ? { ownerUserId: payload.ownerUserId || null } : {}),
      },
    });

    await writeAudit(
      tx,
      actor?.actorUserId,
      'client_account',
      updated.id,
      'updated',
      existing,
      updated,
      {
        actorDisplayName: actor?.actorDisplayName || 'User',
      },
    );

    return updated;
  });
}

export async function createCrmDeal(prisma, payload, actor) {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('Deal name is required.');
  const clientAccountId = String(payload?.clientAccountId || '').trim();
  if (!clientAccountId) throw new Error('Client account is required.');

  const client = await prisma.clientAccount.findUnique({ where: { id: clientAccountId } });
  if (!client || client.isDeleted) throw new Error('Client account not found.');

  return prisma.$transaction(async (tx) => {
    const deal = await tx.crmDeal.create({
      data: {
        name,
        clientAccountId,
        stage: payload?.stage || 'Discovery',
        stageRefId: payload?.stageRefId || null,
        status: payload?.status || 'open',
        statusRefId: payload?.statusRefId || null,
        sourceRefId: payload?.sourceRefId || null,
        valueAmount: toAmount(payload?.valueAmount),
        currencyCode: payload?.currencyCode || 'USD',
        ownerName: payload?.ownerName || null,
        ownerUserId: payload?.ownerUserId || null,
        closeDate: payload?.closeDate ? new Date(payload.closeDate) : null,
        notes: payload?.notes || null,
      },
      include: {
        clientAccount: true,
        ownerUser: { select: { id: true, name: true, email: true } },
        stageRef: true,
      },
    });

    await writeAudit(tx, actor?.actorUserId, 'crm_deal', deal.id, 'created', null, deal, {
      actorDisplayName: actor?.actorDisplayName || 'User',
    });

    return deal;
  });
}

export async function listCrmDeals(prisma, filters = {}) {
  const uid = filters.userId ? String(filters.userId).trim() : '';
  const ownedScope = uid
    ? {
      OR: [
        { ownerUserId: uid },
        { clientAccount: { ownerUserId: uid } },
      ],
    }
    : {};

  const where = {
    isDeleted: false,
    ...(filters.clientAccountId ? { clientAccountId: filters.clientAccountId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...ownedScope,
  };

  return prisma.crmDeal.findMany({
    where,
    include: {
      clientAccount: true,
      ownerUser: { select: { id: true, name: true, email: true } },
      stageRef: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function markDealWonAndCreateInvoiceCandidate(prisma, dealId, payload, actor) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.crmDeal.findUnique({
      where: { id: dealId },
      include: { clientAccount: true },
    });
    if (!deal || deal.isDeleted) throw new Error('Deal not found.');

    const wonAmount = toAmount(payload?.wonAmount ?? deal.valueAmount);
    if (wonAmount <= 0) throw new Error('Won amount must be greater than zero.');

    const updatedDeal = await tx.crmDeal.update({
      where: { id: dealId },
      data: {
        stage: payload?.stage || 'Closing',
        status: 'won',
        wonAt: new Date(),
        valueAmount: wonAmount,
        closeDate: payload?.closeDate ? new Date(payload.closeDate) : deal.closeDate,
      },
      include: { clientAccount: true },
    });

    const referenceCode = `crm-deal:${dealId}:receivable`;
    const financeEntry = await tx.financeEntry.upsert({
      where: { referenceCode },
      update: {
        entryType: 'receivable',
        direction: 'inflow',
        title: `CRM receivable - ${updatedDeal.name}`,
        memo: `Expected collection from won deal ${updatedDeal.name}`,
        currencyCode: updatedDeal.currencyCode || 'USD',
        amount: wonAmount,
        sourceModule: 'crm',
        sourceEntity: 'crm_deal',
        sourceEntityId: updatedDeal.id,
        sourceEvent: 'deal_won',
        sourceEventAt: new Date(),
        companyName: updatedDeal.clientAccount?.name || null,
        clientAccountId: updatedDeal.clientAccountId,
        accountCode: 'acc_crm_receivables',
        categoryCode: 'cat_crm_receivables',
        lifecycleStatus: 'posted',
        evidenceStatus: 'not_required',
        approvalStatus: 'approved',
        settlementStatus: 'open',
        expectedAt: payload?.expectedAt ? new Date(payload.expectedAt) : new Date(),
        validationMessage: null,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        referenceCode,
        entryType: 'receivable',
        direction: 'inflow',
        title: `CRM receivable - ${updatedDeal.name}`,
        memo: `Expected collection from won deal ${updatedDeal.name}`,
        currencyCode: updatedDeal.currencyCode || 'USD',
        amount: wonAmount,
        sourceModule: 'crm',
        sourceEntity: 'crm_deal',
        sourceEntityId: updatedDeal.id,
        sourceEvent: 'deal_won',
        sourceEventAt: new Date(),
        companyName: updatedDeal.clientAccount?.name || null,
        clientAccountId: updatedDeal.clientAccountId,
        accountCode: 'acc_crm_receivables',
        categoryCode: 'cat_crm_receivables',
        lifecycleStatus: 'posted',
        evidenceStatus: 'not_required',
        approvalStatus: 'approved',
        settlementStatus: 'open',
        expectedAt: payload?.expectedAt ? new Date(payload.expectedAt) : new Date(),
        validationMessage: null,
      },
    });

    await tx.financeEntrySourceLink.upsert({
      where: {
        financeEntryId_sourceModule_sourceEntity_sourceEntityId_sourceEvent: {
          financeEntryId: financeEntry.id,
          sourceModule: 'crm',
          sourceEntity: 'crm_deal',
          sourceEntityId: updatedDeal.id,
          sourceEvent: 'deal_won',
        },
      },
      update: {
        sourceField: 'status',
        sourceSnapshot: {
          dealName: updatedDeal.name,
          wonAmount,
          currencyCode: updatedDeal.currencyCode,
          clientAccountId: updatedDeal.clientAccountId,
        },
      },
      create: {
        financeEntryId: financeEntry.id,
        sourceModule: 'crm',
        sourceEntity: 'crm_deal',
        sourceEntityId: updatedDeal.id,
        sourceEvent: 'deal_won',
        sourceField: 'status',
        sourceSnapshot: {
          dealName: updatedDeal.name,
          wonAmount,
          currencyCode: updatedDeal.currencyCode,
          clientAccountId: updatedDeal.clientAccountId,
        },
      },
    });

    const dueDate = payload?.dueDate ? new Date(payload.dueDate) : new Date(Date.now() + 14 * 86400000);

    const receivable = await tx.receivable.upsert({
      where: { financeEntryId: financeEntry.id },
      update: {
        referenceCode,
        clientName: updatedDeal.clientAccount?.name || null,
        clientAccountId: updatedDeal.clientAccountId,
        totalAmount: wonAmount,
        outstandingAmount: wonAmount,
        collectedAmount: 0,
        dueDate,
        status: 'open',
        collectionStatus: 'pending_collection',
        isOverdue: false,
      },
      create: {
        financeEntryId: financeEntry.id,
        referenceCode,
        clientName: updatedDeal.clientAccount?.name || null,
        clientAccountId: updatedDeal.clientAccountId,
        totalAmount: wonAmount,
        outstandingAmount: wonAmount,
        collectedAmount: 0,
        dueDate,
        status: 'open',
        collectionStatus: 'pending_collection',
        isOverdue: false,
      },
    });

    const invoiceNumber = payload?.invoiceNumber || buildReference('INV-CRM');
    const existingInvoice = await tx.customerInvoice.findFirst({ where: { receivableId: receivable.id } });
    const invoice = existingInvoice
      ? await tx.customerInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            invoiceNumber: existingInvoice.invoiceNumber || invoiceNumber,
            issueDate: payload?.issueDate ? new Date(payload.issueDate) : existingInvoice.issueDate,
            dueDate,
            subtotalAmount: wonAmount,
            taxAmount: Number(payload?.taxAmount || 0),
            totalAmount: wonAmount + Number(payload?.taxAmount || 0),
            currencyCode: updatedDeal.currencyCode || 'USD',
            status: 'sent',
            clientAccountId: updatedDeal.clientAccountId,
          },
        })
      : await tx.customerInvoice.create({
          data: {
            receivableId: receivable.id,
            invoiceNumber,
            issueDate: payload?.issueDate ? new Date(payload.issueDate) : new Date(),
            dueDate,
            subtotalAmount: wonAmount,
            taxAmount: Number(payload?.taxAmount || 0),
            totalAmount: wonAmount + Number(payload?.taxAmount || 0),
            currencyCode: updatedDeal.currencyCode || 'USD',
            status: 'sent',
            createdByUserId: actor?.actorUserId || null,
            createdByName: actor?.actorDisplayName || 'User',
            clientAccountId: updatedDeal.clientAccountId,
          },
        });

    await writeFinanceActivity(
      tx,
      financeEntry.id,
      actor,
      'crm_deal_won_receivable_created',
      `${actor?.actorDisplayName || 'User'} marked deal ${updatedDeal.name} as won and created receivable candidate.`,
      null,
      { receivableId: receivable.id, invoiceId: invoice.id },
      'status'
    );

    await writeAudit(tx, actor?.actorUserId, 'crm_deal', updatedDeal.id, 'won', deal, updatedDeal, {
      receivableId: receivable.id,
      invoiceId: invoice.id,
      financeEntryId: financeEntry.id,
      clientAccountId: updatedDeal.clientAccountId,
    });

    return { deal: updatedDeal, financeEntry, receivable, invoice };
  });
}

export async function getClientFinancialSnapshot(prisma, clientAccountId) {
  const client = await prisma.clientAccount.findUnique({
    where: { id: clientAccountId },
  });
  if (!client || client.isDeleted) throw new Error('Client account not found.');

  const receivables = await prisma.receivable.findMany({
    where: {
      OR: [
        { clientAccountId },
        { clientName: client.name },
      ],
    },
    include: {
      financeEntry: true,
      invoices: { orderBy: { createdAt: 'desc' } },
      receipts: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const totalOutstanding = receivables.reduce((sum, r) => sum + Number(r.outstandingAmount || 0), 0);
  const totalCollected = receivables.reduce((sum, r) => sum + Number(r.collectedAmount || 0), 0);
  const overdueCount = receivables.filter((r) => r.isOverdue).length;
  const invoiceCount = receivables.reduce((sum, r) => sum + (r.invoices?.length || 0), 0);
  const receiptCount = receivables.reduce((sum, r) => sum + (r.receipts?.length || 0), 0);

  const collections = receivables.flatMap((r) =>
    (r.receipts || []).map((rcpt) => ({
      id: rcpt.id,
      receivableId: r.id,
      reference: rcpt.receiptReference,
      amount: Number(rcpt.amount || 0),
      method: rcpt.method,
      status: rcpt.status,
      receiptDate: rcpt.receiptDate,
      createdAt: rcpt.createdAt,
    }))
  ).sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime());

  return {
    client,
    summary: {
      totalReceivable,
      totalOutstanding,
      totalCollected,
      overdueCount,
      invoiceCount,
      receiptCount,
    },
    receivables,
    collections,
  };
}

export async function updateCrmDeal(prisma, dealId, payload, actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmDeal.findUnique({ where: { id: dealId } });
    if (!existing || existing.isDeleted) throw new Error('Deal not found.');

    const updated = await tx.crmDeal.update({
      where: { id: dealId },
      data: {
        name: payload?.name || undefined,
        stage: payload?.stage || undefined,
        stageRefId: payload?.stageRefId !== undefined ? payload.stageRefId : undefined,
        status: payload?.status || undefined,
        statusRefId: payload?.statusRefId !== undefined ? payload.statusRefId : undefined,
        sourceRefId: payload?.sourceRefId !== undefined ? payload.sourceRefId : undefined,
        valueAmount: payload?.valueAmount !== undefined ? toAmount(payload.valueAmount) : undefined,
        currencyCode: payload?.currencyCode || undefined,
        ownerName: payload?.ownerName !== undefined ? payload.ownerName : undefined,
        ownerUserId: payload?.ownerUserId !== undefined ? payload.ownerUserId : undefined,
        closeDate: payload?.closeDate ? new Date(payload.closeDate) : payload?.closeDate === null ? null : undefined,
        notes: payload?.notes !== undefined ? payload.notes : undefined,
      },
      include: {
        clientAccount: true,
        ownerUser: { select: { id: true, name: true, email: true } },
        stageRef: true,
      },
    });

    await writeAudit(tx, actor?.actorUserId, 'crm_deal', updated.id, 'updated', existing, updated, {
      actorDisplayName: actor?.actorDisplayName || 'User',
    });

    return updated;
  });
}
