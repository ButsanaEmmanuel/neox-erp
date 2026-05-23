// HRM-2.2 — Typed client for /api/v1/hrm/onboarding/* and
// /api/v1/hrm/offboarding/*. The shape mirrors the backend service —
// the UI converts to the legacy "plan" shape inline so the kanban /
// detail components don't need a full rewrite.

import { apiRequest } from '../lib/apiClient';

export type TaskStatus = 'pending' | 'done' | 'skipped';
export type ChecklistStatus = 'in_progress' | 'completed';

export interface TemplateTask {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  dueOffsetDays: number;
  assignedRole: string | null;
  isRequired: boolean;
  order: number;
}

export interface TemplateSummary {
  id: string;
  name: string;
  departmentId: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  department: { id: string; code: string; name: string } | null;
  _count?: { tasks: number; checklists: number };
}

export interface TemplateDetail extends TemplateSummary {
  tasks: TemplateTask[];
}

export interface ChecklistTaskRow {
  id: string;
  checklistId: string;
  templateTaskId: string;
  statusCode: TaskStatus;
  completedByUserId: string | null;
  completedAt: string | null;
  note: string | null;
  templateTask: TemplateTask;
  completedBy: { id: string; name: string | null; email: string | null } | null;
}

export interface ChecklistSummary {
  id: string;
  userId: string;
  templateId: string;
  startDate: string;
  statusCode: ChecklistStatus;
  completedAt: string | null;
  user: { id: string; name: string | null; email: string | null; departmentId?: string | null };
  template: { id: string; name: string; departmentId: string | null };
  _count?: { tasks: number };
  tasks?: Array<{ statusCode: TaskStatus }>;
}

export interface ChecklistDetail extends Omit<ChecklistSummary, 'tasks'> {
  tasks: ChecklistTaskRow[];
}

export interface CompletionStat {
  id: string;
  userId: string;
  statusCode: ChecklistStatus;
  total: number;
  done: number;
  progressPct: number;
}

function actorQuery(actor?: string | null) {
  return actor ? `?actorUserId=${encodeURIComponent(actor)}` : '';
}

function makeApi(scope: 'onboarding' | 'offboarding') {
  return {
    listTemplates(opts: { departmentId?: string; includeInactive?: boolean } = {}) {
      const qs = new URLSearchParams();
      if (opts.departmentId) qs.set('departmentId', opts.departmentId);
      if (opts.includeInactive) qs.set('includeInactive', 'true');
      const q = qs.toString();
      return apiRequest<{ templates: TemplateSummary[] }>(`/api/v1/hrm/${scope}/templates${q ? `?${q}` : ''}`);
    },
    getTemplate(id: string) {
      return apiRequest<{ template: TemplateDetail }>(`/api/v1/hrm/${scope}/templates/${encodeURIComponent(id)}`);
    },
    createTemplate(payload: {
      name: string;
      departmentId?: string;
      isActive?: boolean;
      tasks?: Array<Partial<TemplateTask>>;
    }, actorUserId?: string | null) {
      return apiRequest<{ template: TemplateDetail }>(`/api/v1/hrm/${scope}/templates${actorQuery(actorUserId)}`, {
        method: 'POST',
        body: { ...payload, actorUserId },
      });
    },
    updateTemplate(id: string, payload: {
      name?: string;
      departmentId?: string | null;
      isActive?: boolean;
      tasks?: Array<Partial<TemplateTask>>;
    }, actorUserId?: string | null) {
      return apiRequest<{ template: TemplateDetail }>(`/api/v1/hrm/${scope}/templates/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
        method: 'PUT',
        body: { ...payload, actorUserId },
      });
    },
    deleteTemplate(id: string, actorUserId?: string | null) {
      return apiRequest<{ id: string; deleted: boolean }>(`/api/v1/hrm/${scope}/templates/${encodeURIComponent(id)}${actorQuery(actorUserId)}`, {
        method: 'DELETE',
        body: { actorUserId },
      });
    },

    listChecklists(opts: { forUserId?: string; status?: ChecklistStatus } = {}) {
      const qs = new URLSearchParams();
      if (opts.forUserId) qs.set('forUserId', opts.forUserId);
      if (opts.status) qs.set('status', opts.status);
      const q = qs.toString();
      return apiRequest<{ checklists: ChecklistSummary[] }>(`/api/v1/hrm/${scope}/checklists${q ? `?${q}` : ''}`);
    },
    getChecklist(id: string) {
      return apiRequest<{ checklist: ChecklistDetail }>(`/api/v1/hrm/${scope}/checklists/${encodeURIComponent(id)}`);
    },
    updateTask(checklistId: string, taskId: string, payload: { statusCode: TaskStatus; note?: string }, actorUserId?: string | null) {
      return apiRequest<{ task: ChecklistTaskRow }>(`/api/v1/hrm/${scope}/checklists/${encodeURIComponent(checklistId)}/tasks/${encodeURIComponent(taskId)}${actorQuery(actorUserId)}`, {
        method: 'PUT',
        body: { ...payload, actorUserId },
      });
    },
    completeChecklist(id: string, actorUserId?: string | null) {
      return apiRequest<{ checklist: ChecklistSummary }>(`/api/v1/hrm/${scope}/checklists/${encodeURIComponent(id)}/complete${actorQuery(actorUserId)}`, {
        method: 'PUT',
        body: { actorUserId },
      });
    },
    getStats(opts: { forUserId?: string } = {}) {
      const qs = new URLSearchParams();
      if (opts.forUserId) qs.set('forUserId', opts.forUserId);
      const q = qs.toString();
      return apiRequest<{ stats: CompletionStat[] }>(`/api/v1/hrm/${scope}/stats${q ? `?${q}` : ''}`);
    },
  };
}

export const onboardingApi = makeApi('onboarding');
export const offboardingApi = makeApi('offboarding');

export function startOffboardingApi(payload: { userId: string; templateId?: string; startDate?: string }, actorUserId?: string | null) {
  return apiRequest<{ checklist: ChecklistSummary }>(`/api/v1/hrm/offboarding/start${actorQuery(actorUserId)}`, {
    method: 'POST',
    body: { ...payload, actorUserId },
  });
}
