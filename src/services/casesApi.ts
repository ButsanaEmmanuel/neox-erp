// HRM-2.4 — Typed client for /api/v1/hrm/cases/*.

import { apiRequest } from '../lib/apiClient';

export type CaseType   = 'grievance' | 'incident' | 'disciplinary' | 'inquiry';
export type CaseStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';
export type CasePriority = 'low' | 'medium' | 'high';

export interface CaseRow {
  id: string;
  caseType: CaseType | string;
  title: string;
  description: string;
  reportedByUserId: string;
  assignedToUserId: string | null;
  statusCode: CaseStatus;
  priority: CasePriority | string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: { id: string; name: string | null; email: string | null };
  assignee: { id: string; name: string | null; email: string | null } | null;
  _count?: { events: number };
}

export interface CaseEventRow {
  id: string;
  caseId: string;
  eventType: 'status_change' | 'note' | 'assignment' | string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  authorUserId: string;
  createdAt: string;
  author?: { id: string; name: string | null; email: string | null };
}

export interface CaseDetail extends CaseRow {
  events: CaseEventRow[];
}

function actorQuery(actor?: string | null) {
  return actor ? `?actorUserId=${encodeURIComponent(actor)}` : '';
}

export const casesApi = {
  list(opts: { status?: CaseStatus; caseType?: CaseType; priority?: CasePriority; actorUserId?: string } = {}) {
    const qs = new URLSearchParams();
    if (opts.status)      qs.set('status',      opts.status);
    if (opts.caseType)    qs.set('caseType',    opts.caseType);
    if (opts.priority)    qs.set('priority',    opts.priority);
    if (opts.actorUserId) qs.set('actorUserId', opts.actorUserId);
    const q = qs.toString();
    return apiRequest<{ cases: CaseRow[] }>(`/api/v1/hrm/cases${q ? `?${q}` : ''}`);
  },
  get(id: string, actorUserId?: string | null) {
    return apiRequest<{ case: CaseDetail }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}${actorQuery(actorUserId)}`);
  },
  create(payload: {
    title: string;
    description: string;
    caseType?: CaseType;
    priority?: CasePriority;
    assignedToUserId?: string;
  }, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  update(id: string, payload: Partial<Pick<CaseRow, 'title' | 'description' | 'priority'>> & { assignedToUserId?: string | null }, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  changeStatus(id: string, statusCode: CaseStatus, note: string | undefined, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}/status${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { statusCode, note, actorUserId },
    });
  },
  escalate(id: string, note: string | undefined, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}/escalate${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { note, actorUserId },
    });
  },
  close(id: string, note: string | undefined, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}/close${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { note, actorUserId },
    });
  },
  addNote(id: string, note: string, actorUserId: string) {
    return apiRequest<{ event: CaseEventRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}/notes${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { note, actorUserId },
    });
  },
  assign(id: string, assignedToUserId: string | null, note: string | undefined, actorUserId: string) {
    return apiRequest<{ case: CaseRow }>(`/api/v1/hrm/cases/${encodeURIComponent(id)}/assign${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { assignedToUserId, note, actorUserId },
    });
  },
};
