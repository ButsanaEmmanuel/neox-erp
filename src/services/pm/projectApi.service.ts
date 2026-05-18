import { apiRequest } from '../../lib/apiClient';
import { Project, ProjectMember, ProjectScope, WorkItem } from '../../types/pm';

export async function fetchProjectsWithWorkItems(
  userId: string,
): Promise<{ projects: Project[]; workItems: WorkItem[] }> {
  return apiRequest(`/api/v1/projects?userId=${encodeURIComponent(userId)}`);
}

export async function fetchProjects(userId: string): Promise<Project[]> {
  const res = await fetchProjectsWithWorkItems(userId);
  return res.projects;
}

export async function fetchProjectById(id: string): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${id}`);
}

export async function createProject(data: Omit<Project, 'id' | 'kpis'>): Promise<Project> {
  const res = await apiRequest<{ project: Project }>('/api/v1/projects', {
    method: 'POST',
    body: data,
  });
  return res.project;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  return apiRequest<Project>(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${id}`, { method: 'DELETE' });
}

export async function fetchProjectMembers(id: string): Promise<ProjectMember[]> {
  return apiRequest<ProjectMember[]>(`/api/v1/projects/${id}/members`);
}

export async function addProjectMember(
  id: string,
  data: { userId: string; role: string },
): Promise<ProjectMember> {
  return apiRequest<ProjectMember>(`/api/v1/projects/${id}/members`, {
    method: 'POST',
    body: data,
  });
}

export async function removeProjectMember(id: string, userId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${id}/members/${userId}`, { method: 'DELETE' });
}

export async function fetchProjectScope(id: string): Promise<ProjectScope> {
  return apiRequest<ProjectScope>(`/api/v1/projects/${id}/scope`);
}

export async function updateProjectScope(
  id: string,
  data: Partial<ProjectScope>,
): Promise<ProjectScope> {
  return apiRequest<ProjectScope>(`/api/v1/projects/${id}/scope`, {
    method: 'PATCH',
    body: data,
  });
}

export async function createWorkItem(
  projectId: string,
  data: Omit<WorkItem, 'id'>,
): Promise<WorkItem> {
  return apiRequest<WorkItem>(`/api/v1/projects/${projectId}/work-items`, {
    method: 'POST',
    body: data,
  });
}

export async function updateWorkItem(
  projectId: string,
  itemId: string,
  data: Partial<WorkItem>,
): Promise<WorkItem> {
  return apiRequest<WorkItem>(`/api/v1/projects/${projectId}/work-items/${itemId}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function deleteWorkItem(projectId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${projectId}/work-items/${itemId}`, {
    method: 'DELETE',
  });
}
