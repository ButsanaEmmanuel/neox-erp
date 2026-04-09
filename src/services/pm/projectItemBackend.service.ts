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
  qaStatus?: string;
  acceptanceStatus?: string;
  importedFields?: Record<string, unknown>;
  operationalManualFields?: Record<string, unknown>;
  acceptanceManualFields?: Record<string, unknown>;
}) {
  return apiRequest<{ state: ProjectItemBackendState }>(
    `/api/v1/pm/projects/${params.projectId}/work-items/${params.workItemId}/details`,
    {
      method: 'PATCH',
      body: params,
    }
  );
}

export async function fetchProjectItemActivities(projectId: string, workItemId: string) {
  return apiRequest<{ activities: BackendActivity[] }>(
    `/api/v1/pm/projects/${projectId}/work-items/${workItemId}/activities`
  );
}

export async function fetchProjectItemFiles(projectId: string, workItemId: string) {
  return apiRequest<{ files: BackendFile[] }>(
    `/api/v1/pm/projects/${projectId}/work-items/${workItemId}/files`
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

  return apiRequest<{ file: BackendFile }>(
    `/api/v1/pm/projects/${params.projectId}/work-items/${params.workItemId}/files`,
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
  return apiRequest<{ success: boolean }>(`/api/v1/pm/files/${params.fileId}`, {
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
