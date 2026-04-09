import { apiRequest } from '../lib/apiClient';

export interface ProvisionRecruitmentAccessRequest {
  candidateId: string;
  professionalEmail: string;
}

export interface ProvisionRecruitmentAccessResponse {
  candidateId: string;
  userId: string;
  username: string;
  forcePasswordChange: boolean;
}

export async function provisionRecruitmentAccess(
  payload: ProvisionRecruitmentAccessRequest,
): Promise<ProvisionRecruitmentAccessResponse> {
  return apiRequest<ProvisionRecruitmentAccessResponse>(`/api/v1/hrm/recruitment/${payload.candidateId}/provision-access`, {
    method: 'POST',
    body: payload,
  });
}
