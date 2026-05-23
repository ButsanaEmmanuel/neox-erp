// HRM-2.1 — Typed client for /api/v1/hrm/recruitment/*.

import { apiRequest } from '../lib/apiClient';

export type CandidateStatus =
  | 'sourced' | 'screening' | 'interview' | 'offer'
  | 'hired' | 'onboarding' | 'rejected';

export interface JobPostingSummary {
  id: string;
  title: string;
  statusCode: 'draft' | 'open' | 'closed' | 'filled';
  closingDate: string | null;
  department: { id: string; code: string; name: string };
  createdBy: { id: string; name: string | null; email: string | null };
  _count?: { candidates: number };
}

export interface JobPostingDetail extends JobPostingSummary {
  description: string;
  requirements: string | null;
  candidates: Array<{ id: string; fullName: string; personalEmail: string; statusCode: CandidateStatus }>;
}

export interface CandidateRow {
  id: string;
  fullName: string;
  personalEmail: string;
  phone: string | null;
  position: string;
  statusCode: CandidateStatus;
  recruitmentDepartmentId: string;
  jobPostingId: string | null;
  interviewDate: string | null;
  offerDate: string | null;
  offerAmount: number | string | null;
  offerCurrency: string | null;
  rejectionReason: string | null;
  hiredUserId: string | null;
  hiredAt: string | null;
  createdAt: string;
  recruitmentDepartment: { id: string; code: string; name: string };
  jobPosting: { id: string; title: string; statusCode: string } | null;
  hiredUser: { id: string; name: string | null; email: string | null } | null;
}

function actorQuery(actorUserId?: string | null) {
  return actorUserId ? `?actorUserId=${encodeURIComponent(actorUserId)}` : '';
}

export const recruitmentApi = {
  listPostings(opts: { status?: string; departmentId?: string } = {}): Promise<{ postings: JobPostingSummary[] }> {
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', opts.status);
    if (opts.departmentId) qs.set('departmentId', opts.departmentId);
    const q = qs.toString();
    return apiRequest(`/api/v1/hrm/recruitment/postings${q ? `?${q}` : ''}`);
  },
  getPosting(id: string): Promise<{ posting: JobPostingDetail }> {
    return apiRequest(`/api/v1/hrm/recruitment/postings/${encodeURIComponent(id)}`);
  },
  createPosting(payload: Partial<JobPostingDetail> & { title: string; departmentId: string; description: string }, actorUserId?: string | null): Promise<{ posting: JobPostingDetail }> {
    return apiRequest(`/api/v1/hrm/recruitment/postings${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  updatePosting(id: string, payload: Partial<JobPostingDetail>, actorUserId?: string | null): Promise<{ posting: JobPostingDetail }> {
    return apiRequest(`/api/v1/hrm/recruitment/postings/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  deletePosting(id: string, actorUserId?: string | null): Promise<{ id: string; deleted: boolean }> {
    return apiRequest(`/api/v1/hrm/recruitment/postings/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },

  listCandidates(opts: { status?: CandidateStatus; jobPostingId?: string; departmentId?: string } = {}): Promise<{ candidates: CandidateRow[] }> {
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', opts.status);
    if (opts.jobPostingId) qs.set('jobPostingId', opts.jobPostingId);
    if (opts.departmentId) qs.set('departmentId', opts.departmentId);
    const q = qs.toString();
    return apiRequest(`/api/v1/hrm/recruitment/candidates${q ? `?${q}` : ''}`);
  },
  createCandidate(payload: {
    fullName: string;
    personalEmail: string;
    position: string;
    recruitmentDepartmentId: string;
    phone?: string;
    jobPostingId?: string;
  }, actorUserId?: string | null): Promise<{ candidate: CandidateRow }> {
    return apiRequest(`/api/v1/hrm/recruitment/candidates${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  updateStage(id: string, payload: {
    statusCode: CandidateStatus;
    interviewDate?: string;
    offerDate?: string;
    offerAmount?: number;
    offerCurrency?: string;
  }, actorUserId?: string | null): Promise<{ candidate: CandidateRow }> {
    return apiRequest(`/api/v1/hrm/recruitment/candidates/${encodeURIComponent(id)}/stage${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  hire(id: string, payload: { professionalEmail?: string; companyName?: string; appUrl?: string }, actorUserId?: string | null): Promise<{ candidate: CandidateRow; provisioning: { userId: string; username: string; temporaryPassword: string } }> {
    return apiRequest(`/api/v1/hrm/recruitment/candidates/${encodeURIComponent(id)}/hire${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  reject(id: string, reason: string | undefined, actorUserId?: string | null): Promise<{ candidate: CandidateRow }> {
    return apiRequest(`/api/v1/hrm/recruitment/candidates/${encodeURIComponent(id)}/reject${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { reason, actorUserId },
    });
  },
};
