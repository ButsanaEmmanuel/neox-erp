// Payroll engine API client — F2.2 (Sprint Finance-2).
// Wraps the 15 /api/v1/finance/hrm/payroll-* endpoints exposed by
// auth-server.mjs L1733-1881. All inline apiRequest calls in
// FinancePayrollPage.tsx must funnel through here.
//
// Types live in src/types/payroll.ts.

import { apiRequest } from '../../lib/apiClient';
import type {
  PayrollBatch,
  PayrollRun,
  PayrollRunEmployee,
  PayrollSchedule,
  SalaryProfile,
  UpsertScheduleInput,
  ExecuteRunInput,
  PostRunInput,
  AdjustEmployeeInput,
  UpsertSalaryProfileInput,
  ApproveBatchInput,
  ReconcileBatchInput,
  DisburseLineInput,
} from '../../types/payroll';

const BASE = '/api/v1/finance/hrm';

// Finance routes run assertPermission against ?userId=. Append the session
// actor so these calls don't 403 (same pattern as budgetsApi/reconciliationApi).
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

function withActor(path: string): string {
  const uid = getSessionUserId();
  if (!uid) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}userId=${encodeURIComponent(uid)}`;
}

// ── Schedules ─────────────────────────────────────────────────────────

export async function listPayrollSchedules(): Promise<PayrollSchedule[]> {
  const data = await apiRequest<{ schedules: PayrollSchedule[] }>(withActor(`${BASE}/payroll-schedules`));
  return data.schedules || [];
}

export async function upsertPayrollSchedule(payload: UpsertScheduleInput): Promise<PayrollSchedule> {
  const data = await apiRequest<{ schedule: PayrollSchedule }>(withActor(`${BASE}/payroll-schedules`), {
    method: 'POST',
    body: payload,
  });
  return data.schedule;
}

// ── Salary profiles ───────────────────────────────────────────────────

export async function listSalaryProfiles(filters?: { take?: number; userId?: string }): Promise<SalaryProfile[]> {
  const params = new URLSearchParams();
  if (filters?.take) params.set('take', String(filters.take));
  if (filters?.userId) params.set('userId', filters.userId);
  const qs = params.toString();
  const data = await apiRequest<{ profiles: SalaryProfile[] }>(
    withActor(`${BASE}/salary-profiles${qs ? `?${qs}` : ''}`),
  );
  return data.profiles || [];
}

export async function upsertSalaryProfile(payload: UpsertSalaryProfileInput): Promise<SalaryProfile> {
  const data = await apiRequest<{ profile: SalaryProfile }>(withActor(`${BASE}/salary-profiles`), {
    method: 'POST',
    body: payload,
  });
  return data.profile;
}

// ── Runs ──────────────────────────────────────────────────────────────

export async function listPayrollRuns(filters?: { take?: number; status?: string }): Promise<PayrollRun[]> {
  const params = new URLSearchParams();
  if (filters?.take) params.set('take', String(filters.take));
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  const data = await apiRequest<{ runs: PayrollRun[] }>(
    withActor(`${BASE}/payroll-runs${qs ? `?${qs}` : ''}`),
  );
  return data.runs || [];
}

export async function getPayrollRunDetail(runId: string): Promise<PayrollRun | null> {
  const data = await apiRequest<{ run: PayrollRun }>(withActor(`${BASE}/payroll-runs/${runId}`));
  return data.run || null;
}

export async function executePayrollRun(payload: ExecuteRunInput): Promise<PayrollRun> {
  const data = await apiRequest<{ run: PayrollRun }>(withActor(`${BASE}/payroll-runs/execute`), {
    method: 'POST',
    body: payload,
  });
  return data.run;
}

export async function runDuePayrollSchedules(payload?: { actorUserId?: string; actorDisplayName?: string }): Promise<{ runs: PayrollRun[]; count: number }> {
  const data = await apiRequest<{ runs: PayrollRun[]; count: number }>(withActor(`${BASE}/payroll-runs/run-due`), {
    method: 'POST',
    body: payload || {},
  });
  return { runs: data.runs || [], count: data.count ?? (data.runs?.length || 0) };
}

export async function postPayrollRun(runId: string, payload: PostRunInput): Promise<{ run: PayrollRun; batch?: PayrollBatch }> {
  return apiRequest<{ run: PayrollRun; batch?: PayrollBatch }>(withActor(`${BASE}/payroll-runs/${runId}/post`), {
    method: 'POST',
    body: payload,
  });
}

export async function adjustPayrollRunEmployee(employeeLineId: string, payload: AdjustEmployeeInput): Promise<PayrollRunEmployee> {
  const data = await apiRequest<{ employeeLine: PayrollRunEmployee }>(
    withActor(`${BASE}/payroll-runs/employees/${employeeLineId}/adjust`),
    { method: 'PATCH', body: payload },
  );
  return data.employeeLine;
}

// ── Batches ───────────────────────────────────────────────────────────

export async function listPayrollBatches(filters?: { take?: number; status?: string }): Promise<PayrollBatch[]> {
  const params = new URLSearchParams();
  if (filters?.take) params.set('take', String(filters.take));
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  const data = await apiRequest<{ batches: PayrollBatch[] }>(
    withActor(`${BASE}/payroll-batches${qs ? `?${qs}` : ''}`),
  );
  return data.batches || [];
}

export async function getPayrollBatchDetail(batchId: string): Promise<PayrollBatch | null> {
  const data = await apiRequest<{ batch: PayrollBatch }>(withActor(`${BASE}/payroll-batches/${batchId}`));
  return data.batch || null;
}

export async function approvePayrollBatch(batchId: string, payload: ApproveBatchInput): Promise<PayrollBatch> {
  const data = await apiRequest<{ batch: PayrollBatch }>(withActor(`${BASE}/payroll-batches/${batchId}/approve`), {
    method: 'POST',
    body: payload,
  });
  return data.batch;
}

export async function reconcilePayrollBatch(batchId: string, payload: ReconcileBatchInput): Promise<PayrollBatch> {
  const data = await apiRequest<{ batch: PayrollBatch }>(withActor(`${BASE}/payroll-batches/${batchId}/reconcile`), {
    method: 'POST',
    body: payload,
  });
  return data.batch;
}

// ── Disbursement lines ────────────────────────────────────────────────

export async function disbursePayrollLine(lineId: string, payload: DisburseLineInput) {
  return apiRequest(withActor(`${BASE}/payroll-lines/${lineId}/disburse`), {
    method: 'POST',
    body: payload,
  });
}
