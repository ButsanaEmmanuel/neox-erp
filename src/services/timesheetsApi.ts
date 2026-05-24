// HRM-2.5 — Typed client for /api/v1/hrm/timesheets/*.

import { apiRequest } from '../lib/apiClient';

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimesheetEntry {
  id: string;
  userId: string;
  departmentId: string;
  projectId: string | null;
  workDate: string;
  weekStartDate: string | null;
  hours: number | string;
  description: string | null;
  statusCode: TimesheetStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  rejectedAt: string | null;
  reviewerComment: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string | null; email: string | null };
  approvedBy?: { id: string; name: string | null; email: string | null } | null;
}

export interface WeekRollup {
  userId: string;
  weekStartDate: string;
  statusCode: TimesheetStatus;
  totalHours: number;
  entryCount: number;
  entries: TimesheetEntry[];
}

export interface PendingWeek {
  userId: string;
  user: { id: string; name: string | null; email: string | null; departmentId?: string | null };
  weekStartDate: string;
  totalHours: number;
  entryCount: number;
  submittedAt: string | null;
}

function actorQuery(actor?: string | null) {
  return actor ? `?actorUserId=${encodeURIComponent(actor)}` : '';
}

export const timesheetsApi = {
  list(opts: { forUserId?: string; weekStart?: string; status?: TimesheetStatus; actorUserId?: string } = {}) {
    const qs = new URLSearchParams();
    if (opts.forUserId)   qs.set('forUserId',   opts.forUserId);
    if (opts.weekStart)   qs.set('weekStart',   opts.weekStart);
    if (opts.status)      qs.set('status',      opts.status);
    if (opts.actorUserId) qs.set('actorUserId', opts.actorUserId);
    const q = qs.toString();
    return apiRequest<{ entries: TimesheetEntry[] }>(`/api/v1/hrm/timesheets${q ? `?${q}` : ''}`);
  },

  getWeek(userId: string, weekStart: string, actorUserId?: string | null) {
    return apiRequest<{ week: WeekRollup }>(
      `/api/v1/hrm/timesheets/users/${encodeURIComponent(userId)}/week/${encodeURIComponent(weekStart)}${actorQuery(actorUserId)}`,
    );
  },

  upsert(payload: {
    id?: string;
    userId?: string;
    departmentId?: string;
    projectId?: string;
    workDate: string;
    hours: number;
    description?: string;
  }, actorUserId: string) {
    return apiRequest<{ entry: TimesheetEntry }>(`/api/v1/hrm/timesheets${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },

  remove(id: string, actorUserId: string) {
    return apiRequest<{ id: string; deleted: boolean }>(`/api/v1/hrm/timesheets/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },

  submitWeek(userId: string, weekStart: string, actorUserId: string) {
    return apiRequest<{ affected: number }>(
      `/api/v1/hrm/timesheets/users/${encodeURIComponent(userId)}/week/${encodeURIComponent(weekStart)}/submit${actorQuery(actorUserId)}`,
      { method: 'PUT', body: { actorUserId } },
    );
  },
  approveWeek(userId: string, weekStart: string, actorUserId: string) {
    return apiRequest<{ affected: number }>(
      `/api/v1/hrm/timesheets/users/${encodeURIComponent(userId)}/week/${encodeURIComponent(weekStart)}/approve${actorQuery(actorUserId)}`,
      { method: 'PUT', body: { actorUserId } },
    );
  },
  rejectWeek(userId: string, weekStart: string, comment: string | undefined, actorUserId: string) {
    return apiRequest<{ affected: number }>(
      `/api/v1/hrm/timesheets/users/${encodeURIComponent(userId)}/week/${encodeURIComponent(weekStart)}/reject${actorQuery(actorUserId)}`,
      { method: 'PUT', body: { comment, actorUserId } },
    );
  },

  submitEntry(id: string, actorUserId: string) {
    return apiRequest<{ entry: TimesheetEntry }>(`/api/v1/hrm/timesheets/${encodeURIComponent(id)}/submit${actorQuery(actorUserId)}`, {
      method: 'PUT', body: { actorUserId },
    });
  },
  approveEntry(id: string, actorUserId: string) {
    return apiRequest<{ entry: TimesheetEntry }>(`/api/v1/hrm/timesheets/${encodeURIComponent(id)}/approve${actorQuery(actorUserId)}`, {
      method: 'PUT', body: { actorUserId },
    });
  },
  rejectEntry(id: string, comment: string | undefined, actorUserId: string) {
    return apiRequest<{ entry: TimesheetEntry }>(`/api/v1/hrm/timesheets/${encodeURIComponent(id)}/reject${actorQuery(actorUserId)}`, {
      method: 'PUT', body: { comment, actorUserId },
    });
  },

  listPending(actorUserId: string, departmentId?: string) {
    const qs = new URLSearchParams({ actorUserId });
    if (departmentId) qs.set('departmentId', departmentId);
    return apiRequest<{ pending: PendingWeek[] }>(`/api/v1/hrm/timesheets/pending?${qs.toString()}`);
  },
};
