// Budgets API client — Sprint Finance-4 (F4.4).
// Mirrors the 8 routes in auth-server.mjs added by F4.3.
// All writes append actor (?userId=&userName=) so parseActorFromUrl on the
// backend resolves the actor for assertPermission + createdBy.

import { apiRequest } from '../../lib/apiClient';

export type BudgetStatus = 'draft' | 'active' | 'closed';
export type FinanceDirection = 'inbound' | 'outbound' | 'inflow' | 'outflow' | string;

export interface BudgetCategoryRef {
  id: string;
  code: string;
  name: string;
  direction: FinanceDirection;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedAmount: string | number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  category?: BudgetCategoryRef;
}

export interface Budget {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  departmentId: string | null;
  projectId: string | null;
  currencyCode: string;
  status: BudgetStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
  department?: { id: string; code: string; name: string } | null;
  project?: { id: string; name: string; ownerDepartmentId?: string | null } | null;
  lines?: BudgetLine[];
  actuals?: BudgetActuals;
}

export interface BudgetActualLine {
  lineId: string;
  categoryId: string;
  categoryCode: string | null;
  categoryName: string | null;
  direction: FinanceDirection | null;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  variancePct: number | null;
}

export interface BudgetActualsTotals {
  planned: number;
  actual: number;
  variance: number;
  variancePct: number | null;
}

export interface BudgetActuals {
  lines: BudgetActualLine[];
  totals: BudgetActualsTotals;
}

export interface BudgetFilters {
  status?: BudgetStatus;
  departmentId?: string;
  projectId?: string;
  currencyCode?: string;
  periodFrom?: string;
  periodTo?: string;
  take?: number;
}

export interface CreateBudgetInput {
  name: string;
  periodStart: string;
  periodEnd: string;
  departmentId?: string | null;
  projectId?: string | null;
  currencyCode?: string;
  status?: BudgetStatus;
}

export interface UpdateBudgetInput {
  name?: string;
  periodStart?: string;
  periodEnd?: string;
  departmentId?: string | null;
  projectId?: string | null;
  currencyCode?: string;
  status?: BudgetStatus;
}

export interface UpsertBudgetLineInput {
  categoryId: string;
  plannedAmount: number;
  notes?: string | null;
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

const BASE = '/api/v1/finance/budgets';

export async function listBudgets(filters: BudgetFilters = {}): Promise<Budget[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.currencyCode) params.set('currencyCode', filters.currencyCode);
  if (filters.periodFrom) params.set('periodFrom', filters.periodFrom);
  if (filters.periodTo) params.set('periodTo', filters.periodTo);
  if (filters.take) params.set('take', String(filters.take));
  const qs = params.toString();
  const path = withActor(`${BASE}${qs ? `?${qs}` : ''}`);
  const data = await apiRequest<{ budgets: Budget[] }>(path);
  return data.budgets || [];
}

export async function getBudgetDetail(id: string): Promise<Budget> {
  const data = await apiRequest<{ budget: Budget }>(withActor(`${BASE}/${encodeURIComponent(id)}`));
  return data.budget;
}

export async function createBudget(payload: CreateBudgetInput): Promise<Budget> {
  const data = await apiRequest<{ budget: Budget }>(withActor(BASE), {
    method: 'POST',
    body: payload,
  });
  return data.budget;
}

export async function updateBudget(id: string, payload: UpdateBudgetInput): Promise<Budget> {
  const data = await apiRequest<{ budget: Budget }>(withActor(`${BASE}/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    body: payload,
  });
  return data.budget;
}

export async function deleteBudget(id: string): Promise<{ id: string; isDeleted: boolean; deletedAt: string | null }> {
  return apiRequest(withActor(`${BASE}/${encodeURIComponent(id)}`), { method: 'DELETE' });
}

export async function upsertBudgetLine(budgetId: string, payload: UpsertBudgetLineInput): Promise<BudgetLine> {
  const data = await apiRequest<{ line: BudgetLine }>(
    withActor(`${BASE}/${encodeURIComponent(budgetId)}/lines`),
    { method: 'POST', body: payload },
  );
  return data.line;
}

export async function deleteBudgetLine(budgetId: string, lineId: string): Promise<{ id: string; deleted: boolean }> {
  return apiRequest(
    withActor(`${BASE}/${encodeURIComponent(budgetId)}/lines/${encodeURIComponent(lineId)}`),
    { method: 'DELETE' },
  );
}

export async function getBudgetActuals(id: string): Promise<BudgetActuals> {
  const data = await apiRequest<{ actuals: BudgetActuals }>(
    withActor(`${BASE}/${encodeURIComponent(id)}/actuals`),
  );
  return data.actuals;
}
