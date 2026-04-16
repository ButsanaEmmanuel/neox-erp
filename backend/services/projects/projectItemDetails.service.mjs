import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { syncProjectItemStateToFinance } from '../finance/financeEntries.service.mjs';
import { notifyTeam } from './projectCollaboration.service.mjs';
import { broadcast as sseBroadcast } from '../realtime/sseBroadcaster.mjs';

const FILE_ROOT = path.resolve(process.cwd(), 'backend', 'storage', 'project-item-files');

export const MANUAL_FIELD_CATALOG = {
  operational: [
    { key: 'planning_audit_date', label: 'Planning Audit Date', type: 'date' },
    { key: 'planning_audit_week', label: 'Planning Audit Week', type: 'number', computedReadonly: true, derivedFrom: 'planning_audit_date' },
    { key: 'forecast_date', label: 'Forecast Date', type: 'date' },
    { key: 'forecast_week', label: 'Forecast Week', type: 'number', computedReadonly: true, derivedFrom: 'forecast_date' },
    { key: 'actual_audit_date', label: 'Actual Audit Date', type: 'date' },
    { key: 'actual_audit_week', label: 'Actual Audit Week', type: 'number', computedReadonly: true, derivedFrom: 'actual_audit_date' },
    { key: 'qa_visit_date', label: 'QA Visit Date', type: 'date', required: true },
    { key: 'qa_status', label: 'QA Status', type: 'enum', options: ['Pending', 'Approved', 'Rejected'], required: true },
    { key: 'report_posted_week', label: 'Report Posted Week', type: 'number' },
    { key: 'submission_report_date', label: 'Submission Report Date', type: 'date' },
    { key: 'site_readiness_note', label: 'Site Readiness Note', type: 'text' },
  ],
  acceptance: [
    { key: 'acceptance_signed', label: 'Acceptance Signed', type: 'boolean', required: true },
    { key: 'acceptance_signed_date', label: 'Acceptance Signed Date', type: 'date', required: true },
    { key: 'acceptance_reference', label: 'Acceptance Reference', type: 'text' },
    { key: 'handover_status', label: 'Handover Status', type: 'enum', options: ['Pending', 'Completed', 'Blocked'] },
    { key: 'acceptance_comment', label: 'Acceptance Comment', type: 'text' },
  ],
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'object' ? (typeof value.toString === 'function' ? value.toString() : String(value)) : value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Excel serial date support (days since 1899-12-30)
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0 && asNumber < 100000) {
    const epoch = Date.UTC(1899, 11, 30);
    const millis = epoch + Math.round(asNumber) * 86400000;
    const excelDate = new Date(millis);
    const year = excelDate.getUTCFullYear();
    if (year >= 2000 && year <= 2100) {
      return excelDate.toISOString().slice(0, 10);
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Strict ISO only to avoid parsing random ids as years (e.g. "25547")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return raw;
}

function isoWeek(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function deriveDateWeeks(operationalFields = {}) {
  const next = { ...operationalFields };
  const mapping = [
    ['planning_audit_date', 'planning_audit_week'],
    ['forecast_date', 'forecast_week'],
    ['actual_audit_date', 'actual_audit_week'],
  ];

  for (const [dateField, weekField] of mapping) {
    const normalizedDate = toIsoDate(next[dateField]);
    if (!normalizedDate) {
      delete next[weekField];
      continue;
    }
    next[dateField] = normalizedDate;
    const week = isoWeek(normalizedDate);
    if (week === null) delete next[weekField];
    else next[weekField] = week;
  }
  return next;
}

function deriveScheduleVariance(importedFields = {}, operationalFields = {}) {
  const planned = toIsoDate(importedFields?.planned_start_date);
  const actual = toIsoDate(operationalFields?.actual_audit_date);
  if (!planned || !actual) {
    return { startVarianceDays: null, scheduleStatus: null, isDelayed: false };
  }
  const plannedDate = new Date(`${planned}T00:00:00.000Z`);
  const actualDate = new Date(`${actual}T00:00:00.000Z`);
  const diffDays = Math.round((actualDate.getTime() - plannedDate.getTime()) / 86400000);
  if (!Number.isFinite(diffDays) || Math.abs(diffDays) > 3650) {
    return { startVarianceDays: null, scheduleStatus: null, isDelayed: false };
  }
  if (diffDays > 0) return { startVarianceDays: diffDays, scheduleStatus: 'delayed', isDelayed: true };
  if (diffDays < 0) return { startVarianceDays: diffDays, scheduleStatus: 'early', isDelayed: false };
  return { startVarianceDays: 0, scheduleStatus: 'on_time', isDelayed: false };
}

function getEligibility(state) {
  const unit = numberOrNull(state.poUnitPrice);
  const ticket = numberOrNull(state.ticketNumber);
  const hasUnit = unit !== null && unit > 0;
  const hasTicket = ticket !== null && ticket > 0;
  if (!hasUnit || !hasTicket) {
    return { eligible: false, reason: 'Waiting for valid ticket number and PO unit price.' };
  }
  if ((state.qaStatus || '').toLowerCase() !== 'approved') {
    return { eligible: false, reason: 'Waiting for QA approval.' };
  }
  if ((state.acceptanceStatus || '').toLowerCase() !== 'signed') {
    return { eligible: false, reason: 'Waiting for signed acceptance.' };
  }
  return { eligible: true, reason: null };
}

function deriveWorkItemStatus(state, eligibility) {
  const ticket = numberOrNull(state.ticketNumber);
  if (ticket === null || ticket <= 0) return 'needs_manual_completion';
  if ((state.qaStatus || '').toLowerCase() !== 'approved') return 'awaiting_qa_approval';
  if ((state.acceptanceStatus || '').toLowerCase() !== 'signed') return 'awaiting_signed_acceptance';
  if (eligibility?.eligible) return 'finance_synced';
  return 'finance_pending';
}

async function assertProjectWorkItemIntegrity(prisma, projectId, workItemId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { id: true },
  });
  if (!project) {
    throw new Error('Project not found. Action blocked to prevent orphan records.');
  }

  const workItem = await prisma.workItem.findFirst({
    where: { id: workItemId, projectId, isDeleted: false },
    select: { id: true },
  });
  if (!workItem) {
    throw new Error('Work item not found in project. Action blocked to prevent orphan records.');
  }
}

export async function createActivity(prisma, payload) {
  await assertProjectWorkItemIntegrity(prisma, payload.projectId, payload.workItemId);
  return prisma.projectItemActivity.create({
    data: {
      entityType: payload.entityType || 'project_item',
      entityId: payload.entityId,
      projectId: payload.projectId,
      workItemId: payload.workItemId,
      actorUserId: payload.actorUserId,
      actorDisplayName: payload.actorDisplayName,
      actionType: payload.actionType,
      fieldName: payload.fieldName,
      oldValueJson: payload.oldValueJson,
      newValueJson: payload.newValueJson,
      message: payload.message,
      eventSource: payload.eventSource,
    },
  });
}

function diffManualFields(before = {}, after = {}, groupPrefix) {
  const events = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    const oldValue = before?.[key];
    const newValue = after?.[key];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    if ((oldValue === undefined || oldValue === null || oldValue === '') && newValue !== undefined && newValue !== null && newValue !== '') {
      events.push({ actionType: 'manual_field_added', fieldName: `${groupPrefix}.${key}`, oldValueJson: oldValue ?? null, newValueJson: newValue, verb: 'set' });
    } else if (newValue === undefined || newValue === null || newValue === '') {
      events.push({ actionType: 'manual_field_removed', fieldName: `${groupPrefix}.${key}`, oldValueJson: oldValue ?? null, newValueJson: null, verb: 'removed' });
    } else {
      events.push({ actionType: 'manual_field_updated', fieldName: `${groupPrefix}.${key}`, oldValueJson: oldValue ?? null, newValueJson: newValue, verb: 'updated' });
    }
  }
  return events;
}

function humanizeFieldName(fieldName = '') {
  const map = {
    ticket_number: 'Ticket Number',
    contractor_payable_amount: 'Contractor Payable Amount',
    qa_status: 'QA Status',
    acceptance_status: 'Acceptance Status',
    'operational.qa_visit_date': 'Operational • QA Visit Date',
    'operational.forecast_date': 'Operational • Forecast Date',
    'operational.actual_audit_date': 'Operational • Actual Audit Date',
    'acceptance.acceptance_signed': 'Acceptance • Signed',
    'acceptance.acceptance_signed_date': 'Acceptance • Signed Date',
  };
  if (map[fieldName]) return map[fieldName];
  return String(fieldName || '')
    .replace(/^operational\./, 'Operational • ')
    .replace(/^acceptance\./, 'Acceptance • ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function saveProjectItemDetails(prisma, input) {
  console.info('[projectItemDetails] Save request received', {
    projectId: input.projectId,
    workItemId: input.workItemId,
    actorUserId: input.actorUserId || null,
    payload: {
      ticketNumber: input.ticketNumber ?? null,
      qaStatus: input.qaStatus ?? null,
      acceptanceStatus: input.acceptanceStatus ?? null,
      operationalManualFields: input.operationalManualFields || null,
      acceptanceManualFields: input.acceptanceManualFields || null,
    },
  });
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new Error('Project not found. Cannot persist project item details without a valid project.');
    }

    const workItem = await tx.workItem.findFirst({
      where: {
        id: input.workItemId,
        projectId: input.projectId,
        isDeleted: false,
      },
      select: { id: true, title: true },
    });
    if (!workItem) {
      throw new Error('Work item not found in this project. Save blocked to prevent orphan records.');
    }

    const existing = await tx.projectItemState.findUnique({
      where: {
        projectId_workItemId: {
          projectId: input.projectId,
          workItemId: input.workItemId,
        },
      },
    });

    const current = existing || {
      projectId: input.projectId,
      workItemId: input.workItemId,
      poUnitPrice: input.poUnitPrice ?? null,
      ticketNumber: null,
      qaStatus: 'pending',
      acceptanceStatus: 'pending',
      operationalManualFieldsJson: {},
      acceptanceManualFieldsJson: {},
      financeSyncStatus: 'blocked',
      isFinanciallyEligible: false,
    };

    const next = {
      ...current,
      poUnitPrice: input.poUnitPrice ?? current.poUnitPrice,
      ticketNumber: input.ticketNumber !== undefined ? input.ticketNumber : current.ticketNumber,
      contractorPayableAmount:
        input.contractorPayableAmount !== undefined
          ? input.contractorPayableAmount
          : current.contractorPayableAmount,
      qaStatus: input.qaStatus !== undefined ? input.qaStatus : current.qaStatus,
      acceptanceStatus: input.acceptanceStatus !== undefined ? input.acceptanceStatus : current.acceptanceStatus,
      operationalManualFieldsJson: input.operationalManualFields ?? current.operationalManualFieldsJson,
      acceptanceManualFieldsJson: input.acceptanceManualFields ?? current.acceptanceManualFieldsJson,
      updatedByUserId: input.actorUserId,
      updatedByName: input.actorDisplayName,
    };

    next.operationalManualFieldsJson = deriveDateWeeks(next.operationalManualFieldsJson || {});
    const importedFields = input.importedFields || current.importedFieldsJson || {};
    const schedule = deriveScheduleVariance(importedFields, next.operationalManualFieldsJson || {});
    const planningAuditDate =
      toIsoDate(next.operationalManualFieldsJson?.planning_audit_date)
      || toIsoDate(importedFields?.planning_audit_date)
      || toIsoDate(importedFields?.planned_start_date);
    const planningAuditWeek = planningAuditDate ? isoWeek(planningAuditDate) : null;
    const forecastDate =
      toIsoDate(next.operationalManualFieldsJson?.forecast_date)
      || toIsoDate(importedFields?.forecast_date)
      || planningAuditDate;
    const forecastWeek = forecastDate ? isoWeek(forecastDate) : null;
    const actualAuditDate = toIsoDate(next.operationalManualFieldsJson?.actual_audit_date) || toIsoDate(importedFields?.actual_audit_date);
    const actualAuditWeek = actualAuditDate ? isoWeek(actualAuditDate) : null;

    const eligibility = getEligibility(next);
    const hasAcceptance = (next.acceptanceStatus || '').toLowerCase() === 'signed';
    const poUnit = numberOrNull(next.poUnitPrice) || 0;
    const ticket = numberOrNull(next.ticketNumber) || 0;
    const poUnitPriceCompleted = hasAcceptance && Number.isFinite(poUnit) && poUnit > 0 ? poUnit : null;
    const manualAmount = numberOrNull(next.contractorPayableAmount);
    const computedAmount = eligibility.eligible ? poUnit * ticket : null;
    const finalContractorAmount = manualAmount !== null ? manualAmount : computedAmount;

    const financeReferenceId = `${input.projectId}:${input.workItemId}:contractor_payable_amount`;
    const rowStatus = deriveWorkItemStatus(next, eligibility);

    const shared = {
      poUnitPrice: next.poUnitPrice,
      ticketNumber: next.ticketNumber,
      qaStatus: next.qaStatus,
      acceptanceStatus: next.acceptanceStatus,
      operationalManualFieldsJson: next.operationalManualFieldsJson,
      acceptanceManualFieldsJson: next.acceptanceManualFieldsJson,
      importedFieldsJson: importedFields,
      planningAuditDate: planningAuditDate ? new Date(`${planningAuditDate}T00:00:00.000Z`) : null,
      planningAuditWeek,
      forecastDate: forecastDate ? new Date(`${forecastDate}T00:00:00.000Z`) : null,
      forecastWeek,
      actualAuditDate: actualAuditDate ? new Date(`${actualAuditDate}T00:00:00.000Z`) : null,
      actualAuditWeek,
      startVarianceDays: schedule.startVarianceDays,
      scheduleStatus: schedule.scheduleStatus,
      isDelayed: Boolean(schedule.isDelayed),
      isFinanciallyEligible: eligibility.eligible,
      financialEligibilityReason: eligibility.reason,
      poUnitPriceCompleted,
      contractorPayableAmount: finalContractorAmount,
      financeSyncStatus: eligibility.eligible ? 'synced' : 'blocked',
      financeSyncAt: new Date(),
      financeReferenceId,
      financeErrorMessage: eligibility.eligible ? null : eligibility.reason,
      updatedByUserId: input.actorUserId,
      updatedByName: input.actorDisplayName,
    };

    const saved = await tx.projectItemState.upsert({
      where: {
        projectId_workItemId: {
          projectId: input.projectId,
          workItemId: input.workItemId,
        },
      },
      update: shared,
      create: {
        projectId: input.projectId,
        workItemId: input.workItemId,
        ...shared,
      },
    });

    // Keep WorkItem table in sync with authoritative ProjectItemState so list pages are always DB-consistent.
    await tx.workItem.update({
      where: { id: input.workItemId },
      data: {
        status: rowStatus,
        qaStatus: next.qaStatus,
        acceptanceStatus: next.acceptanceStatus,
        ticketNumber: next.ticketNumber,
        poUnitPrice: next.poUnitPrice,
        poUnitPriceCompleted,
        contractorPayableAmount: finalContractorAmount,
        financeSyncStatus: eligibility.eligible ? 'synced' : 'blocked',
        financeSyncAt: new Date(),
        financeReferenceId,
        financeErrorMessage: eligibility.eligible ? null : eligibility.reason,
        isFinanciallyEligible: eligibility.eligible,
        financialEligibilityReason: eligibility.reason,
        operationalManualFieldsJson: next.operationalManualFieldsJson,
        acceptanceManualFieldsJson: next.acceptanceManualFieldsJson,
        importedFieldsJson: importedFields,
      },
    });

    console.info('[projectItemDetails] Database state persisted', {
      projectId: input.projectId,
      workItemId: input.workItemId,
      state: {
        planningAuditDate: saved.planningAuditDate,
        forecastDate: saved.forecastDate,
        actualAuditDate: saved.actualAuditDate,
        scheduleStatus: saved.scheduleStatus,
        startVarianceDays: saved.startVarianceDays,
        isDelayed: saved.isDelayed,
      },
    });

    await syncProjectItemStateToFinance(tx, {
      projectId: input.projectId,
      workItemId: input.workItemId,
      state: saved,
      actorUserId: input.actorUserId,
      actorDisplayName: input.actorDisplayName,
    });

    const activities = [];
    const candidateFieldChanges = [
      ['ticketNumber', 'ticket_number'],
      ['contractorPayableAmount', 'contractor_payable_amount'],
      ['qaStatus', 'qa_status'],
      ['acceptanceStatus', 'acceptance_status'],
    ];

    for (const [stateKey, fieldName] of candidateFieldChanges) {
      if (input[stateKey] !== undefined && JSON.stringify(current[stateKey]) !== JSON.stringify(saved[stateKey])) {
        activities.push({
          actionType: 'manual_update',
          fieldName,
          oldValueJson: current[stateKey] ?? null,
          newValueJson: saved[stateKey] ?? null,
          message: `${input.actorDisplayName || 'User'} updated ${fieldName} from ${current[stateKey] ?? '-'} to ${saved[stateKey] ?? '-'}`,
          eventSource: 'user',
        });
      }
    }

    if (input.operationalManualFields !== undefined) {
      const diff = diffManualFields(current.operationalManualFieldsJson || {}, saved.operationalManualFieldsJson || {}, 'operational');
      for (const event of diff) {
        activities.push({
          ...event,
          message: `${input.actorDisplayName || 'User'} ${event.verb} ${event.fieldName}`,
          eventSource: 'user',
        });
      }
    }

    if (input.acceptanceManualFields !== undefined) {
      const diff = diffManualFields(current.acceptanceManualFieldsJson || {}, saved.acceptanceManualFieldsJson || {}, 'acceptance');
      for (const event of diff) {
        activities.push({
          ...event,
          message: `${input.actorDisplayName || 'User'} ${event.verb} ${event.fieldName}`,
          eventSource: 'user',
        });
      }
    }

    const prevSchedule = deriveScheduleVariance(importedFields, current.operationalManualFieldsJson || {});
    if (JSON.stringify(prevSchedule) !== JSON.stringify(schedule)) {
      activities.push({
        actionType: 'schedule_variance_recalculated',
        fieldName: 'schedule_variance',
        oldValueJson: prevSchedule,
        newValueJson: schedule,
        message: `System recalculated schedule variance: ${schedule.scheduleStatus || 'pending'} (${schedule.startVarianceDays ?? '-'} days)`,
        eventSource: 'system',
      });
    }

    if (JSON.stringify((current.operationalManualFieldsJson || {}).actual_audit_week ?? null) !== JSON.stringify((saved.operationalManualFieldsJson || {}).actual_audit_week ?? null)) {
      activities.push({
        actionType: 'system_calculation',
        fieldName: 'actual_audit_week',
        oldValueJson: (current.operationalManualFieldsJson || {}).actual_audit_week ?? null,
        newValueJson: (saved.operationalManualFieldsJson || {}).actual_audit_week ?? null,
        message: `System calculated Actual Audit Week = ${(saved.operationalManualFieldsJson || {}).actual_audit_week ?? '-'}`,
        eventSource: 'system',
      });
    }

    if (Number(current.poUnitPriceCompleted || 0) !== Number(saved.poUnitPriceCompleted || 0)) {
      activities.push({
        actionType: 'system_calculation',
        fieldName: 'po_unit_price_completed',
        oldValueJson: current.poUnitPriceCompleted ?? null,
        newValueJson: saved.poUnitPriceCompleted,
        message: `System calculated PO Unit Price Completed = ${saved.poUnitPriceCompleted}`,
        eventSource: 'system',
      });
    }

    if (Number(current.contractorPayableAmount || 0) !== Number(saved.contractorPayableAmount || 0)) {
      activities.push({
        actionType: 'system_calculation',
        fieldName: 'contractor_payable_amount',
        oldValueJson: current.contractorPayableAmount ?? null,
        newValueJson: saved.contractorPayableAmount,
        message: `System calculated Contractor Payable Amount = ${saved.contractorPayableAmount}`,
        eventSource: 'system',
      });
    }

    if (saved.financeSyncStatus === 'synced' && current.financeSyncStatus !== 'synced') {
      activities.push({
        actionType: 'finance_sync',
        fieldName: 'contractor_payable_amount',
        oldValueJson: current.financeSyncStatus ?? null,
        newValueJson: 'synced',
        message: 'System synced Contractor Payable Amount to Finance',
        eventSource: 'finance_sync',
      });
    }

    if (saved.financeSyncStatus === 'blocked' && current.financeSyncStatus === 'synced') {
      activities.push({
        actionType: 'finance_sync_blocked',
        fieldName: 'financial_eligibility',
        oldValueJson: current.financeSyncStatus,
        newValueJson: 'blocked',
        message: `System blocked finance sync: ${saved.financialEligibilityReason || 'not eligible'}`,
        eventSource: 'finance_sync',
      });
    }

    if (activities.length > 0) {
      await tx.projectItemActivity.createMany({
        data: activities.map((entry) => ({
          entityType: 'project_item',
          entityId: input.workItemId,
          projectId: input.projectId,
          workItemId: input.workItemId,
          actorUserId: input.actorUserId,
          actorDisplayName: entry.eventSource === 'user' ? input.actorDisplayName : 'System',
          actionType: entry.actionType,
          fieldName: entry.fieldName,
          oldValueJson: entry.oldValueJson,
          newValueJson: entry.newValueJson,
          message: entry.message,
          eventSource: entry.eventSource,
        })),
      });

      const userChanges = activities.filter((entry) => entry.eventSource === 'user');
      const userChangeSummary = userChanges.slice(0, 3).map((entry) => {
        const label = humanizeFieldName(entry.fieldName);
        if (entry.fieldName === 'qa_status' || entry.fieldName === 'acceptance_status') {
          return `${label}: ${String(entry.oldValueJson ?? 'pending')} → ${String(entry.newValueJson ?? 'pending')}`;
        }
        if (entry.fieldName === 'ticket_number' || entry.fieldName === 'contractor_payable_amount') {
          return `${label}: ${String(entry.newValueJson ?? '-')}`;
        }
        return `${label} updated`;
      });
      const detailsText = userChangeSummary.length > 0
        ? `${input.actorDisplayName || 'User'} updated ${workItem.title || input.workItemId}: ${userChangeSummary.join('; ')}`
        : `${input.actorDisplayName || 'User'} updated ${workItem.title || input.workItemId}`;

      await notifyTeam(tx, {
        projectId: input.projectId,
        actionType: 'work_item_updated',
        title: `Work item updated • ${project.name || project.id}`,
        details: detailsText,
        message: detailsText,
        link: `/projects/${encodeURIComponent(input.projectId)}/work-items?workItemId=${encodeURIComponent(input.workItemId)}`,
        meta: {
          workItemId: input.workItemId,
          workItemTitle: workItem.title || null,
          activityCount: activities.length,
        },
        actorUserId: input.actorUserId,
        actorDisplayName: input.actorDisplayName,
      });
    }

    return saved;
  });

  // ── SSE: push real-time notification to all connected clients ──
  try {
    sseBroadcast('work_item_updated', {
      projectId: input.projectId,
      workItemId: input.workItemId,
      updatedBy: input.actorDisplayName || 'User',
      ts: Date.now(),
    });
  } catch { /* non-critical — SSE failure must never block saves */ }

  console.info('[projectItemDetails] Save completed', {
    projectId: input.projectId,
    workItemId: input.workItemId,
    result: {
      planningAuditDate: result.planningAuditDate,
      forecastDate: result.forecastDate,
      actualAuditDate: result.actualAuditDate,
      scheduleStatus: result.scheduleStatus,
      startVarianceDays: result.startVarianceDays,
      isDelayed: result.isDelayed,
    },
  });
  return result;
}
export async function listProjectItemActivities(prisma, projectId, workItemId) {
  await assertProjectWorkItemIntegrity(prisma, projectId, workItemId);
  return prisma.projectItemActivity.findMany({
    where: { projectId, workItemId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

function ensureAllowedFile(meta) {
  const allowedMime = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/zip',
  ]);
  const sizeBytes = Number(meta.sizeBytes || 0);
  if (sizeBytes <= 0 || sizeBytes > 20 * 1024 * 1024) {
    throw new Error('Invalid file size. Max allowed is 20MB.');
  }
  if (!allowedMime.has(meta.mimeType)) {
    throw new Error(`File type not allowed: ${meta.mimeType}`);
  }
}

export async function uploadProjectItemFile(prisma, payload) {
  ensureAllowedFile(payload);
  await assertProjectWorkItemIntegrity(prisma, payload.projectId, payload.workItemId);

  fs.mkdirSync(FILE_ROOT, { recursive: true });
  const ext = (payload.originalFileName?.split('.').pop() || '').toLowerCase();
  const safeBase = (payload.originalFileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}`;
  const relativePath = path.join(payload.projectId, payload.workItemId, storedFileName);
  const absolutePath = path.join(FILE_ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(payload.contentBase64, 'base64');
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  fs.writeFileSync(absolutePath, buffer);

  const created = await prisma.projectItemFile.create({
    data: {
      projectId: payload.projectId,
      workItemId: payload.workItemId,
      originalFileName: payload.originalFileName,
      storedFileName,
      mimeType: payload.mimeType,
      extension: ext || null,
      sizeBytes: Number(payload.sizeBytes),
      storageProvider: 'local_fs',
      storagePath: relativePath.replace(/\\/g, '/'),
      uploadedByUserId: payload.actorUserId,
      uploadedByName: payload.actorDisplayName,
      category: payload.category || 'other',
      visibility: 'private',
      checksum,
    },
  });

  await createActivity(prisma, {
    entityId: payload.workItemId,
    projectId: payload.projectId,
    workItemId: payload.workItemId,
    actorUserId: payload.actorUserId,
    actorDisplayName: payload.actorDisplayName,
    actionType: 'file_upload',
    fieldName: 'files',
    oldValueJson: null,
    newValueJson: { fileId: created.id, fileName: created.originalFileName },
    message: `${payload.actorDisplayName || 'User'} uploaded file ${created.originalFileName}`,
    eventSource: 'file_upload',
  });

  return created;
}

export async function listProjectItemFiles(prisma, projectId, workItemId) {
  await assertProjectWorkItemIntegrity(prisma, projectId, workItemId);
  return prisma.projectItemFile.findMany({
    where: { projectId, workItemId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteProjectItemFile(prisma, fileId, actor) {
  const file = await prisma.projectItemFile.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) throw new Error('File not found.');

  await prisma.projectItemFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });

  await createActivity(prisma, {
    entityId: file.workItemId,
    projectId: file.projectId,
    workItemId: file.workItemId,
    actorUserId: actor?.id,
    actorDisplayName: actor?.name,
    actionType: 'file_delete',
    fieldName: 'files',
    oldValueJson: { fileId: file.id, fileName: file.originalFileName },
    newValueJson: null,
    message: `${actor?.name || 'User'} deleted file ${file.originalFileName}`,
    eventSource: 'file_upload',
  });

  return { success: true };
}

export function resolveAbsoluteStoredPath(storagePath) {
  return path.join(FILE_ROOT, storagePath);
}



