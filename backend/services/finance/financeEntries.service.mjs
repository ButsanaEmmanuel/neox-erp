import fs from 'node:fs';
import path from 'node:path';
import crypto, { randomUUID } from 'node:crypto';

const FILE_ROOT = path.resolve(process.cwd(), 'backend', 'storage', 'finance-evidence');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function decimalToNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const out = Number(raw);
  return Number.isFinite(out) ? out : null;
}

function extensionFromName(name) {
  const ext = path.extname(String(name || '')).replace(/^\./, '').toLowerCase();
  return ext || null;
}

function detectEvidenceStatus(entryType, count) {
  if (entryType === 'receivable') return 'not_required';
  return count > 0 ? 'submitted' : 'required_missing';
}

function detectLifecycleStatus(entryType, count, approvalStatus) {
  if (entryType === 'receivable') return 'posted';
  if (approvalStatus === 'approved') return 'approved';
  return count > 0 ? 'pending_validation' : 'pending_evidence';
}

async function writeAuditLog(tx, payload) {
  let safeUserId = null;
  if (payload.userId) {
    const candidate = String(payload.userId).trim();
    if (candidate) {
      const foundUser = await tx.user.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      safeUserId = foundUser?.id || null;
    }
  }
  return tx.auditLog.create({
    data: {
      txId: payload.txId,
      occurredAt: payload.occurredAt || new Date(),
      userId: safeUserId,
      module: 'finance',
      entity: payload.entity,
      entityId: payload.entityId,
      actionType: payload.actionType,
      oldValueJson: payload.oldValueJson ?? null,
      newValueJson: payload.newValueJson ?? null,
      metaJson: payload.metaJson ?? null,
    },
  });
}

async function writeDomainEvent(tx, payload) {
  return tx.domainEvent.create({
    data: {
      txId: payload.txId,
      eventType: payload.eventType,
      payloadJson: payload.payloadJson,
    },
  });
}

export async function createFinanceActivity(tx, payload) {
  let safeActorUserId = null;
  if (payload.actorUserId) {
    const candidate = String(payload.actorUserId).trim();
    if (candidate) {
      const foundUser = await tx.user.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      safeActorUserId = foundUser?.id || null;
    }
  }
  return tx.financeActivity.create({
    data: {
      financeEntryId: payload.financeEntryId,
      actorUserId: safeActorUserId,
      actorDisplayName: payload.actorDisplayName || null,
      actionType: payload.actionType,
      fieldName: payload.fieldName || null,
      oldValueJson: payload.oldValueJson ?? null,
      newValueJson: payload.newValueJson ?? null,
      message: payload.message,
      eventSource: payload.eventSource || 'system',
    },
  });
}

async function upsertFinanceEntrySourceLink(tx, financeEntryId, source) {
  return tx.financeEntrySourceLink.upsert({
    where: {
      financeEntryId_sourceModule_sourceEntity_sourceEntityId_sourceEvent: {
        financeEntryId,
        sourceModule: source.sourceModule,
        sourceEntity: source.sourceEntity,
        sourceEntityId: source.sourceEntityId,
        sourceEvent: source.sourceEvent,
      },
    },
    update: {
      sourceField: source.sourceField || null,
      sourceSnapshot: source.sourceSnapshot ?? null,
    },
    create: {
      financeEntryId,
      sourceModule: source.sourceModule,
      sourceEntity: source.sourceEntity,
      sourceEntityId: source.sourceEntityId,
      sourceEvent: source.sourceEvent,
      sourceField: source.sourceField || null,
      sourceSnapshot: source.sourceSnapshot ?? null,
    },
  });
}

async function softDeleteFinanceEntry(tx, existing, actor, reason) {
  if (!existing || existing.isDeleted) return null;
  const updated = await tx.financeEntry.update({
    where: { id: existing.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      lifecycleStatus: 'cancelled',
      settlementStatus: 'cancelled',
      validationMessage: reason || 'Finance entry cancelled.',
    },
  });
  await tx.receivable.deleteMany({ where: { financeEntryId: existing.id } });
  await tx.payable.deleteMany({ where: { financeEntryId: existing.id } });

  await createFinanceActivity(tx, {
    financeEntryId: updated.id,
    actorUserId: actor?.actorUserId,
    actorDisplayName: actor?.actorDisplayName || 'System',
    actionType: 'entry_cancelled',
    fieldName: 'lifecycleStatus',
    oldValueJson: existing.lifecycleStatus,
    newValueJson: 'cancelled',
    message: reason || 'Finance entry cancelled because source amount is no longer eligible.',
    eventSource: 'system',
  });

  const txId = randomUUID();
  await writeAuditLog(tx, {
    txId,
    userId: actor?.actorUserId,
    entity: 'finance_entry',
    entityId: updated.id,
    actionType: 'cancelled',
    oldValueJson: existing,
    newValueJson: updated,
    metaJson: { reason },
  });
  await writeDomainEvent(tx, {
    txId,
    eventType: 'finance.entry.cancelled',
    payloadJson: { financeEntryId: updated.id, reason },
  });
  return updated;
}

async function upsertFinanceEntry(tx, payload) {
  const existing = await tx.financeEntry.findUnique({
    where: { referenceCode: payload.referenceCode },
    include: {
      evidenceDocuments: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  const evidenceCount = existing?.evidenceDocuments?.length || 0;
  const evidenceStatus = detectEvidenceStatus(payload.entryType, evidenceCount);
  const lifecycleStatus = detectLifecycleStatus(payload.entryType, evidenceCount, existing?.approvalStatus || payload.approvalStatus || 'pending');
  const data = {
    referenceCode: payload.referenceCode,
    entryType: payload.entryType,
    direction: payload.direction,
    title: payload.title,
    memo: payload.memo || null,
    currencyCode: payload.currencyCode || 'USD',
    amount: payload.amount,
    sourceModule: payload.sourceModule,
    sourceEntity: payload.sourceEntity,
    sourceEntityId: payload.sourceEntityId,
    sourceEvent: payload.sourceEvent,
    sourceEventAt: payload.sourceEventAt || new Date(),
    projectId: payload.projectId || null,
    workItemId: payload.workItemId || null,
    companyName: payload.companyName || null,
    clientAccountId: payload.clientAccountId || null,
    accountCode: payload.accountCode || null,
    categoryCode: payload.categoryCode || null,
    lifecycleStatus,
    evidenceStatus,
    approvalStatus: existing?.approvalStatus || payload.approvalStatus || (payload.entryType === 'receivable' ? 'approved' : 'pending'),
    settlementStatus: payload.settlementStatus || existing?.settlementStatus || 'open',
    expectedAt: payload.expectedAt || null,
    approvedAt: existing?.approvedAt || payload.approvedAt || null,
    approvedByUserId: existing?.approvedByUserId || payload.approvedByUserId || null,
    settledAt: payload.settledAt || existing?.settledAt || null,
    validationMessage: payload.validationMessage || null,
    metadataJson: payload.metadataJson ?? null,
    isDeleted: false,
    deletedAt: null,
  };

  const saved = existing
    ? await tx.financeEntry.update({
        where: { id: existing.id },
        data,
      })
    : await tx.financeEntry.create({ data });

  await upsertFinanceEntrySourceLink(tx, saved.id, {
    sourceModule: payload.sourceModule,
    sourceEntity: payload.sourceEntity,
    sourceEntityId: payload.sourceEntityId,
    sourceEvent: payload.sourceEvent,
    sourceField: payload.sourceField || null,
    sourceSnapshot: payload.sourceSnapshot ?? null,
  });

  const amountBefore = decimalToNumber(existing?.amount);
  const amountAfter = decimalToNumber(saved.amount);
  if (!existing) {
    await createFinanceActivity(tx, {
      financeEntryId: saved.id,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'System',
      actionType: 'entry_created',
      fieldName: payload.sourceField || null,
      oldValueJson: null,
      newValueJson: { amount: amountAfter, lifecycleStatus: saved.lifecycleStatus },
      message: `Finance entry created for ${payload.title}`,
      eventSource: 'system',
    });
  } else if (amountBefore !== amountAfter || existing.lifecycleStatus !== saved.lifecycleStatus || existing.evidenceStatus !== saved.evidenceStatus) {
    await createFinanceActivity(tx, {
      financeEntryId: saved.id,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'System',
      actionType: 'entry_updated',
      fieldName: payload.sourceField || null,
      oldValueJson: { amount: amountBefore, lifecycleStatus: existing.lifecycleStatus, evidenceStatus: existing.evidenceStatus },
      newValueJson: { amount: amountAfter, lifecycleStatus: saved.lifecycleStatus, evidenceStatus: saved.evidenceStatus },
      message: `Finance entry updated for ${payload.title}`,
      eventSource: 'system',
    });
  }

  const txId = randomUUID();
  await writeAuditLog(tx, {
    txId,
    userId: payload.actorUserId,
    entity: 'finance_entry',
    entityId: saved.id,
    actionType: existing ? 'updated' : 'created',
    oldValueJson: existing,
    newValueJson: saved,
    metaJson: {
      sourceModule: payload.sourceModule,
      sourceEntity: payload.sourceEntity,
      sourceField: payload.sourceField || null,
    },
  });
  await writeDomainEvent(tx, {
    txId,
    eventType: existing ? 'finance.entry.updated' : 'finance.entry.created',
    payloadJson: {
      financeEntryId: saved.id,
      referenceCode: saved.referenceCode,
      entryType: saved.entryType,
      amount: amountAfter,
    },
  });

  return saved;
}


async function upsertReceivableControl(tx, entry, payload = {}) {
  const totalAmount = Number(entry.amount || 0);
  const collectedAmount = Number(payload.collectedAmount || 0);
  const outstandingAmount = Math.max(totalAmount - collectedAmount, 0);
  const dueDate = payload.dueDate || entry.expectedAt || null;
  const isOverdue = Boolean(dueDate && outstandingAmount > 0 && new Date(dueDate).getTime() < Date.now());
  const status = outstandingAmount <= 0 ? 'collected' : isOverdue ? 'overdue' : 'open';

  return tx.receivable.upsert({
    where: { financeEntryId: entry.id },
    update: {
      referenceCode: entry.referenceCode,
      clientName: entry.companyName || null,
      clientAccountId: entry.clientAccountId || null,
      projectId: entry.projectId || null,
      workItemId: entry.workItemId || null,
      totalAmount,
      outstandingAmount,
      collectedAmount,
      dueDate,
      status,
      collectionStatus: outstandingAmount <= 0 ? 'received' : 'pending_collection',
      isOverdue,
      notes: entry.validationMessage || null,
    },
    create: {
      financeEntryId: entry.id,
      referenceCode: entry.referenceCode,
      clientName: entry.companyName || null,
      clientAccountId: entry.clientAccountId || null,
      projectId: entry.projectId || null,
      workItemId: entry.workItemId || null,
      totalAmount,
      outstandingAmount,
      collectedAmount,
      dueDate,
      status,
      collectionStatus: outstandingAmount <= 0 ? 'received' : 'pending_collection',
      isOverdue,
      notes: entry.validationMessage || null,
    },
  });
}

async function upsertPayableControl(tx, entry, payload = {}) {
  const totalAmount = Number(entry.amount || 0);
  const paidAmount = Number(payload.paidAmount || 0);
  const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
  const dueDate = payload.dueDate || entry.expectedAt || null;
  const status = entry.approvalStatus === 'approved'
    ? (outstandingAmount <= 0 ? 'paid' : 'approved_for_payment')
    : entry.evidenceStatus === 'required_missing'
    ? 'pending_evidence'
    : 'pending_validation';

  return tx.payable.upsert({
    where: { financeEntryId: entry.id },
    update: {
      referenceCode: entry.referenceCode,
      vendorName: entry.companyName || null,
      projectId: entry.projectId || null,
      workItemId: entry.workItemId || null,
      totalAmount,
      outstandingAmount,
      paidAmount,
      dueDate,
      status,
      paymentStatus: outstandingAmount <= 0 ? 'paid' : 'pending_payment',
      requiresEvidence: entry.entryType === 'payable',
      notes: entry.validationMessage || null,
    },
    create: {
      financeEntryId: entry.id,
      referenceCode: entry.referenceCode,
      vendorName: entry.companyName || null,
      projectId: entry.projectId || null,
      workItemId: entry.workItemId || null,
      totalAmount,
      outstandingAmount,
      paidAmount,
      dueDate,
      status,
      paymentStatus: outstandingAmount <= 0 ? 'paid' : 'pending_payment',
      requiresEvidence: entry.entryType === 'payable',
      notes: entry.validationMessage || null,
    },
  });
}
export async function syncProjectItemStateToFinance(tx, payload) {
  const project = await tx.project.findUnique({
    where: { id: payload.projectId },
    select: { id: true, name: true, clientName: true, clientAccountId: true },
  });
  const workItem = await tx.workItem.findUnique({
    where: { id: payload.workItemId },
    select: { id: true, title: true },
  });

  const actor = {
    actorUserId: payload.actorUserId || null,
    actorDisplayName: payload.actorDisplayName || 'System',
  };

  const receivableAmount = decimalToNumber(payload.state.poUnitPriceCompleted);
  const payableAmount = decimalToNumber(payload.state.contractorPayableAmount);
  const receivableReference = `${payload.projectId}:${payload.workItemId}:po_unit_price_completed`;
  const payableReference = `${payload.projectId}:${payload.workItemId}:contractor_payable_amount`;

  const currentEntries = await tx.financeEntry.findMany({
    where: {
      referenceCode: { in: [receivableReference, payableReference] },
    },
    include: {
      evidenceDocuments: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });
  const byReference = new Map(currentEntries.map((entry) => [entry.referenceCode, entry]));

  if (receivableAmount !== null && receivableAmount > 0) {
    await upsertFinanceEntry(tx, {
      referenceCode: receivableReference,
      entryType: 'receivable',
      direction: 'inflow',
      title: `Project receivable - ${workItem?.title || payload.workItemId}`,
      memo: `Expected inflow from ${project?.name || payload.projectId}`,
      amount: receivableAmount,
      sourceModule: 'projects',
      sourceEntity: 'project_item_state',
      sourceEntityId: payload.state.id,
      sourceEvent: 'po_unit_price_completed',
      sourceField: 'poUnitPriceCompleted',
      projectId: payload.projectId,
      workItemId: payload.workItemId,
      companyName: project?.clientName || null,
      clientAccountId: project?.clientAccountId || null,
      accountCode: 'acc_project_receivables',
      categoryCode: 'cat_project_receivables',
      approvalStatus: 'approved',
      settlementStatus: 'open',
      expectedAt: new Date(),
      validationMessage: payload.state.acceptanceStatus === 'signed' ? null : 'Waiting for signed acceptance.',
      metadataJson: {
        financeSyncStatus: payload.state.financeSyncStatus,
        workItemTitle: workItem?.title || null,
      },
      sourceSnapshot: {
        poUnitPriceCompleted: receivableAmount,
        acceptanceStatus: payload.state.acceptanceStatus,
      },
      ...actor,
    });
    const receivableEntry = await tx.financeEntry.findUnique({ where: { referenceCode: receivableReference } });
    if (receivableEntry) await upsertReceivableControl(tx, receivableEntry);
  } else {
    await softDeleteFinanceEntry(tx, byReference.get(receivableReference), actor, 'Receivable source amount is no longer available.');
  }

  if (payableAmount !== null && payableAmount > 0) {
    await upsertFinanceEntry(tx, {
      referenceCode: payableReference,
      entryType: 'payable',
      direction: 'outflow',
      title: `Project contractor payable - ${workItem?.title || payload.workItemId}`,
      memo: `Expected contractor payment for ${project?.name || payload.projectId}`,
      amount: payableAmount,
      sourceModule: 'projects',
      sourceEntity: 'project_item_state',
      sourceEntityId: payload.state.id,
      sourceEvent: 'contractor_payable_amount',
      sourceField: 'contractorPayableAmount',
      projectId: payload.projectId,
      workItemId: payload.workItemId,
      companyName: project?.clientName || null,
      clientAccountId: project?.clientAccountId || null,
      accountCode: 'acc_project_payables',
      categoryCode: 'cat_project_payables',
      approvalStatus: 'pending',
      settlementStatus: 'open',
      expectedAt: new Date(),
      validationMessage: payload.state.financialEligibilityReason || null,
      metadataJson: {
        financeSyncStatus: payload.state.financeSyncStatus,
        workItemTitle: workItem?.title || null,
      },
      sourceSnapshot: {
        contractorPayableAmount: payableAmount,
        qaStatus: payload.state.qaStatus,
        acceptanceStatus: payload.state.acceptanceStatus,
        isFinanciallyEligible: payload.state.isFinanciallyEligible,
      },
      ...actor,
    });
    const payableEntry = await tx.financeEntry.findUnique({ where: { referenceCode: payableReference } });
    if (payableEntry) await upsertPayableControl(tx, payableEntry);
  } else {
    await softDeleteFinanceEntry(tx, byReference.get(payableReference), actor, 'Payable source amount is no longer financially eligible.');
  }
}

export async function listFinanceEntries(prisma, filters = {}) {
  const where = {
    isDeleted: false,
  };
  if (filters.entryType) where.entryType = filters.entryType;
  if (filters.direction) where.direction = filters.direction;
  if (filters.lifecycleStatus) where.lifecycleStatus = filters.lifecycleStatus;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.workItemId) where.workItemId = filters.workItemId;

  const scopedUserId = filters.userId ? String(filters.userId).trim() : '';
  if (scopedUserId) {
    const [membershipRows, stakeholderRows] = await Promise.all([
      prisma.projectMember.findMany({
        where: { userId: scopedUserId, isDeleted: false },
        select: { projectId: true },
      }),
      prisma.resourceStakeholder.findMany({
        where: {
          module: 'finance',
          resourceType: 'finance_entry',
          userId: scopedUserId,
          isActive: true,
        },
        select: { resourceId: true },
      }),
    ]);
    const projectIds = [...new Set((membershipRows || []).map((row) => row.projectId).filter(Boolean))];
    const stakeholderEntryIds = [...new Set((stakeholderRows || []).map((row) => row.resourceId).filter(Boolean))];
    where.OR = [
      { approvedByUserId: scopedUserId },
      ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
      ...(stakeholderEntryIds.length ? [{ id: { in: stakeholderEntryIds } }] : []),
    ];
  }

  return prisma.financeEntry.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      evidenceDocuments: {
        where: { deletedAt: null },
        select: { id: true, documentType: true, validationStatus: true, originalFileName: true, createdAt: true },
      },
      approvals: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      sourceLinks: true,
    },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function getFinanceEntryDetail(prisma, financeEntryId) {
  return prisma.financeEntry.findFirst({
    where: { id: financeEntryId, isDeleted: false },
    include: {
      evidenceDocuments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      approvals: {
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
      },
      sourceLinks: true,
    },
  });
}

export async function listFinanceEntryActivity(prisma, financeEntryId) {
  return prisma.financeActivity.findMany({
    where: { financeEntryId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function listFinanceEntryEvidence(prisma, financeEntryId) {
  return prisma.financeEvidenceDocument.findMany({
    where: { financeEntryId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

function ensureAllowedFile(meta) {
  const allowedMime = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);
  if (!meta.mimeType || !allowedMime.has(meta.mimeType)) {
    throw new Error('Unsupported finance evidence file type.');
  }
  if (!meta.sizeBytes || meta.sizeBytes <= 0 || meta.sizeBytes > 15 * 1024 * 1024) {
    throw new Error('Finance evidence file size is invalid.');
  }
}

export async function uploadFinanceEvidence(prisma, payload) {
  ensureAllowedFile(payload);
  ensureDir(FILE_ROOT);
  const entry = await prisma.financeEntry.findFirst({
    where: { id: payload.financeEntryId, isDeleted: false },
  });
  if (!entry) throw new Error('Finance entry not found.');

  const ext = extensionFromName(payload.originalFileName);
  const storedFileName = `${entry.id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext ? `.${ext}` : ''}`;
  const absolutePath = path.join(FILE_ROOT, storedFileName);
  const buffer = Buffer.from(String(payload.contentBase64 || ''), 'base64');
  fs.writeFileSync(absolutePath, buffer);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return prisma.$transaction(async (tx) => {
    const file = await tx.financeEvidenceDocument.create({
      data: {
        financeEntryId: entry.id,
        originalFileName: payload.originalFileName,
        storedFileName,
        mimeType: payload.mimeType,
        extension: ext,
        sizeBytes: payload.sizeBytes,
        storageProvider: 'local',
        storagePath: path.relative(process.cwd(), absolutePath),
        uploadedByUserId: payload.actorUserId || null,
        uploadedByName: payload.actorDisplayName || null,
        documentType: payload.documentType || 'supporting_document',
        validationStatus: 'submitted',
        checksum,
        notes: payload.notes || null,
      },
    });

    const evidenceDocs = await tx.financeEvidenceDocument.count({
      where: { financeEntryId: entry.id, deletedAt: null },
    });
    const nextEvidenceStatus = detectEvidenceStatus(entry.entryType, evidenceDocs);
    const nextLifecycleStatus = detectLifecycleStatus(entry.entryType, evidenceDocs, entry.approvalStatus);
    await tx.financeEntry.update({
      where: { id: entry.id },
      data: {
        evidenceStatus: nextEvidenceStatus,
        lifecycleStatus: nextLifecycleStatus,
      },
    });

    await createFinanceActivity(tx, {
      financeEntryId: entry.id,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'evidence_uploaded',
      fieldName: 'evidence',
      oldValueJson: null,
      newValueJson: { fileName: payload.originalFileName, documentType: payload.documentType || 'supporting_document' },
      message: `${payload.actorDisplayName || 'User'} uploaded finance evidence ${payload.originalFileName}`,
      eventSource: 'file_upload',
    });

    const txId = randomUUID();
    await writeAuditLog(tx, {
      txId,
      userId: payload.actorUserId,
      entity: 'finance_evidence_document',
      entityId: file.id,
      actionType: 'uploaded',
      newValueJson: file,
      metaJson: { financeEntryId: entry.id },
    });
    await writeDomainEvent(tx, {
      txId,
      eventType: 'finance.evidence.uploaded',
      payloadJson: { financeEntryId: entry.id, evidenceId: file.id },
    });

    return file;
  });
}

export function resolveAbsoluteFinanceStoredPath(storagePath) {
  return path.resolve(process.cwd(), storagePath);
}

export async function approveFinanceEntry(prisma, financeEntryId, payload) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeEntry.findFirst({
      where: { id: financeEntryId, isDeleted: false },
    });
    if (!entry) throw new Error('Finance entry not found.');
    if (entry.entryType === 'payable' && entry.evidenceStatus === 'required_missing') {
      throw new Error('Supporting evidence is required before approval.');
    }

    const approval = await tx.financeApproval.create({
      data: {
        financeEntryId,
        action: 'approve',
        status: 'approved',
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
        notes: payload.notes || null,
      },
    });

    const updated = await tx.financeEntry.update({
      where: { id: financeEntryId },
      data: {
        approvalStatus: 'approved',
        lifecycleStatus: 'approved',
        approvedAt: new Date(),
        approvedByUserId: payload.actorUserId || null,
        validationMessage: payload.notes || null,
      },
    });

    await createFinanceActivity(tx, {
      financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'approval_approved',
      fieldName: 'approvalStatus',
      oldValueJson: entry.approvalStatus,
      newValueJson: 'approved',
      message: `${payload.actorDisplayName || 'User'} approved finance entry`,
      eventSource: 'user',
    });

    const txId = randomUUID();
    await writeAuditLog(tx, {
      txId,
      userId: payload.actorUserId,
      entity: 'finance_entry',
      entityId: financeEntryId,
      actionType: 'approved',
      oldValueJson: entry,
      newValueJson: updated,
      metaJson: { approvalId: approval.id, notes: payload.notes || null },
    });
    await writeDomainEvent(tx, {
      txId,
      eventType: 'finance.entry.approved',
      payloadJson: { financeEntryId, approvalId: approval.id },
    });

    return updated;
  });
}

export async function rejectFinanceEntry(prisma, financeEntryId, payload) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeEntry.findFirst({
      where: { id: financeEntryId, isDeleted: false },
    });
    if (!entry) throw new Error('Finance entry not found.');

    const approval = await tx.financeApproval.create({
      data: {
        financeEntryId,
        action: 'reject',
        status: 'rejected',
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
        notes: payload.notes || null,
      },
    });

    const updated = await tx.financeEntry.update({
      where: { id: financeEntryId },
      data: {
        approvalStatus: 'rejected',
        lifecycleStatus: 'rejected',
        validationMessage: payload.notes || 'Rejected by finance.',
      },
    });

    await createFinanceActivity(tx, {
      financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'approval_rejected',
      fieldName: 'approvalStatus',
      oldValueJson: entry.approvalStatus,
      newValueJson: 'rejected',
      message: `${payload.actorDisplayName || 'User'} rejected finance entry`,
      eventSource: 'user',
    });

    const txId = randomUUID();
    await writeAuditLog(tx, {
      txId,
      userId: payload.actorUserId,
      entity: 'finance_entry',
      entityId: financeEntryId,
      actionType: 'rejected',
      oldValueJson: entry,
      newValueJson: updated,
      metaJson: { approvalId: approval.id, notes: payload.notes || null },
    });
    await writeDomainEvent(tx, {
      txId,
      eventType: 'finance.entry.rejected',
      payloadJson: { financeEntryId, approvalId: approval.id },
    });

    return updated;
  });
}

export async function backfillProjectFinanceEntries(prisma) {
  const states = await prisma.projectItemState.findMany({
    where: {
      OR: [
        { poUnitPriceCompleted: { not: null } },
        { contractorPayableAmount: { not: null } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
  });

  let processed = 0;
  for (const state of states) {
    await prisma.$transaction(async (tx) => {
      await syncProjectItemStateToFinance(tx, {
        projectId: state.projectId,
        workItemId: state.workItemId,
        state,
        actorUserId: state.updatedByUserId || null,
        actorDisplayName: state.updatedByName || 'System',
      });
    });
    processed += 1;
  }

  return { processed };
}





export async function listReceivables(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.collectionStatus) where.collectionStatus = filters.collectionStatus;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.workItemId) where.workItemId = filters.workItemId;

  const scopedUserId = filters.userId ? String(filters.userId).trim() : '';
  if (scopedUserId) {
    const membershipRows = await prisma.projectMember.findMany({
      where: { userId: scopedUserId, isDeleted: false },
      select: { projectId: true },
    });
    const projectIds = [...new Set((membershipRows || []).map((row) => row.projectId).filter(Boolean))];
    if (filters.projectId) {
      if (!projectIds.includes(String(filters.projectId))) where.projectId = '__no_access__';
    } else if (projectIds.length) {
      where.projectId = { in: projectIds };
    } else {
      where.projectId = '__no_access__';
    }
  }

  return prisma.receivable.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      financeEntry: {
        include: {
          evidenceDocuments: { where: { deletedAt: null } },
          approvals: { orderBy: { createdAt: 'desc' }, take: 5 },
          activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
    },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function listPayables(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.workItemId) where.workItemId = filters.workItemId;

  const scopedUserId = filters.userId ? String(filters.userId).trim() : '';
  if (scopedUserId) {
    const membershipRows = await prisma.projectMember.findMany({
      where: { userId: scopedUserId, isDeleted: false },
      select: { projectId: true },
    });
    const projectIds = [...new Set((membershipRows || []).map((row) => row.projectId).filter(Boolean))];
    if (filters.projectId) {
      if (!projectIds.includes(String(filters.projectId))) where.projectId = '__no_access__';
    } else if (projectIds.length) {
      where.projectId = { in: projectIds };
    } else {
      where.projectId = '__no_access__';
    }
  }

  return prisma.payable.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      financeEntry: {
        include: {
          evidenceDocuments: { where: { deletedAt: null } },
          approvals: { orderBy: { createdAt: 'desc' }, take: 5 },
          activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
    },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function getReceivableDetail(prisma, receivableId) {
  return prisma.receivable.findUnique({
    where: { id: receivableId },
    include: {
      financeEntry: {
        include: {
          evidenceDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          approvals: { orderBy: { createdAt: 'desc' } },
          activities: { orderBy: { createdAt: 'desc' } },
          sourceLinks: true,
        },
      },
    },
  });
}

export async function getPayableDetail(prisma, payableId) {
  return prisma.payable.findUnique({
    where: { id: payableId },
    include: {
      financeEntry: {
        include: {
          evidenceDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          approvals: { orderBy: { createdAt: 'desc' } },
          activities: { orderBy: { createdAt: 'desc' } },
          sourceLinks: true,
        },
      },
    },
  });
}

export async function backfillReceivablesAndPayables(prisma) {
  const entries = await prisma.financeEntry.findMany({
    where: { isDeleted: false, entryType: { in: ['receivable', 'payable'] } },
    orderBy: { updatedAt: 'asc' },
  });

  let receivables = 0;
  let payables = 0;
  for (const entry of entries) {
    await prisma.$transaction(async (tx) => {
      if (entry.entryType === 'receivable') {
        await upsertReceivableControl(tx, entry);
        receivables += 1;
      }
      if (entry.entryType === 'payable') {
        await upsertPayableControl(tx, entry);
        payables += 1;
      }
    });
  }

  return { receivables, payables };
}



async function refreshReceivableTotals(tx, receivableId) {
  const receivable = await tx.receivable.findUnique({ where: { id: receivableId } });
  if (!receivable) throw new Error('Receivable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: receivable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for receivable.');
  const receipts = await tx.receiptCollection.findMany({ where: { receivableId } });
  const total = Number(receivable.totalAmount || 0);
  const collected = receipts.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const outstanding = Math.max(total - collected, 0);
  const isOverdue = Boolean(receivable.dueDate && outstanding > 0 && new Date(receivable.dueDate).getTime() < Date.now());
  const status = outstanding <= 0 ? 'collected' : isOverdue ? 'overdue' : 'open';
  const collectionStatus = outstanding <= 0 ? 'received' : 'pending_collection';

  const updated = await tx.receivable.update({
    where: { id: receivableId },
    data: {
      collectedAmount: collected,
      outstandingAmount: outstanding,
      isOverdue,
      status,
      collectionStatus,
      lastCollectedAt: receipts.length ? receipts.sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime())[0].receiptDate : receivable.lastCollectedAt,
    },
  });

  await tx.financeEntry.update({
    where: { id: updated.financeEntryId },
    data: {
      settlementStatus: outstanding <= 0 ? 'settled' : 'open',
      lifecycleStatus: outstanding <= 0 ? 'posted' : 'approved',
    },
  });

  return updated;
}

async function refreshPayableTotals(tx, payableId) {
  const payable = await tx.payable.findUnique({ where: { id: payableId } });
  if (!payable) throw new Error('Payable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: payable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for payable.');
  const payments = await tx.paymentDisbursement.findMany({ where: { payableId } });
  const total = Number(payable.totalAmount || 0);
  const paid = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const outstanding = Math.max(total - paid, 0);
  const status = payable.status === 'pending_evidence'
    ? 'pending_evidence'
    : outstanding <= 0
    ? 'paid'
    : payable.financeEntryId
    ? 'approved_for_payment'
    : 'pending_validation';

  const updated = await tx.payable.update({
    where: { id: payableId },
    data: {
      paidAmount: paid,
      outstandingAmount: outstanding,
      status,
      paymentStatus: outstanding <= 0 ? 'paid' : 'pending_payment',
      lastPaidAt: payments.length ? payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0].paymentDate : payable.lastPaidAt,
    },
  });

  await tx.financeEntry.update({
    where: { id: updated.financeEntryId },
    data: {
      settlementStatus: outstanding <= 0 ? 'settled' : 'open',
      lifecycleStatus: outstanding <= 0 ? 'approved' : 'approved',
    },
  });

  return updated;
}

export async function listCustomerInvoices(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.receivableId) where.receivableId = filters.receivableId;
  return prisma.customerInvoice.findMany({
    where,
    include: {
      receivable: {
        include: {
          financeEntry: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

function buildReference(prefix) {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${token}`;
}

export async function createCustomerInvoice(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: payload.receivableId } });
    if (!receivable) throw new Error('Receivable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: receivable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for receivable.');

    const now = new Date();
    const invoice = await tx.customerInvoice.create({
      data: {
        receivableId: payload.receivableId,
        invoiceNumber: payload.invoiceNumber || buildReference('INV'),
        issueDate: payload.issueDate ? new Date(payload.issueDate) : now,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : new Date(now.getTime() + 14 * 86400000),
        subtotalAmount: payload.subtotalAmount ?? receivable.totalAmount,
        taxAmount: payload.taxAmount ?? 0,
        totalAmount: payload.totalAmount ?? receivable.totalAmount,
        currencyCode: payload.currencyCode || 'USD',
        status: payload.status || 'sent',
        clientAccountId: receivable.clientAccountId || financeEntry.clientAccountId || null,
        notes: payload.notes || null,
        createdByUserId: payload.actorUserId || null,
        createdByName: payload.actorDisplayName || null,
      },
    });

    await createFinanceActivity(tx, {
      financeEntryId: receivable.financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'invoice_created',
      fieldName: 'invoiceNumber',
      oldValueJson: null,
      newValueJson: invoice.invoiceNumber,
      message: `${payload.actorDisplayName || 'User'} created invoice ${invoice.invoiceNumber}`,
      eventSource: 'user',
    });

    return invoice;
  });
}

export async function listVendorBills(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.payableId) where.payableId = filters.payableId;
  return prisma.vendorBill.findMany({
    where,
    include: {
      payable: {
        include: {
          financeEntry: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function createVendorBill(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findUnique({ where: { id: payload.payableId } });
    if (!payable) throw new Error('Payable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: payable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for payable.');

    const now = new Date();
    const bill = await tx.vendorBill.create({
      data: {
        payableId: payload.payableId,
        billNumber: payload.billNumber || buildReference('BILL'),
        issueDate: payload.issueDate ? new Date(payload.issueDate) : now,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : new Date(now.getTime() + 14 * 86400000),
        subtotalAmount: payload.subtotalAmount ?? payable.totalAmount,
        taxAmount: payload.taxAmount ?? 0,
        totalAmount: payload.totalAmount ?? payable.totalAmount,
        currencyCode: payload.currencyCode || 'USD',
        status: payload.status || 'received',
        notes: payload.notes || null,
        createdByUserId: payload.actorUserId || null,
        createdByName: payload.actorDisplayName || null,
      },
    });

    await createFinanceActivity(tx, {
      financeEntryId: payable.financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'bill_created',
      fieldName: 'billNumber',
      oldValueJson: null,
      newValueJson: bill.billNumber,
      message: `${payload.actorDisplayName || 'User'} created vendor bill ${bill.billNumber}`,
      eventSource: 'user',
    });

    return bill;
  });
}

export async function listPaymentDisbursements(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.payableId) where.payableId = filters.payableId;
  return prisma.paymentDisbursement.findMany({
    where,
    include: {
      payable: {
        include: {
          financeEntry: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function createPaymentDisbursement(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findUnique({ where: { id: payload.payableId } });
    if (!payable) throw new Error('Payable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: payable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for payable.');

    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (amount > Number(payable.outstandingAmount || 0)) throw new Error('Payment amount exceeds outstanding payable amount.');

    let proofDocumentId = payload.proofDocumentId || null;
    if (financeEntry.sourceModule === 'scm') {
      if (financeEntry.approvalStatus !== 'approved') throw new Error('SCM payable must be approved before payment.');
      await assertScmPreApprovalEvidence(tx, financeEntry.id);
      if (!proofDocumentId) {
        if (!payload.proofReference) throw new Error('Transfer proof / bank confirmation is required for SCM payment.');
        proofDocumentId = await attachSyntheticEvidence(tx, {
          financeEntryId: financeEntry.id,
          documentType: 'payment_transfer_proof',
          fileName: `${String(payload.proofReference).replace(/[^a-z0-9._-]/gi, '_')}.txt`,
          text: `Payment proof reference: ${payload.proofReference}`,
          actorUserId: payload.actorUserId || null,
          actorDisplayName: payload.actorDisplayName || null,
        });
      }
    }

    const payment = await tx.paymentDisbursement.create({
      data: {
        payableId: payload.payableId,
        paymentReference: payload.paymentReference || buildReference('PAY'),
        amount,
        currencyCode: payload.currencyCode || 'USD',
        paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
        method: payload.method || 'bank_transfer',
        status: payload.status || 'completed',
        proofDocumentId,
        notes: payload.notes || null,
        executedByUserId: payload.actorUserId || null,
        executedByName: payload.actorDisplayName || null,
      },
    });

    if (financeEntry.sourceModule === 'scm' && payload.sourceContext) {
      const src = payload.sourceContext;
      if (src.poId) {
        await upsertFinanceEntrySourceLink(tx, financeEntry.id, { sourceModule: 'scm', sourceEntity: 'purchase_order', sourceEntityId: String(src.poId), sourceEvent: 'payment_disbursed', sourceField: 'poId', sourceSnapshot: src });
      }
      if (src.billNumber) {
        await upsertFinanceEntrySourceLink(tx, financeEntry.id, { sourceModule: 'scm', sourceEntity: 'vendor_bill', sourceEntityId: String(src.billNumber), sourceEvent: 'payment_disbursed', sourceField: 'billNumber', sourceSnapshot: src });
      }
      if (src.grnNumber) {
        await upsertFinanceEntrySourceLink(tx, financeEntry.id, { sourceModule: 'scm', sourceEntity: 'goods_receipt', sourceEntityId: String(src.grnNumber), sourceEvent: 'payment_disbursed', sourceField: 'grnNumber', sourceSnapshot: src });
      }
    }

    const refreshed = await refreshPayableTotals(tx, payload.payableId);

    await createFinanceActivity(tx, {
      financeEntryId: payable.financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'payment_recorded',
      fieldName: 'payment',
      oldValueJson: null,
      newValueJson: { paymentReference: payment.paymentReference, amount: payment.amount },
      message: `${payload.actorDisplayName || 'User'} recorded payment ${payment.paymentReference}`,
      eventSource: 'user',
    });

    return { payment, payable: refreshed };
  });
}

export async function listReceiptCollections(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.receivableId) where.receivableId = filters.receivableId;
  return prisma.receiptCollection.findMany({
    where,
    include: {
      receivable: {
        include: {
          financeEntry: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function createReceiptCollection(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: payload.receivableId } });
    if (!receivable) throw new Error('Receivable not found.');
    const financeEntry = await tx.financeEntry.findUnique({ where: { id: receivable.financeEntryId } });
    if (!financeEntry) throw new Error('Finance entry not found for receivable.');

    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Receipt amount must be greater than zero.');
    if (amount > Number(receivable.outstandingAmount || 0)) throw new Error('Receipt amount exceeds outstanding receivable amount.');

    let proofDocumentId = payload.proofDocumentId || null;
    if (!proofDocumentId) {
      if (!payload.proofReference) throw new Error('Receipt proof is required.');
      proofDocumentId = await attachSyntheticEvidence(tx, {
        financeEntryId: financeEntry.id,
        documentType: 'receipt_payment_proof',
        fileName: `${String(payload.proofReference).replace(/[^a-z0-9._-]/gi, '_')}.txt`,
        text: `Receipt proof reference: ${payload.proofReference}`,
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
      });
    }

    const receipt = await tx.receiptCollection.create({
      data: {
        receivableId: payload.receivableId,
        receiptReference: payload.receiptReference || buildReference('RCPT'),
        amount,
        currencyCode: payload.currencyCode || 'USD',
        receiptDate: payload.receiptDate ? new Date(payload.receiptDate) : new Date(),
        method: payload.method || 'bank_transfer',
        status: payload.status || 'completed',
        proofDocumentId,
        notes: payload.notes || null,
        receivedByUserId: payload.actorUserId || null,
        receivedByName: payload.actorDisplayName || null,
      },
    });

    const refreshed = await refreshReceivableTotals(tx, payload.receivableId);

    await createFinanceActivity(tx, {
      financeEntryId: receivable.financeEntryId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName || 'User',
      actionType: 'receipt_recorded',
      fieldName: 'receipt',
      oldValueJson: null,
      newValueJson: { receiptReference: receipt.receiptReference, amount: receipt.amount },
      message: `${payload.actorDisplayName || 'User'} recorded receipt ${receipt.receiptReference}`,
      eventSource: 'user',
    });

    return { receipt, receivable: refreshed };
  });
}

export async function backfillInvoicesAndBills(prisma) {
  const receivables = await prisma.receivable.findMany({ include: { financeEntry: true } });
  const payables = await prisma.payable.findMany({ include: { financeEntry: true } });

  let invoices = 0;
  let bills = 0;

  for (const receivable of receivables) {
    const existing = await prisma.customerInvoice.count({ where: { receivableId: receivable.id } });
    if (existing > 0) continue;
    await prisma.customerInvoice.create({
      data: {
        receivableId: receivable.id,
        invoiceNumber: buildReference('INV-EXP'),
        issueDate: receivable.createdAt,
        dueDate: receivable.dueDate || new Date(receivable.createdAt.getTime() + 14 * 86400000),
        subtotalAmount: receivable.totalAmount,
        taxAmount: 0,
        totalAmount: receivable.totalAmount,
        currencyCode: 'USD',
        status: receivable.outstandingAmount > 0 ? 'sent' : 'paid',
        clientAccountId: receivable.clientAccountId || receivable.financeEntry?.clientAccountId || null,
        notes: 'Backfilled from Receivable control.',
      },
    });
    invoices += 1;
  }

  for (const payable of payables) {
    const existing = await prisma.vendorBill.count({ where: { payableId: payable.id } });
    if (existing > 0) continue;
    await prisma.vendorBill.create({
      data: {
        payableId: payable.id,
        billNumber: buildReference('BILL-EXP'),
        issueDate: payable.createdAt,
        dueDate: payable.dueDate || new Date(payable.createdAt.getTime() + 14 * 86400000),
        subtotalAmount: payable.totalAmount,
        taxAmount: 0,
        totalAmount: payable.totalAmount,
        currencyCode: 'USD',
        status: payable.outstandingAmount > 0 ? 'received' : 'paid',
        notes: 'Backfilled from Payable control.',
      },
    });
    bills += 1;
  }

  return { invoices, bills };
}






async function assertScmPreApprovalEvidence(tx, financeEntryId) {
  const evidence = await tx.financeEvidenceDocument.findMany({
    where: { financeEntryId, deletedAt: null },
    select: { documentType: true },
  });
  const types = new Set(evidence.map((row) => String(row.documentType || '').toLowerCase()));
  const required = ['po_document', 'supplier_invoice', 'grn_or_service_acceptance'];
  const missing = required.filter((type) => !types.has(type));
  if (missing.length > 0) {
    throw new Error(`Missing SCM supporting documents: ${missing.join(', ')}`);
  }
}

async function refreshEntryEvidenceState(tx, financeEntryId) {
  const entry = await tx.financeEntry.findUnique({ where: { id: financeEntryId } });
  if (!entry) return;
  const count = await tx.financeEvidenceDocument.count({ where: { financeEntryId, deletedAt: null } });
  const evidenceStatus = detectEvidenceStatus(entry.entryType, count);
  const lifecycleStatus = detectLifecycleStatus(entry.entryType, count, entry.approvalStatus);
  await tx.financeEntry.update({
    where: { id: financeEntryId },
    data: { evidenceStatus, lifecycleStatus },
  });
}

async function attachSyntheticEvidence(tx, payload) {
  const existing = await tx.financeEvidenceDocument.findFirst({
    where: { financeEntryId: payload.financeEntryId, deletedAt: null, documentType: payload.documentType },
    select: { id: true },
  });
  if (existing) return existing.id;

  ensureDir(FILE_ROOT);
  const id = randomUUID();
  const original = payload.fileName || 'evidence.txt';
  const storedFileName = `${id}-${original}`;
  const storagePath = path.join('backend', 'storage', 'finance-evidence', storedFileName);
  const absolutePath = path.resolve(process.cwd(), storagePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, Buffer.from(String(payload.text || ''), 'utf8'));

  const file = await tx.financeEvidenceDocument.create({
    data: {
      financeEntryId: payload.financeEntryId,
      originalFileName: original,
      storedFileName,
      mimeType: 'text/plain',
      extension: 'txt',
      sizeBytes: Buffer.byteLength(String(payload.text || ''), 'utf8'),
      storageProvider: 'local_fs',
      storagePath,
      uploadedByUserId: payload.actorUserId || null,
      uploadedByName: payload.actorDisplayName || null,
      documentType: payload.documentType,
      validationStatus: 'submitted',
      notes: 'Auto-linked from SCM flow',
    },
  });

  await createFinanceActivity(tx, {
    financeEntryId: payload.financeEntryId,
    actorUserId: payload.actorUserId || null,
    actorDisplayName: payload.actorDisplayName || 'System',
    actionType: 'scm_evidence_linked',
    fieldName: payload.documentType,
    oldValueJson: null,
    newValueJson: { evidenceId: file.id, fileName: original },
    message: `${payload.actorDisplayName || 'System'} linked SCM evidence ${payload.documentType}`,
    eventSource: 'system',
  });

  await refreshEntryEvidenceState(tx, payload.financeEntryId);
  return file.id;
}

export async function syncScmPoCommitment(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const poId = String(payload.poId || '').trim();
    if (!poId) throw new Error('poId is required.');
    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('PO commitment amount must be > 0.');

    const entry = await upsertFinanceEntry(tx, {
      referenceCode: `scm:po:${poId}:commitment`,
      entryType: 'commitment',
      direction: 'outflow',
      title: `SCM PO Commitment - ${payload.poNumber || poId}`,
      memo: payload.memo || 'Approved/Sent/Acknowledged PO commitment.',
      amount,
      currencyCode: payload.currencyCode || 'USD',
      sourceModule: 'scm',
      sourceEntity: 'purchase_order',
      sourceEntityId: poId,
      sourceEvent: String(payload.event || 'po_commitment'),
      sourceField: 'grandTotal',
      companyName: payload.vendorName || null,
      accountCode: 'acc_scm_commitments',
      categoryCode: 'cat_scm_commitments',
      approvalStatus: 'pending',
      settlementStatus: 'open',
      expectedAt: payload.expectedAt ? new Date(payload.expectedAt) : null,
      metadataJson: {
        poNumber: payload.poNumber || null,
        poStatus: payload.poStatus || null,
      },
      sourceSnapshot: payload,
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || 'System',
    });

    await upsertFinanceEntrySourceLink(tx, entry.id, {
      sourceModule: 'scm',
      sourceEntity: 'purchase_order',
      sourceEntityId: poId,
      sourceEvent: String(payload.event || 'po_commitment'),
      sourceField: 'poId',
      sourceSnapshot: payload,
    });

    return entry;
  });
}

export async function createScmVendorBill(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const poId = String(payload.poId || '').trim();
    const billNumber = String(payload.billNumber || '').trim();
    if (!poId) throw new Error('poId is required.');
    if (!billNumber) throw new Error('billNumber is required.');

    const amount = Number(payload.totalAmount || payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Vendor bill amount must be > 0.');

    const entry = await upsertFinanceEntry(tx, {
      referenceCode: `scm:po:${poId}:bill:${billNumber}`,
      entryType: 'payable',
      direction: 'outflow',
      title: `SCM Vendor Payable - ${billNumber}`,
      memo: payload.memo || `Vendor bill ${billNumber} for PO ${payload.poNumber || poId}`,
      amount,
      currencyCode: payload.currencyCode || 'USD',
      sourceModule: 'scm',
      sourceEntity: 'vendor_invoice',
      sourceEntityId: billNumber,
      sourceEvent: 'vendor_bill_registered',
      sourceField: 'totalAmount',
      companyName: payload.vendorName || null,
      accountCode: 'acc_scm_payables',
      categoryCode: 'cat_scm_payables',
      approvalStatus: 'pending',
      settlementStatus: 'open',
      expectedAt: payload.dueDate ? new Date(payload.dueDate) : null,
      metadataJson: {
        poId,
        poNumber: payload.poNumber || null,
        grnNumber: payload.grnNumber || null,
      },
      sourceSnapshot: payload,
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || 'System',
    });

    const payable = await upsertPayableControl(tx, entry, {
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      paidAmount: 0,
    });

    const bill = await tx.vendorBill.upsert({
      where: { billNumber },
      update: {
        payableId: payable.id,
        issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
        dueDate: payload.dueDate ? new Date(payload.dueDate) : new Date(Date.now() + 14 * 86400000),
        subtotalAmount: payload.subtotalAmount ?? amount,
        taxAmount: payload.taxAmount ?? 0,
        totalAmount: amount,
        currencyCode: payload.currencyCode || 'USD',
        status: payload.status || 'received',
        notes: payload.notes || null,
        createdByUserId: payload.actorUserId || null,
        createdByName: payload.actorDisplayName || null,
      },
      create: {
        payableId: payable.id,
        billNumber,
        issueDate: payload.issueDate ? new Date(payload.issueDate) : new Date(),
        dueDate: payload.dueDate ? new Date(payload.dueDate) : new Date(Date.now() + 14 * 86400000),
        subtotalAmount: payload.subtotalAmount ?? amount,
        taxAmount: payload.taxAmount ?? 0,
        totalAmount: amount,
        currencyCode: payload.currencyCode || 'USD',
        status: payload.status || 'received',
        notes: payload.notes || null,
        createdByUserId: payload.actorUserId || null,
        createdByName: payload.actorDisplayName || null,
      },
    });

    await upsertFinanceEntrySourceLink(tx, entry.id, {
      sourceModule: 'scm',
      sourceEntity: 'purchase_order',
      sourceEntityId: poId,
      sourceEvent: 'vendor_bill_registered',
      sourceField: 'poId',
      sourceSnapshot: payload,
    });
    await upsertFinanceEntrySourceLink(tx, entry.id, {
      sourceModule: 'scm',
      sourceEntity: 'vendor_bill',
      sourceEntityId: billNumber,
      sourceEvent: 'vendor_bill_registered',
      sourceField: 'billNumber',
      sourceSnapshot: payload,
    });
    if (payload.grnNumber) {
      await upsertFinanceEntrySourceLink(tx, entry.id, {
        sourceModule: 'scm',
        sourceEntity: 'goods_receipt',
        sourceEntityId: String(payload.grnNumber),
        sourceEvent: 'vendor_bill_registered',
        sourceField: 'grnNumber',
        sourceSnapshot: payload,
      });
    }

    await attachSyntheticEvidence(tx, {
      financeEntryId: entry.id,
      documentType: 'po_document',
      fileName: `${payload.poNumber || poId}-po.txt`,
      text: `PO: ${payload.poNumber || poId}`,
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || null,
    });
    await attachSyntheticEvidence(tx, {
      financeEntryId: entry.id,
      documentType: 'supplier_invoice',
      fileName: `${billNumber}-invoice.txt`,
      text: `Supplier invoice: ${billNumber}`,
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || null,
    });
    await attachSyntheticEvidence(tx, {
      financeEntryId: entry.id,
      documentType: 'grn_or_service_acceptance',
      fileName: `${payload.grnNumber || 'service-acceptance'}-receipt.txt`,
      text: payload.grnNumber ? `GRN: ${payload.grnNumber}` : 'Service acceptance attached by SCM.',
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || null,
    });

    return { entry, payable, bill };
  });
}

export async function getScmPoFinanceStatus(prisma, poId) {
  const poValue = String(poId);
  const commitments = await prisma.financeEntry.findMany({
    where: {
      isDeleted: false,
      sourceModule: 'scm',
      sourceEntity: 'purchase_order',
      sourceEntityId: poValue,
      entryType: 'commitment',
    },
    include: {
      sourceLinks: true,
      evidenceDocuments: { where: { deletedAt: null }, select: { id: true, documentType: true, validationStatus: true, originalFileName: true, createdAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const payables = await prisma.payable.findMany({
    where: {
      financeEntry: {
        isDeleted: false,
        sourceLinks: {
          some: {
            sourceModule: 'scm',
            sourceEntity: 'purchase_order',
            sourceEntityId: poValue,
          },
        },
      },
    },
    include: {
      financeEntry: {
        include: {
          sourceLinks: true,
          evidenceDocuments: { where: { deletedAt: null }, select: { id: true, documentType: true, validationStatus: true, originalFileName: true, createdAt: true } },
        },
      },
      bills: true,
      payments: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const bills = payables.flatMap((row) => row.bills);
  const payments = payables.flatMap((row) => row.payments);

  return {
    poId: poValue,
    commitments,
    payables,
    bills,
    payments,
  };
}

export async function syncScmRequisitionCommitment(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const reqId = String(payload.requisitionId || '').trim();
    if (!reqId) throw new Error('requisitionId is required.');

    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Requisition commitment amount must be > 0.');

    const entry = await upsertFinanceEntry(tx, {
      referenceCode: `scm:req:${reqId}:commitment`,
      entryType: 'commitment',
      direction: 'outflow',
      title: `SCM Requisition Commitment - ${payload.requisitionCode || reqId}`,
      memo: payload.memo || 'Service request estimated cost commitment.',
      amount,
      currencyCode: payload.currencyCode || 'USD',
      sourceModule: 'scm',
      sourceEntity: 'requisition',
      sourceEntityId: reqId,
      sourceEvent: String(payload.event || 'requisition_commitment_candidate'),
      sourceField: 'estimatedCost',
      companyName: payload.vendorName || null,
      accountCode: 'acc_scm_commitments',
      categoryCode: 'cat_scm_commitments',
      approvalStatus: 'pending',
      settlementStatus: 'open',
      expectedAt: payload.neededBy ? new Date(payload.neededBy) : null,
      metadataJson: payload,
      sourceSnapshot: payload,
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || 'System',
    });

    await upsertFinanceEntrySourceLink(tx, entry.id, {
      sourceModule: 'scm',
      sourceEntity: 'requisition',
      sourceEntityId: reqId,
      sourceEvent: String(payload.event || 'requisition_commitment_candidate'),
      sourceField: 'requisitionId',
      sourceSnapshot: payload,
    });

    return entry;
  });
}









function toNonNegativeNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

async function approveFinanceEntryInTx(tx, financeEntryId, payload = {}) {
  const entry = await tx.financeEntry.findFirst({ where: { id: financeEntryId, isDeleted: false } });
  if (!entry) throw new Error('Finance entry not found.');
  if (entry.entryType === 'payable' && entry.evidenceStatus === 'required_missing') {
    throw new Error('Supporting evidence is required before approval.');
  }

  await tx.financeApproval.create({
    data: {
      financeEntryId,
      action: 'approve',
      status: 'approved',
      actorUserId: payload.actorUserId || null,
      actorDisplayName: payload.actorDisplayName || null,
      notes: payload.notes || null,
    },
  });

  const updated = await tx.financeEntry.update({
    where: { id: financeEntryId },
    data: {
      approvalStatus: 'approved',
      lifecycleStatus: 'approved',
      approvedAt: new Date(),
      approvedByUserId: payload.actorUserId || null,
      validationMessage: payload.notes || null,
    },
  });

  await createFinanceActivity(tx, {
    financeEntryId,
    actorUserId: payload.actorUserId || null,
    actorDisplayName: payload.actorDisplayName || 'User',
    actionType: 'approval_approved',
    fieldName: 'approvalStatus',
    oldValueJson: entry.approvalStatus,
    newValueJson: 'approved',
    message: `${payload.actorDisplayName || 'User'} approved finance entry`,
    eventSource: 'user',
  });

  return updated;
}

async function createHrmPayableFromSource(tx, payload) {
  const entry = await upsertFinanceEntry(tx, {
    referenceCode: payload.referenceCode,
    entryType: 'payable',
    direction: 'outflow',
    title: payload.title,
    memo: payload.memo || null,
    amount: toNonNegativeNumber(payload.amount),
    currencyCode: payload.currencyCode || 'USD',
    sourceModule: 'hrm',
    sourceEntity: payload.sourceEntity,
    sourceEntityId: payload.sourceEntityId,
    sourceEvent: payload.sourceEvent || 'registered',
    sourceField: payload.sourceField || 'amount',
    companyName: payload.employeeName || null,
    accountCode: payload.accountCode || 'acc_hrm_payables',
    categoryCode: payload.categoryCode || 'cat_hrm_payables',
    approvalStatus: 'pending',
    settlementStatus: 'open',
    expectedAt: payload.expectedAt ? new Date(payload.expectedAt) : null,
    validationMessage: payload.validationMessage || null,
    metadataJson: payload.metadataJson || null,
    sourceSnapshot: payload.sourceSnapshot || null,
    actorUserId: payload.actorUserId || null,
    actorDisplayName: payload.actorDisplayName || 'System',
  });

  const payable = await upsertPayableControl(tx, entry, {
    dueDate: payload.expectedAt ? new Date(payload.expectedAt) : null,
    paidAmount: 0,
  });

  return { entry, payable };
}

export async function listPayrollBatches(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = String(filters.status);
  if (filters.approvalStatus) where.approvalStatus = String(filters.approvalStatus);

  return prisma.payrollBatch.findMany({
    where,
    include: {
      lines: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 100,
  });
}

export async function getPayrollBatchDetail(prisma, payrollBatchId) {
  const batch = await prisma.payrollBatch.findUnique({
    where: { id: payrollBatchId },
    include: {
      lines: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!batch) return null;

  const payableIds = batch.lines.map((line) => line.payableId).filter(Boolean);
  const payables = payableIds.length
    ? await prisma.payable.findMany({
        where: { id: { in: payableIds } },
        include: {
          financeEntry: {
            include: {
              evidenceDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
              activities: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
          },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      })
    : [];

  const payableById = new Map(payables.map((row) => [row.id, row]));
  return {
    ...batch,
    lines: batch.lines.map((line) => ({
      ...line,
      payable: line.payableId ? payableById.get(line.payableId) || null : null,
    })),
  };
}

export async function createPayrollBatch(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const linesPayload = Array.isArray(payload.lines) ? payload.lines : [];
    if (linesPayload.length === 0) throw new Error('Payroll batch must contain at least one line.');

    const preparedLines = linesPayload.map((line, index) => {
      const totalAmount = toNonNegativeNumber(line.totalAmount ?? line.netAmount);
      if (totalAmount <= 0) throw new Error(`Invalid payroll amount at line ${index + 1}.`);
      return {
        employeeUserId: line.employeeUserId || null,
        employeeCode: line.employeeCode || null,
        employeeName: String(line.employeeName || '').trim() || `Employee-${index + 1}`,
        bankAccountRef: line.bankAccountRef || null,
        netAmount: toNonNegativeNumber(line.netAmount ?? totalAmount),
        allowanceAmount: toNonNegativeNumber(line.allowanceAmount || 0),
        deductionAmount: toNonNegativeNumber(line.deductionAmount || 0),
        taxAmount: toNonNegativeNumber(line.taxAmount || 0),
        totalAmount,
        notes: line.notes || null,
      };
    });

    const totalAmount = preparedLines.reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);

    const batch = await tx.payrollBatch.create({
      data: {
        batchCode: payload.batchCode || buildReference('PAYROLL'),
        periodStart: payload.periodStart ? new Date(payload.periodStart) : new Date(),
        periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : new Date(),
        payoutDate: payload.payoutDate ? new Date(payload.payoutDate) : null,
        currencyCode: payload.currencyCode || 'USD',
        totalAmount,
        status: 'pending_approval',
        approvalStatus: 'pending',
        createdByUserId: payload.actorUserId || null,
        createdByName: payload.actorDisplayName || null,
        notes: payload.notes || null,
      },
    });

    for (const line of preparedLines) {
      const createdLine = await tx.payrollDisbursementLine.create({
        data: {
          payrollBatchId: batch.id,
          employeeUserId: line.employeeUserId,
          employeeCode: line.employeeCode,
          employeeName: line.employeeName,
          bankAccountRef: line.bankAccountRef,
          netAmount: line.netAmount,
          allowanceAmount: line.allowanceAmount,
          deductionAmount: line.deductionAmount,
          taxAmount: line.taxAmount,
          totalAmount: line.totalAmount,
          status: 'pending',
          notes: line.notes,
        },
      });

      const finance = await createHrmPayableFromSource(tx, {
        referenceCode: `hrm:payroll:line:${createdLine.id}`,
        title: `Payroll payable - ${createdLine.employeeName}`,
        memo: `Payroll batch ${batch.batchCode}`,
        amount: line.totalAmount,
        currencyCode: batch.currencyCode,
        sourceEntity: 'payroll_disbursement_line',
        sourceEntityId: createdLine.id,
        sourceEvent: 'payroll_line_registered',
        sourceField: 'totalAmount',
        employeeName: createdLine.employeeName,
        accountCode: 'acc_hrm_payroll_payables',
        categoryCode: 'cat_hrm_payroll',
        expectedAt: batch.payoutDate,
        validationMessage: 'Payroll batch pending finance approval.',
        metadataJson: { payrollBatchId: batch.id, employeeCode: createdLine.employeeCode },
        sourceSnapshot: { payrollBatchId: batch.id, batchCode: batch.batchCode, employeeName: createdLine.employeeName, totalAmount: line.totalAmount },
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || 'System',
      });

      await tx.payrollDisbursementLine.update({
        where: { id: createdLine.id },
        data: {
          payableId: finance.payable.id,
          status: 'pending_approval',
        },
      });
    }

    return getPayrollBatchDetail(tx, batch.id);
  });
}

export async function approvePayrollBatch(prisma, payrollBatchId, payload) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.payrollBatch.findUnique({
      where: { id: payrollBatchId },
      include: { lines: true },
    });
    if (!batch) throw new Error('Payroll batch not found.');

    if (!batch.lines.length) throw new Error('Payroll batch has no lines.');

    const proofRef = payload.registerProofReference || null;
    if (!batch.registerDocumentId && !proofRef) {
      throw new Error('Payroll batch register is required before approval.');
    }

    let registerDocumentId = batch.registerDocumentId;

    for (const line of batch.lines) {
      if (!line.payableId) continue;
      const payable = await tx.payable.findUnique({ where: { id: line.payableId } });
      if (!payable) continue;
      const entry = await tx.financeEntry.findUnique({ where: { id: payable.financeEntryId } });
      if (!entry) continue;

      if (proofRef) {
        const evidenceId = await attachSyntheticEvidence(tx, {
          financeEntryId: entry.id,
          documentType: 'payroll_batch_register',
          fileName: `${batch.batchCode}-register.txt`,
          text: `Payroll register reference: ${proofRef}`,
          actorUserId: payload.actorUserId || null,
          actorDisplayName: payload.actorDisplayName || null,
        });
        if (!registerDocumentId) registerDocumentId = evidenceId;
      }

      await approveFinanceEntryInTx(tx, entry.id, {
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
        notes: payload.notes || `Approved payroll line for ${line.employeeName}`,
      });

      await tx.payrollDisbursementLine.update({
        where: { id: line.id },
        data: { status: 'approved' },
      });
    }

    await tx.payrollBatch.update({
      where: { id: payrollBatchId },
      data: {
        approvalStatus: 'approved',
        status: 'approved',
        registerDocumentId: registerDocumentId || null,
        approvedByUserId: payload.actorUserId || null,
        approvedByName: payload.actorDisplayName || null,
        approvedAt: new Date(),
      },
    });

    return getPayrollBatchDetail(tx, payrollBatchId);
  });
}

export async function disbursePayrollLine(prisma, payrollLineId, payload) {
  const line = await prisma.payrollDisbursementLine.findUnique({ where: { id: payrollLineId } });
  if (!line) throw new Error('Payroll line not found.');
  if (!line.payableId) throw new Error('Payroll line is not linked to a payable.');

  const result = await createPaymentDisbursement(prisma, {
    payableId: line.payableId,
    amount: payload.amount ?? line.totalAmount,
    currencyCode: payload.currencyCode || 'USD',
    paymentDate: payload.paymentDate || new Date().toISOString(),
    method: payload.method || 'bank_transfer',
    status: payload.status || 'completed',
    notes: payload.notes || `Payroll payout for ${line.employeeName}`,
    proofReference: payload.proofReference,
    actorUserId: payload.actorUserId || null,
    actorDisplayName: payload.actorDisplayName || null,
  });

  const updatedLine = await prisma.payrollDisbursementLine.update({
    where: { id: payrollLineId },
    data: {
      paymentId: result.payment.id,
      proofDocumentId: result.payment.proofDocumentId || null,
      status: 'paid',
      paidAt: result.payment.paymentDate,
    },
  });

  const parent = await prisma.payrollBatch.findUnique({ where: { id: updatedLine.payrollBatchId }, include: { lines: true } });
  if (parent) {
    const allPaid = parent.lines.every((row) => row.status === 'paid' || row.status === 'reconciled' || row.id === updatedLine.id);
    if (allPaid) {
      await prisma.payrollBatch.update({ where: { id: parent.id }, data: { status: 'disbursed' } });
    }
  }

  return { line: updatedLine, payment: result.payment, payable: result.payable };
}

export async function reconcilePayrollBatch(prisma, payrollBatchId, payload) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.payrollBatch.findUnique({ where: { id: payrollBatchId }, include: { lines: true } });
    if (!batch) throw new Error('Payroll batch not found.');

    for (const line of batch.lines) {
      if (line.status === 'paid') {
        await tx.payrollDisbursementLine.update({
          where: { id: line.id },
          data: {
            status: 'reconciled',
            reconciledAt: new Date(),
          },
        });
      }
    }

    await tx.payrollBatch.update({
      where: { id: payrollBatchId },
      data: {
        status: 'reconciled',
        notes: payload?.notes || batch.notes || null,
      },
    });

    return getPayrollBatchDetail(tx, payrollBatchId);
  });
}

export async function listExpenseClaims(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = String(filters.status);
  return prisma.expenseClaim.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function createExpenseClaim(prisma, payload) {
  const amount = toNonNegativeNumber(payload.amount);
  if (amount <= 0) throw new Error('Expense claim amount must be greater than zero.');

  return prisma.expenseClaim.create({
    data: {
      claimNumber: payload.claimNumber || buildReference('EXP'),
      employeeUserId: payload.employeeUserId || null,
      employeeName: String(payload.employeeName || 'Employee').trim(),
      categoryCode: payload.categoryCode || null,
      description: payload.description || null,
      expenseDate: payload.expenseDate ? new Date(payload.expenseDate) : null,
      submissionDate: payload.submissionDate ? new Date(payload.submissionDate) : new Date(),
      amount,
      currencyCode: payload.currencyCode || 'USD',
      status: 'submitted',
      approvalStatus: 'pending',
      notes: payload.notes || null,
    },
  });
}

export async function approveExpenseClaim(prisma, claimId, payload) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.expenseClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error('Expense claim not found.');

    let payableId = claim.payableId;
    if (!payableId) {
      const finance = await createHrmPayableFromSource(tx, {
        referenceCode: `hrm:expense_claim:${claim.id}`,
        title: `Expense reimbursement - ${claim.employeeName}`,
        memo: claim.description || `Expense claim ${claim.claimNumber}`,
        amount: claim.amount,
        currencyCode: claim.currencyCode,
        sourceEntity: 'expense_claim',
        sourceEntityId: claim.id,
        sourceEvent: 'expense_claim_approved',
        sourceField: 'amount',
        employeeName: claim.employeeName,
        accountCode: 'acc_hrm_reimbursements',
        categoryCode: 'cat_hrm_reimbursements',
        expectedAt: new Date(),
        validationMessage: 'Expense claim approved; awaiting disbursement.',
        metadataJson: { claimNumber: claim.claimNumber },
        sourceSnapshot: claim,
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || 'System',
      });
      await attachSyntheticEvidence(tx, {
        financeEntryId: finance.entry.id,
        documentType: 'expense_claim_form',
        fileName: `${claim.claimNumber}-claim.txt`,
        text: `Expense claim approved: ${claim.claimNumber}`,
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
      });
      await approveFinanceEntryInTx(tx, finance.entry.id, {
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
        notes: payload.notes || 'Expense claim approved by finance.',
      });
      payableId = finance.payable.id;
    }

    return tx.expenseClaim.update({
      where: { id: claimId },
      data: {
        status: 'approved',
        approvalStatus: 'approved',
        approvedByUserId: payload.actorUserId || null,
        approvedByName: payload.actorDisplayName || null,
        approvedAt: new Date(),
        payableId,
      },
    });
  });
}

export async function listEmployeeAdvances(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = String(filters.status);
  return prisma.employeeAdvance.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 200,
  });
}

export async function createEmployeeAdvance(prisma, payload) {
  const amount = toNonNegativeNumber(payload.amount);
  if (amount <= 0) throw new Error('Employee advance amount must be greater than zero.');

  return prisma.employeeAdvance.create({
    data: {
      advanceNumber: payload.advanceNumber || buildReference('ADV'),
      employeeUserId: payload.employeeUserId || null,
      employeeName: String(payload.employeeName || 'Employee').trim(),
      reason: payload.reason || null,
      requestedAt: payload.requestedAt ? new Date(payload.requestedAt) : new Date(),
      amount,
      currencyCode: payload.currencyCode || 'USD',
      status: 'submitted',
      approvalStatus: 'pending',
      notes: payload.notes || null,
    },
  });
}

export async function approveEmployeeAdvance(prisma, advanceId, payload) {
  return prisma.$transaction(async (tx) => {
    const advance = await tx.employeeAdvance.findUnique({ where: { id: advanceId } });
    if (!advance) throw new Error('Employee advance not found.');

    let payableId = advance.payableId;
    if (!payableId) {
      const finance = await createHrmPayableFromSource(tx, {
        referenceCode: `hrm:employee_advance:${advance.id}`,
        title: `Employee advance - ${advance.employeeName}`,
        memo: advance.reason || `Employee advance ${advance.advanceNumber}`,
        amount: advance.amount,
        currencyCode: advance.currencyCode,
        sourceEntity: 'employee_advance',
        sourceEntityId: advance.id,
        sourceEvent: 'employee_advance_approved',
        sourceField: 'amount',
        employeeName: advance.employeeName,
        accountCode: 'acc_hrm_advances',
        categoryCode: 'cat_hrm_advances',
        expectedAt: new Date(),
        validationMessage: 'Employee advance approved; awaiting disbursement.',
        metadataJson: { advanceNumber: advance.advanceNumber },
        sourceSnapshot: advance,
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || 'System',
      });
      await attachSyntheticEvidence(tx, {
        financeEntryId: finance.entry.id,
        documentType: 'employee_advance_request',
        fileName: `${advance.advanceNumber}-advance.txt`,
        text: `Employee advance approved: ${advance.advanceNumber}`,
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
      });
      await approveFinanceEntryInTx(tx, finance.entry.id, {
        actorUserId: payload.actorUserId || null,
        actorDisplayName: payload.actorDisplayName || null,
        notes: payload.notes || 'Employee advance approved by finance.',
      });
      payableId = finance.payable.id;
    }

    return tx.employeeAdvance.update({
      where: { id: advanceId },
      data: {
        status: 'approved',
        approvalStatus: 'approved',
        approvedByUserId: payload.actorUserId || null,
        approvedByName: payload.actorDisplayName || null,
        approvedAt: new Date(),
        payableId,
      },
    });
  });
}







function statusFromIssues(issues) {
  if (!issues.length) return 'auto_matched';
  if (issues.some((i) => i.caseType === 'duplicate_settlement')) return 'duplicate';
  if (issues.some((i) => i.caseType === 'amount_mismatch')) return 'amount_mismatch';
  if (issues.some((i) => i.caseType === 'source_missing')) return 'source_missing';
  if (issues.some((i) => i.caseType === 'missing_proof')) return 'missing_proof';
  return 'unmatched';
}

function severityFromCaseType(caseType) {
  if (caseType === 'duplicate_settlement' || caseType === 'source_missing') return 'high';
  if (caseType === 'amount_mismatch') return 'medium';
  return 'low';
}

function buildDiscrepancy(caseType, base) {
  return {
    caseType,
    severity: severityFromCaseType(caseType),
    title: base.title,
    description: base.description || null,
    expectedAmount: base.expectedAmount ?? null,
    actualAmount: base.actualAmount ?? null,
    sourceModule: base.sourceModule || null,
    sourceEntity: base.sourceEntity || null,
    sourceEntityId: base.sourceEntityId || null,
    financeEntryId: base.financeEntryId || null,
  };
}

export async function runFinanceReconciliation(prisma, payload = {}) {
  return prisma.$transaction(async (tx) => {
    const receipts = await tx.receiptCollection.findMany({
      include: {
        receivable: {
          include: {
            financeEntry: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: payload.take ? Number(payload.take) : 500,
    });

    const payments = await tx.paymentDisbursement.findMany({
      include: {
        payable: {
          include: {
            financeEntry: true,
            bills: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: payload.take ? Number(payload.take) : 500,
    });

    const receiptRefCount = receipts.reduce((acc, row) => {
      const key = String(row.receiptReference || '').trim().toLowerCase();
      if (!key) return acc;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map());

    const paymentRefCount = payments.reduce((acc, row) => {
      const key = String(row.paymentReference || '').trim().toLowerCase();
      if (!key) return acc;
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map());

    const reconciliation = await tx.financeReconciliation.create({
      data: {
        reconciliationCode: payload.reconciliationCode || buildReference('RECON'),
        periodStart: payload.periodStart ? new Date(payload.periodStart) : null,
        periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : null,
        status: 'running',
        runByUserId: payload.actorUserId || null,
        runByName: payload.actorDisplayName || 'System',
      },
    });

    let lineCount = 0;
    let discrepancyCount = 0;
    let unmatchedReceipts = 0;
    let unmatchedPayments = 0;

    for (const receipt of receipts) {
      const issues = [];
      const expectedAmount = Number(receipt.receivable?.totalAmount || 0);
      const actualAmount = Number(receipt.amount || 0);
      const financeEntry = receipt.receivable?.financeEntry || null;
      const refKey = String(receipt.receiptReference || '').trim().toLowerCase();

      if (!receipt.receivable || !financeEntry) {
        issues.push(buildDiscrepancy('source_missing', {
          title: `Receipt ${receipt.receiptReference} has missing receivable source`,
          description: 'Receipt cannot be linked to a valid receivable/finance entry.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'receipt_collection',
          sourceEntityId: receipt.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (!receipt.proofDocumentId) {
        issues.push(buildDiscrepancy('missing_proof', {
          title: `Receipt ${receipt.receiptReference} missing proof`,
          description: 'Payment receipt proof document is missing.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'receipt_collection',
          sourceEntityId: receipt.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (expectedAmount > 0 && actualAmount > expectedAmount) {
        issues.push(buildDiscrepancy('amount_mismatch', {
          title: `Receipt ${receipt.receiptReference} amount mismatch`,
          description: 'Received amount exceeds expected receivable amount.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'receipt_collection',
          sourceEntityId: receipt.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (refKey && (receiptRefCount.get(refKey) || 0) > 1) {
        issues.push(buildDiscrepancy('duplicate_settlement', {
          title: `Receipt ${receipt.receiptReference} appears duplicated`,
          description: 'Same receipt reference is used by multiple collections.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'receipt_collection',
          sourceEntityId: receipt.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      const line = await tx.reconciliationLine.create({
        data: {
          reconciliationId: reconciliation.id,
          movementType: 'receipt',
          movementId: receipt.id,
          referenceCode: receipt.receiptReference,
          sourceModule: 'finance',
          sourceEntity: 'receipt_collection',
          sourceEntityId: receipt.id,
          financeEntryId: financeEntry?.id || null,
          expectedAmount: expectedAmount || null,
          actualAmount: actualAmount || null,
          proofPresent: Boolean(receipt.proofDocumentId),
          matchStatus: statusFromIssues(issues),
          notes: issues.length ? 'Discrepancy detected' : 'Auto matched',
        },
      });
      lineCount += 1;
      if (issues.length) unmatchedReceipts += 1;

      for (const issue of issues) {
        await tx.discrepancyCase.create({
          data: {
            reconciliationId: reconciliation.id,
            lineId: line.id,
            ...issue,
          },
        });
        discrepancyCount += 1;
      }
    }

    for (const payment of payments) {
      const issues = [];
      const expectedAmount = Number(payment.payable?.totalAmount || 0);
      const actualAmount = Number(payment.amount || 0);
      const financeEntry = payment.payable?.financeEntry || null;
      const refKey = String(payment.paymentReference || '').trim().toLowerCase();

      if (!payment.payable || !financeEntry) {
        issues.push(buildDiscrepancy('source_missing', {
          title: `Payment ${payment.paymentReference} has missing payable source`,
          description: 'Payment cannot be linked to a valid payable/finance entry.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'payment_disbursement',
          sourceEntityId: payment.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (!payment.proofDocumentId) {
        issues.push(buildDiscrepancy('missing_proof', {
          title: `Payment ${payment.paymentReference} missing proof`,
          description: 'Bank transfer proof is missing.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'payment_disbursement',
          sourceEntityId: payment.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (expectedAmount > 0 && actualAmount > expectedAmount) {
        issues.push(buildDiscrepancy('amount_mismatch', {
          title: `Payment ${payment.paymentReference} amount mismatch`,
          description: 'Disbursed amount exceeds expected payable amount.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'payment_disbursement',
          sourceEntityId: payment.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      if (refKey && (paymentRefCount.get(refKey) || 0) > 1) {
        issues.push(buildDiscrepancy('duplicate_settlement', {
          title: `Payment ${payment.paymentReference} appears duplicated`,
          description: 'Same payment reference is used by multiple disbursements.',
          expectedAmount,
          actualAmount,
          sourceModule: 'finance',
          sourceEntity: 'payment_disbursement',
          sourceEntityId: payment.id,
          financeEntryId: financeEntry?.id || null,
        }));
      }

      const line = await tx.reconciliationLine.create({
        data: {
          reconciliationId: reconciliation.id,
          movementType: 'payment',
          movementId: payment.id,
          referenceCode: payment.paymentReference,
          sourceModule: 'finance',
          sourceEntity: 'payment_disbursement',
          sourceEntityId: payment.id,
          financeEntryId: financeEntry?.id || null,
          expectedAmount: expectedAmount || null,
          actualAmount: actualAmount || null,
          proofPresent: Boolean(payment.proofDocumentId),
          matchStatus: statusFromIssues(issues),
          notes: issues.length ? 'Discrepancy detected' : 'Auto matched',
        },
      });
      lineCount += 1;
      if (issues.length) unmatchedPayments += 1;

      for (const issue of issues) {
        await tx.discrepancyCase.create({
          data: {
            reconciliationId: reconciliation.id,
            lineId: line.id,
            ...issue,
          },
        });
        discrepancyCount += 1;
      }
    }

    const summary = {
      lineCount,
      discrepancyCount,
      unmatchedReceipts,
      unmatchedPayments,
      matchedLines: lineCount - (unmatchedReceipts + unmatchedPayments),
    };

    const finalized = await tx.financeReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: 'completed',
        summaryJson: summary,
      },
    });

    return finalized;
  });
}

export async function listFinanceReconciliations(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = String(filters.status);
  return prisma.financeReconciliation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          lines: true,
          discrepancyCases: true,
        },
      },
    },
    take: filters.take ? Number(filters.take) : 100,
  });
}

export async function getFinanceReconciliationDetail(prisma, reconciliationId) {
  return prisma.financeReconciliation.findUnique({
    where: { id: reconciliationId },
    include: {
      lines: {
        orderBy: { createdAt: 'desc' },
      },
      discrepancyCases: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function listReconciliationUnmatchedReceipts(prisma, reconciliationId) {
  return prisma.reconciliationLine.findMany({
    where: {
      reconciliationId,
      movementType: 'receipt',
      matchStatus: { not: 'auto_matched' },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listReconciliationUnmatchedPayments(prisma, reconciliationId) {
  return prisma.reconciliationLine.findMany({
    where: {
      reconciliationId,
      movementType: 'payment',
      matchStatus: { not: 'auto_matched' },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listReconciliationDiscrepancyCases(prisma, reconciliationId, filters = {}) {
  const where = {
    reconciliationId,
  };
  if (filters.status) where.status = String(filters.status);
  return prisma.discrepancyCase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveDiscrepancyCase(prisma, caseId, payload = {}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.discrepancyCase.findUnique({ where: { id: caseId } });
    if (!existing) throw new Error('Discrepancy case not found.');

    const updated = await tx.discrepancyCase.update({
      where: { id: caseId },
      data: {
        status: payload.status || 'resolved',
        resolutionNotes: payload.resolutionNotes || null,
        resolvedByUserId: payload.actorUserId || null,
        resolvedByName: payload.actorDisplayName || null,
        resolvedAt: new Date(),
      },
    });

    if (existing.lineId) {
      await tx.reconciliationLine.update({
        where: { id: existing.lineId },
        data: {
          matchStatus: 'resolved',
          notes: payload.resolutionNotes || 'Resolved manually',
        },
      });
    }

    return updated;
  });
}
