import { apiRequest } from '../../lib/apiClient';

export interface BackendActivity {
  id: string;
  actorDisplayName?: string | null;
  message: string;
  eventSource: string;
  createdAt: string;
}

export interface BackendFile {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName?: string | null;
  createdAt: string;
}

export interface ProjectItemBackendState {
  poUnitPrice?: number | null;
  ticketNumber?: number | null;
  qaStatus?: string | null;
  acceptanceStatus?: string | null;
  operationalManualFieldsJson?: Record<string, unknown> | null;
  acceptanceManualFieldsJson?: Record<string, unknown> | null;
  importedFieldsJson?: Record<string, unknown> | null;
  planningAuditDate?: string | null;
  planningAuditWeek?: number | null;
  forecastDate?: string | null;
  forecastWeek?: number | null;
  actualAuditDate?: string | null;
  actualAuditWeek?: number | null;
  startVarianceDays?: number | null;
  scheduleStatus?: 'on_time' | 'delayed' | 'early' | null;
  isDelayed?: boolean;
  poUnitPriceCompleted?: number | null;
  contractorPayableAmount?: number | null;
  isFinanciallyEligible: boolean;
  financialEligibilityReason?: string | null;
  financeSyncStatus?: string | null;
  financeSyncAt?: string | null;
  financeReferenceId?: string | null;
  financeErrorMessage?: string | null;
}

export async function saveProjectItemDetailsToBackend(params: {
  projectId: string;
  workItemId: string;
  actorUserId?: string;
  actorDisplayName?: string;
  poUnitPrice?: number;
  ticketNumber?: number;
  contractorPayableAmount?: number;
  // null explicitly un-links the contractor; undefined leaves it alone.
  contractorId?: string | null;
  qaStatus?: string;
  acceptanceStatus?: string;
  importedFields?: Record<string, unknown>;
  operationalManualFields?: Record<string, unknown>;
  acceptanceManualFields?: Record<string, unknown>;
}) {
  const qs = params.actorUserId ? `?userId=${encodeURIComponent(params.actorUserId)}` : '';
  return apiRequest<{ state: ProjectItemBackendState }>(
    `/api/v1/pm/projects/${params.projectId}/work-items/${params.workItemId}/details${qs}`,
    {
      method: 'PATCH',
      body: params,
    }
  );
}

export async function fetchProjectItemActivities(projectId: string, workItemId: string, userId?: string) {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<{ activities: BackendActivity[] }>(
    `/api/v1/pm/projects/${projectId}/work-items/${workItemId}/activities${qs}`
  );
}

export async function fetchProjectItemFiles(projectId: string, workItemId: string, userId?: string) {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<{ files: BackendFile[] }>(
    `/api/v1/pm/projects/${projectId}/work-items/${workItemId}/files${qs}`
  );
}

export async function uploadProjectItemFileToBackend(params: {
  projectId: string;
  workItemId: string;
  actorUserId?: string;
  actorDisplayName?: string;
  file: File;
  category?: string;
}) {
  const arrayBuffer = await params.file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const contentBase64 = btoa(binary);

  const qs = params.actorUserId ? `?userId=${encodeURIComponent(params.actorUserId)}` : '';
  return apiRequest<{ file: BackendFile }>(
    `/api/v1/pm/projects/${params.projectId}/work-items/${params.workItemId}/files${qs}`,
    {
      method: 'POST',
      body: {
        actorUserId: params.actorUserId,
        actorDisplayName: params.actorDisplayName,
        originalFileName: params.file.name,
        mimeType: params.file.type || 'application/octet-stream',
        sizeBytes: params.file.size,
        category: params.category || 'other',
        contentBase64,
      },
    }
  );
}

export async function deleteProjectItemFileFromBackend(params: {
  fileId: string;
  actorUserId?: string;
  actorDisplayName?: string;
}) {
  const qs = params.actorUserId ? `?userId=${encodeURIComponent(params.actorUserId)}` : '';
  return apiRequest<{ success: boolean }>(`/api/v1/pm/files/${params.fileId}${qs}`, {
    method: 'DELETE',
    body: {
      actorUserId: params.actorUserId,
      actorDisplayName: params.actorDisplayName,
    },
  });
}

export function getProjectItemFileDownloadUrl(fileId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}/api/v1/pm/files/${fileId}/download`;
}
