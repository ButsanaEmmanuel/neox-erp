// HRM-1.5 — Typed client for /api/v1/hrm/leave/*.

import { apiRequest } from '../lib/apiClient';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeavePolicy {
  id: string;
  name: string;
  leaveType: string;
  daysPerYear: string | number;
  carryOverMax: string | number;
  requiresApproval: boolean;
  noticeDays: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  policyId: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  carryOver: number;
  available: number;
  policy: { id: string; name: string; leaveType: string };
}

export interface LeaveRequest {
  id: string;
  userId: string;
  policyId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  statusCode: LeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  user?: { id: string; name: string | null; email: string | null };
  policy?: { id: string; name: string; leaveType: string };
  reviewer?: { id: string; name: string | null; email: string | null } | null;
}

function actorQuery(actorUserId?: string | null) {
  return actorUserId ? `?actorUserId=${encodeURIComponent(actorUserId)}` : '';
}

export const leaveApi = {
  listPolicies(includeInactive = false): Promise<{ policies: LeavePolicy[] }> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return apiRequest(`/api/v1/hrm/leave/policies${qs}`);
  },
  createPolicy(payload: Partial<LeavePolicy>, actorUserId?: string | null): Promise<{ policy: LeavePolicy }> {
    return apiRequest(`/api/v1/hrm/leave/policies${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  updatePolicy(id: string, payload: Partial<LeavePolicy>, actorUserId?: string | null): Promise<{ policy: LeavePolicy }> {
    return apiRequest(`/api/v1/hrm/leave/policies/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  deletePolicy(id: string, actorUserId?: string | null): Promise<{ policy: LeavePolicy }> {
    return apiRequest(`/api/v1/hrm/leave/policies/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },

  listBalances(opts: { userId?: string; forUserId?: string; year?: number } = {}): Promise<{ balances: LeaveBalance[] }> {
    const qs = new URLSearchParams();
    if (opts.userId) qs.set('userId', opts.userId);
    if (opts.forUserId) qs.set('forUserId', opts.forUserId);
    if (opts.year) qs.set('year', String(opts.year));
    const qsString = qs.toString();
    return apiRequest(`/api/v1/hrm/leave/balances${qsString ? `?${qsString}` : ''}`);
  },
  initializeBalances(payload: { year: number; userId?: string; policyId?: string }, actorUserId?: string | null): Promise<{ created: number }> {
    return apiRequest(`/api/v1/hrm/leave/balances/initialize${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },

  listRequests(opts: {
    userId?: string;
    forUserId?: string;
    status?: LeaveStatus;
    policyId?: string;
    from?: string;
    to?: string;
  } = {}): Promise<{ requests: LeaveRequest[] }> {
    const qs = new URLSearchParams();
    if (opts.userId) qs.set('userId', opts.userId);
    if (opts.forUserId) qs.set('forUserId', opts.forUserId);
    if (opts.status) qs.set('status', opts.status);
    if (opts.policyId) qs.set('policyId', opts.policyId);
    if (opts.from) qs.set('from', opts.from);
    if (opts.to) qs.set('to', opts.to);
    const qsString = qs.toString();
    return apiRequest(`/api/v1/hrm/leave/requests${qsString ? `?${qsString}` : ''}`);
  },
  createRequest(payload: {
    userId: string;
    policyId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }, actorUserId?: string | null): Promise<{ request: LeaveRequest }> {
    return apiRequest(`/api/v1/hrm/leave/requests${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId: actorUserId ?? payload.userId },
    });
  },
  approveRequest(id: string, reviewNote: string | undefined, actorUserId?: string | null): Promise<{ request: LeaveRequest }> {
    return apiRequest(`/api/v1/hrm/leave/requests/${encodeURIComponent(id)}/approve${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { actorUserId, reviewNote },
    });
  },
  rejectRequest(id: string, reviewNote: string | undefined, actorUserId?: string | null): Promise<{ request: LeaveRequest }> {
    return apiRequest(`/api/v1/hrm/leave/requests/${encodeURIComponent(id)}/reject${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { actorUserId, reviewNote },
    });
  },
  cancelRequest(id: string, actorUserId?: string | null): Promise<{ request: LeaveRequest }> {
    return apiRequest(`/api/v1/hrm/leave/requests/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },
};
