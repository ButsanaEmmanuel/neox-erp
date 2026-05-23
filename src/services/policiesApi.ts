// HRM-2.4 — Typed client for /api/v1/hrm/policies/*.

import { apiRequest } from '../lib/apiClient';

export type PolicyStatus = 'draft' | 'published' | 'archived';
export type PolicyCategory = 'conduct' | 'safety' | 'leave' | 'it' | 'other';

export interface PolicyRow {
  id: string;
  title: string;
  category: PolicyCategory | string;
  content: string;
  version: string;
  statusCode: PolicyStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; email: string | null };
  _count?: { acknowledgements: number };
  isAcknowledgedByMe?: boolean;
  myAcknowledgementId?: string | null;
  myAcknowledgedAt?: string | null;
}

export interface AcknowledgementRow {
  id: string;
  policyId: string;
  userId: string;
  signedAt: string;
  note: string | null;
  user?: { id: string; name: string | null; email: string | null };
}

function actorQuery(actor?: string | null) {
  return actor ? `?actorUserId=${encodeURIComponent(actor)}` : '';
}

export const policiesApi = {
  list(opts: { status?: PolicyStatus; category?: string; forUserId?: string } = {}) {
    const qs = new URLSearchParams();
    if (opts.status)    qs.set('status',    opts.status);
    if (opts.category)  qs.set('category',  opts.category);
    if (opts.forUserId) qs.set('forUserId', opts.forUserId);
    const q = qs.toString();
    return apiRequest<{ policies: PolicyRow[] }>(`/api/v1/hrm/policies${q ? `?${q}` : ''}`);
  },
  get(id: string, actorUserId?: string | null) {
    return apiRequest<{ policy: PolicyRow }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}${actorQuery(actorUserId)}`);
  },
  create(payload: { title: string; category?: string; content: string; version?: string }, actorUserId: string) {
    return apiRequest<{ policy: PolicyRow }>(`/api/v1/hrm/policies${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  update(id: string, payload: Partial<Pick<PolicyRow, 'title' | 'content' | 'version' | 'category'>>, actorUserId: string) {
    return apiRequest<{ policy: PolicyRow }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  publish(id: string, actorUserId: string) {
    return apiRequest<{ policy: PolicyRow }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}/publish${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { actorUserId },
    });
  },
  archive(id: string, actorUserId: string) {
    return apiRequest<{ policy: PolicyRow }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}/archive${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { actorUserId },
    });
  },
  delete(id: string, actorUserId: string) {
    return apiRequest<{ id: string; deleted: boolean }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },
  acknowledge(id: string, actorUserId: string, note?: string) {
    return apiRequest<{ acknowledgement: AcknowledgementRow }>(`/api/v1/hrm/policies/${encodeURIComponent(id)}/acknowledge${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { actorUserId, note },
    });
  },
  listAcknowledgements(policyId: string) {
    return apiRequest<{ acknowledgements: AcknowledgementRow[] }>(`/api/v1/hrm/policies/${encodeURIComponent(policyId)}/acknowledgements`);
  },
};
