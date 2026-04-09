export type FinanceMirrorStatus = 'pending' | 'synced' | 'error' | 'blocked';

export interface FinanceMirrorRecord {
  reference_id: string;
  project_id: string;
  work_item_id: string;
  amount: number;
  currency: string;
  synced_at: string;
  status: FinanceMirrorStatus;
  error_message?: string;
}

const STORAGE_KEY = 'neox.finance.project_payables.v1';
const EVENT_NAME = 'neox:finance:project-payable-synced';

function readAll(): FinanceMirrorRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FinanceMirrorRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: FinanceMirrorRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function syncContractorPayableToFinance(input: {
  projectId: string;
  workItemId: string;
  amount: number;
  currency?: string;
}): FinanceMirrorRecord {
  const reference_id = `${input.projectId}:${input.workItemId}:contractor_payable_amount`;
  const now = new Date().toISOString();

  const current = readAll();
  const nextRecord: FinanceMirrorRecord = {
    reference_id,
    project_id: input.projectId,
    work_item_id: input.workItemId,
    amount: Number(input.amount || 0),
    currency: input.currency || 'USD',
    synced_at: now,
    status: 'synced',
  };

  const idx = current.findIndex((r) => r.reference_id === reference_id);
  if (idx >= 0) {
    current[idx] = nextRecord;
  } else {
    current.unshift(nextRecord);
  }

  writeAll(current);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextRecord }));
  return nextRecord;
}

export function suspendContractorPayableSync(input: {
  projectId: string;
  workItemId: string;
  reason: string;
  currency?: string;
}): FinanceMirrorRecord {
  const reference_id = `${input.projectId}:${input.workItemId}:contractor_payable_amount`;
  const now = new Date().toISOString();

  const current = readAll();
  const nextRecord: FinanceMirrorRecord = {
    reference_id,
    project_id: input.projectId,
    work_item_id: input.workItemId,
    amount: 0,
    currency: input.currency || 'USD',
    synced_at: now,
    status: 'blocked',
    error_message: input.reason,
  };

  const idx = current.findIndex((r) => r.reference_id === reference_id);
  if (idx >= 0) {
    current[idx] = nextRecord;
  } else {
    current.unshift(nextRecord);
  }

  writeAll(current);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextRecord }));
  return nextRecord;
}

export function getFinanceMirrorRecords(): FinanceMirrorRecord[] {
  return readAll();
}

export const FINANCE_MIRROR_EVENT = EVENT_NAME;
