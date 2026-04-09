import { apiRequest } from '../../lib/apiClient';
import { Project, WorkItem } from '../../types/pm';

export interface ProjectMemberRecord {
  id: string;
  userId: string;
  roleCode: 'LEAD' | 'CONTRIBUTOR' | 'VIEWER' | string;
  userName: string;
  departmentId: string;
}

export interface ProjectsForUserResponse {
  projects: Array<Project & { members?: ProjectMemberRecord[]; workItems?: WorkItem[] }>;
  workItems: WorkItem[];
}

export interface EngineeringDashboardStats {
  projectCount: number;
  progression: number;
  assignedTasks: number;
  activeMembers: number;
}

export interface TeamNotificationPayload {
  actionType: 'task_created' | 'work_item_updated' | 'project_updated' | string;
  message?: string;
  meta?: Record<string, unknown>;
  actorUserId?: string;
  actorDisplayName?: string;
}

export interface BulkTelecomImportResult {
  batchId: string | null;
  created: number;
  failed: number;
  total: number;
}

export interface CreateProjectBackendInput {
  name: string;
  clientName: string;
  clientId?: string;
  managerId: string;
  status?: string;
  projectMode?: string;
  projectCategory?: string;
  isTelecomProject?: boolean;
  bulkImportRequired?: boolean;
  purchase_order?: string;
  poNumber?: string;
  startDate: string;
  endDate: string;
  description?: string;
  creatorUserId?: string;
  creatorDisplayName?: string;
}

export async function fetchProjectsForUser(userId: string) {
  return apiRequest<ProjectsForUserResponse>(`/api/v1/projects?userId=${encodeURIComponent(userId)}`);
}

export async function fetchEngineeringDashboardStats(userId: string) {
  return apiRequest<EngineeringDashboardStats>(`/api/v1/projects/engineering-dashboard?userId=${encodeURIComponent(userId)}`);
}

export async function notifyTeam(projectId: string, payload: TeamNotificationPayload) {
  return apiRequest<{ ok: boolean; membersNotified: number; eventsCreated: number }>(`/api/v1/projects/${projectId}/notify-team`, {
    method: 'POST',
    body: payload,
  });
}

export async function fetchProjectTeamNotifications(userId: string, take = 30) {
  return apiRequest<{ notifications: Array<{ id: string; projectId: string; projectName: string; actionType: string; title: string; message: string; createdAt: string }> }>(
    `/api/v1/projects/notifications?userId=${encodeURIComponent(userId)}&take=${take}`,
  );
}

export async function createProjectInBackend(payload: CreateProjectBackendInput) {
  return apiRequest<{ project: Project & { members?: ProjectMemberRecord[]; workItems?: WorkItem[] } }>(`/api/v1/projects`, {
    method: 'POST',
    body: payload,
  });
}

export async function bulkImportTelecomWorkItemsInBackend(params: {
  projectId: string;
  fileName: string;
  rows: Array<{
    rowNumber: number;
    site_identifier: string;
    title: string;
    imported_fields: unknown;
    po_unit_price: number;
  }>;
  actorUserId?: string;
  actorDisplayName?: string;
}) {
  return apiRequest<BulkTelecomImportResult>(`/api/v1/projects/${params.projectId}/work-items/bulk-telecom`, {
    method: 'POST',
    body: {
      fileName: params.fileName,
      rows: params.rows,
      actorUserId: params.actorUserId,
      actorDisplayName: params.actorDisplayName,
    },
  });
}
