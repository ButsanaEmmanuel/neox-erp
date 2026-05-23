// HRM-2.3 — Typed client for /api/v1/hrm/training/*.

import { apiRequest } from '../lib/apiClient';

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'cancelled';

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  provider: string | null;
  category: string | null;
  durationHours: number | null;
  isInternal: boolean;
  isMandatory: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { enrollments: number };
}

export interface EnrollmentRow {
  id: string;
  userId: string;
  courseId: string;
  statusCode: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  dueDate: string | null;
  score: number | string | null;
  certificate: string | null;
  notes: string | null;
  isDeleted: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; departmentId?: string | null };
  course: { id: string; title: string; category: string | null; isMandatory: boolean };
}

export interface CertificationRow {
  id: string;
  userId: string;
  courseId: string;
  statusCode: EnrollmentStatus;
  completedAt: string | null;
  score: number | string | null;
  certificate: string | null;
  course: { id: string; title: string; category: string | null; isMandatory: boolean };
}

function actorQuery(actorUserId?: string | null) {
  return actorUserId ? `?actorUserId=${encodeURIComponent(actorUserId)}` : '';
}

export const trainingApi = {
  listCourses(opts: { includeInactive?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (opts.includeInactive) qs.set('includeInactive', 'true');
    const q = qs.toString();
    return apiRequest<{ courses: CourseSummary[] }>(`/api/v1/hrm/training/courses${q ? `?${q}` : ''}`);
  },
  getCourse(id: string) {
    return apiRequest<{ course: CourseSummary }>(`/api/v1/hrm/training/courses/${encodeURIComponent(id)}`);
  },
  createCourse(payload: {
    title: string;
    description?: string;
    provider?: string;
    category?: string;
    durationHours?: number | null;
    isInternal?: boolean;
    isMandatory?: boolean;
    isActive?: boolean;
  }, actorUserId?: string | null) {
    return apiRequest<{ course: CourseSummary }>(`/api/v1/hrm/training/courses${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  updateCourse(id: string, payload: Partial<CourseSummary>, actorUserId?: string | null) {
    return apiRequest<{ course: CourseSummary }>(`/api/v1/hrm/training/courses/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  deleteCourse(id: string, actorUserId?: string | null) {
    return apiRequest<{ id: string; deleted: boolean }>(`/api/v1/hrm/training/courses/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
      method: 'DELETE',
      body: { actorUserId },
    });
  },

  listEnrollments(opts: { forUserId?: string; courseId?: string; status?: EnrollmentStatus } = {}) {
    const qs = new URLSearchParams();
    if (opts.forUserId) qs.set('forUserId', opts.forUserId);
    if (opts.courseId)  qs.set('courseId',  opts.courseId);
    if (opts.status)    qs.set('status',    opts.status);
    const q = qs.toString();
    return apiRequest<{ enrollments: EnrollmentRow[] }>(`/api/v1/hrm/training/enrollments${q ? `?${q}` : ''}`);
  },
  enroll(payload: { targetUserId: string; courseId: string; dueDate?: string; notes?: string }, actorUserId?: string | null) {
    return apiRequest<{ enrollment: EnrollmentRow }>(`/api/v1/hrm/training/enrollments${actorQuery(actorUserId)}`, {
      method: 'POST',
      body: { ...payload, actorUserId },
    });
  },
  complete(id: string, payload: { score?: number | string; certificate?: string; notes?: string } = {}, actorUserId?: string | null) {
    return apiRequest<{ enrollment: EnrollmentRow }>(`/api/v1/hrm/training/enrollments/${encodeURIComponent(id)}/complete${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },
  cancel(id: string, payload: { notes?: string } = {}, actorUserId?: string | null) {
    return apiRequest<{ enrollment: EnrollmentRow }>(`/api/v1/hrm/training/enrollments/${encodeURIComponent(id)}/cancel${actorQuery(actorUserId)}`, {
      method: 'PUT',
      body: { ...payload, actorUserId },
    });
  },

  listUserCertifications(userId: string) {
    return apiRequest<{ certifications: CertificationRow[] }>(`/api/v1/hrm/training/certifications/${encodeURIComponent(userId)}`);
  },
};
