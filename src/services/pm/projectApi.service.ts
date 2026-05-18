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
  const { project } = await apiRequest<{ project: Project }>(`/api/v1/projects/${id}`);
  return project;
}

export async function createProject(data: Omit<Project, 'id' | 'kpis'>): Promise<Project> {
  const res = await apiRequest<{ project: Project }>('/api/v1/projects', {
    method: 'POST',
    body: data,
  });
  return res.project;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: data,
  });
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${id}`, { method: 'DELETE' });
}

export async function fetchProjectMembers(id: string): Promise<ProjectMember[]> {
  const { members } = await apiRequest<{ members: ProjectMember[] }>(`/api/v1/projects/${id}/members`);
  return members;
}

export async function addProjectMember(
  id: string,
  data: { userId: string; role: string },
): Promise<ProjectMember> {
  const { member } = await apiRequest<{ member: ProjectMember }>(`/api/v1/projects/${id}/members`, {
    method: 'POST',
    body: data,
  });
  return member;
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
  const { workItem } = await apiRequest<{ workItem: WorkItem }>(`/api/v1/projects/${projectId}/work-items`, {
    method: 'POST',
    body: data,
  });
  return workItem;
}

export async function updateWorkItem(
  projectId: string,
  itemId: string,
  data: Partial<WorkItem>,
): Promise<WorkItem> {
  const { workItem } = await apiRequest<{ workItem: WorkItem }>(`/api/v1/projects/${projectId}/work-items/${itemId}`, {
    method: 'PATCH',
    body: data,
  });
  return workItem;
}

export async function deleteWorkItem(projectId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/projects/${projectId}/work-items/${itemId}`, {
    method: 'DELETE',
  });
}
