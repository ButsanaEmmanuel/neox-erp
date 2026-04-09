import { apiRequest } from '../lib/apiClient';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  phoneNumber?: string;
  supervisorId?: string;
  supervisorName?: string;
  preferredLanguage?: 'fr' | 'en';
  notifyCrm?: boolean;
  notifyProjects?: boolean;
  notifyFinance?: boolean;
  quickStatus?: 'online' | 'in_meeting' | 'on_leave';
  avatar?: string;
  forcePasswordChange?: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  token?: string;
}

export async function loginWithApi(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function changePasswordWithApi(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
  const stored = localStorage.getItem('neox-auth-session');
  const session = stored ? JSON.parse(stored) : null;
  const email = session?.email ?? '';
  return apiRequest<{ success: boolean }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: { email, currentPassword, newPassword },
  });
}

export async function updateProfileWithApi(
  currentUserId: string | undefined,
  currentEmail: string,
  data: Partial<Pick<AuthUser, 'name' | 'email' | 'avatar' | 'jobTitle' | 'phoneNumber' | 'supervisorId' | 'preferredLanguage' | 'notifyCrm' | 'notifyProjects' | 'notifyFinance' | 'quickStatus'>>
): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/api/v1/auth/profile', {
    method: 'PATCH',
    body: {
      currentUserId,
      currentEmail,
      ...data,
    },
  });
}

export async function getProfileWithApi(currentUserId?: string, currentEmail?: string): Promise<{ user: AuthUser }> {
  const params = new URLSearchParams();
  if (currentUserId) params.set('userId', currentUserId);
  if (currentEmail) params.set('email', currentEmail);
  return apiRequest<{ user: AuthUser }>(`/api/v1/auth/profile?${params.toString()}`);
}
