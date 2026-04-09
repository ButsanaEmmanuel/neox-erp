import { apiRequest } from '../lib/apiClient';
import { Department, EmploymentProfile } from '../types/hrm';

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

export interface HrmBootstrapResponse {
  departments: Department[];
  employees: EmploymentProfile[];
  pagination?: {
    take: number;
    skip: number;
    total: number;
    hasMore: boolean;
  };
  meta?: {
    listEmployeesDbMs?: number | null;
    totalMs?: number | null;
  };
}

export async function fetchHrmBootstrapApi(params?: { q?: string; take?: number; skip?: number }): Promise<HrmBootstrapResponse> {
  const search = new URLSearchParams();
  const viewerUserId = getSessionUserId();
  if (viewerUserId) search.set('userId', viewerUserId);
  if (params?.q) search.set('q', params.q);
  if (typeof params?.take === 'number') search.set('take', String(params.take));
  if (typeof params?.skip === 'number') search.set('skip', String(params.skip));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<HrmBootstrapResponse>(`/api/v1/hrm/bootstrap${suffix}`);
}

export async function createHrmDepartmentApi(payload: Partial<Department>) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ department: Department }>('/api/v1/hrm/departments', {
    method: 'POST',
    body: { ...payload, actorUserId: viewerUserId || undefined },
  });
}

export async function updateHrmDepartmentApi(id: string, payload: Partial<Department>) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ department: Department }>(`/api/v1/hrm/departments/${id}`, {
    method: 'PATCH',
    body: { ...payload, actorUserId: viewerUserId || undefined },
  });
}

export async function deleteHrmDepartmentApi(id: string) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ id: string }>(`/api/v1/hrm/departments/${id}`, {
    method: 'DELETE',
    body: { actorUserId: viewerUserId || undefined },
  });
}

export async function createHrmEmployeeApi(payload: Partial<EmploymentProfile>) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ employee: EmploymentProfile }>('/api/v1/hrm/employees', {
    method: 'POST',
    body: { ...payload, actorUserId: viewerUserId || undefined },
  });
}

export async function updateHrmEmployeeApi(id: string, payload: Partial<EmploymentProfile>) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ employee: EmploymentProfile }>(`/api/v1/hrm/employees/${id}`, {
    method: 'PATCH',
    body: { ...payload, actorUserId: viewerUserId || undefined },
  });
}

export async function fetchHrmEmployeeDetailApi(id: string) {
  const search = new URLSearchParams();
  const viewerUserId = getSessionUserId();
  if (viewerUserId) search.set('userId', viewerUserId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest<{ employee: EmploymentProfile }>(`/api/v1/hrm/employees/${id}/detail${suffix}`);
}

export async function deleteHrmEmployeeApi(id: string) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ id: string }>(`/api/v1/hrm/employees/${id}`, {
    method: 'DELETE',
    body: { actorUserId: viewerUserId || undefined },
  });
}

export async function bulkUpsertHrmEmployeesApi(employees: Partial<EmploymentProfile>[]) {
  const viewerUserId = getSessionUserId();
  return apiRequest<{ employees: EmploymentProfile[] }>('/api/v1/hrm/employees/bulk', {
    method: 'POST',
    body: { employees, actorUserId: viewerUserId || undefined },
  });
}

export interface HrmEmployeeActivity {
  id: string;
  timestamp: string;
  actionType: string;
  actorUserId?: string | null;
  actorDisplayName: string;
  oldValue?: unknown;
  newValue?: unknown;
  message: string;
}

export async function fetchHrmEmployeeActivityApi(employeeId: string) {
  return apiRequest<{ activities: HrmEmployeeActivity[] }>(`/api/v1/hrm/employees/${employeeId}/activity`);
}

export async function regenerateHrmEmployeeCredentialsApi(employeeId: string) {
  const viewerUserId = getSessionUserId();
  try {
    return await apiRequest<{ credential: {
      id: string;
      username: string;
      temporaryPassword: string;
      status: string;
      generatedAt: string;
      sentAt?: string;
    } }>(`/api/v1/hrm/employees/${employeeId}/credentials/regenerate`, {
      method: 'POST',
      body: viewerUserId ? { actorUserId: viewerUserId } : {},
    });
  } catch (error) {
    const message = String((error as Error)?.message || '').toLowerCase();
    const canFallback = message.includes('route not found') || message.includes('404');
    if (!canFallback) throw error;

    await updateHrmEmployeeApi(employeeId, { regenerateCredentials: true } as unknown as Partial<EmploymentProfile>);
    const detail = await fetchHrmEmployeeDetailApi(employeeId);
    if (!detail.employee?.latestCredential) {
      throw new Error('Credential generation fallback did not return credentials. Restart API server and retry.');
    }
    return { credential: detail.employee.latestCredential };
  }
}

export async function markHrmEmployeeCredentialsSentApi(employeeId: string) {
  const viewerUserId = getSessionUserId();
  try {
    return await apiRequest<{ credential: {
      id: string;
      username: string;
      temporaryPassword: string;
      status: string;
      generatedAt: string;
      sentAt?: string;
    } }>(`/api/v1/hrm/employees/${employeeId}/credentials/sent`, {
      method: 'POST',
      body: viewerUserId ? { actorUserId: viewerUserId } : {},
    });
  } catch (error) {
    const message = String((error as Error)?.message || '').toLowerCase();
    const canFallback = message.includes('route not found') || message.includes('404');
    if (!canFallback) throw error;

    await updateHrmEmployeeApi(employeeId, { markCredentialsSent: true } as unknown as Partial<EmploymentProfile>);
    const detail = await fetchHrmEmployeeDetailApi(employeeId);
    if (!detail.employee?.latestCredential) {
      throw new Error('No credentials available to mark as sent.');
    }
    return { credential: detail.employee.latestCredential };
  }
}
