// Reconciliation API client — mirrors the 7 reconciliation routes in
// auth-server.mjs. Like budgetsApi, every call appends the actor
// (?userId=&userName=) so parseActorFromUrl resolves it for assertPermission;
// writes also embed the actor in the body for runBy/resolvedBy attribution.

import { apiRequest } from '../../lib/apiClient';

export interface ReconciliationSummary {
  lineCount?: number;
  discrepancyCount?: number;
  unmatchedReceipts?: number;
  unmatchedPayments?: number;
  matchedLines?: number;
}

export interface Reconciliation {
  id: string;
  reconciliationCode: string;
  status: string;
  createdAt: string;
  summaryJson?: ReconciliationSummary;
}

export interface ReconciliationLine {
  id: string;
  movementType: string;
  movementId: string;
  referenceCode?: string | null;
  expectedAmount?: number | null;
  actualAmount?: number | null;
  proofPresent: boolean;
  matchStatus: string;
  notes?: string | null;
  createdAt: string;
}

export interface DiscrepancyCase {
  id: string;
  caseType: string;
  severity: string;
  status: string;
  title: string;
  description?: string | null;
  expectedAmount?: number | null;
  actualAmount?: number | null;
  createdAt: string;
}

function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return String(parsed?.id || parsed?.user?.id || '').trim() || null;
  } catch {
    return null;
  }
}

function getSessionUserName(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = parsed?.name || parsed?.user?.name || parsed?.email || parsed?.user?.email;
    return name ? String(name).trim() : null;
  } catch {
    return null;
  }
}

function withActor(path: string): string {
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  if (!uid && !uname) return path;
  const sep = path.includes('?') ? '&' : '?';
  const parts: string[] = [];
  if (uid) parts.push(`userId=${encodeURIComponent(uid)}`);
  if (uname) parts.push(`userName=${encodeURIComponent(uname)}`);
  return `${path}${sep}${parts.join('&')}`;
}

// Actor fields for write bodies → parseActor() resolves runBy / resolvedBy.
function actorBody<T extends Record<string, unknown>>(extra: T) {
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  return {
    ...extra,
    ...(uid ? { userId: uid } : {}),
    ...(uname ? { actorDisplayName: uname } : {}),
  };
}

const BASE = '/api/v1/finance';

export async function listReconciliations(take = 20): Promise<Reconciliation[]> {
  const data = await apiRequest<{ reconciliations: Reconciliation[] }>(
    withActor(`${BASE}/reconciliations?take=${take}`),
  );
  return data.reconciliations || [];
}

export async function listUnmatchedReceipts(id: string): Promise<ReconciliationLine[]> {
  const data = await apiRequest<{ lines: ReconciliationLine[] }>(
    withActor(`${BASE}/reconciliations/${encodeURIComponent(id)}/unmatched-receipts`),
  );
  return data.lines || [];
}

export async function listUnmatchedPayments(id: string): Promise<ReconciliationLine[]> {
  const data = await apiRequest<{ lines: ReconciliationLine[] }>(
    withActor(`${BASE}/reconciliations/${encodeURIComponent(id)}/unmatched-payments`),
  );
  return data.lines || [];
}

export async function listDiscrepancies(id: string): Promise<DiscrepancyCase[]> {
  const data = await apiRequest<{ cases: DiscrepancyCase[] }>(
    withActor(`${BASE}/reconciliations/${encodeURIComponent(id)}/discrepancies`),
  );
  return data.cases || [];
}

export async function runReconciliation(): Promise<Reconciliation> {
  const data = await apiRequest<{ reconciliation: Reconciliation }>(
    withActor(`${BASE}/reconciliations/run`),
    { method: 'POST', body: actorBody({}) },
  );
  return data.reconciliation;
}

export async function resolveDiscrepancy(id: string, resolutionNotes: string): Promise<void> {
  await apiRequest(withActor(`${BASE}/discrepancies/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    body: actorBody({ status: 'resolved', resolutionNotes }),
  });
}
