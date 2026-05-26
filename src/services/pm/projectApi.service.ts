import { apiRequest } from '../../lib/apiClient';
import { Milestone, Project, ProjectMember, ProjectScope, WorkItem } from '../../types/pm';

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
  actor?: { actorUserId?: string; actorDisplayName?: string },
): Promise<WorkItem> {
  const qs = actor?.actorUserId ? `?userId=${encodeURIComponent(actor.actorUserId)}` : '';
  const { workItem } = await apiRequest<{ workItem: WorkItem }>(`/api/v1/projects/${projectId}/work-items${qs}`, {
    method: 'POST',
    body: { ...data, actorUserId: actor?.actorUserId, actorDisplayName: actor?.actorDisplayName },
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

// ── Sub-tasks (D13) ───────────────────────────────────────────────────────

export async function createSubTask(
  parentWorkItemId: string,
  data: Partial<WorkItem> & { title: string },
): Promise<WorkItem> {
  const { workItem } = await apiRequest<{ workItem: WorkItem }>(
    `/api/v1/pm/work-items/${parentWorkItemId}/subtasks`,
    { method: 'POST', body: data },
  );
  return workItem;
}

export async function fetchSubTasks(workItemId: string): Promise<WorkItem[]> {
  const { subtasks } = await apiRequest<{ subtasks: WorkItem[] }>(
    `/api/v1/pm/work-items/${workItemId}/subtasks`,
  );
  return subtasks;
}

export async function moveWorkItemParent(
  workItemId: string,
  parentId: string | null,
): Promise<WorkItem> {
  const { workItem } = await apiRequest<{ workItem: WorkItem }>(
    `/api/v1/pm/work-items/${workItemId}/parent`,
    { method: 'PATCH', body: { parentId } },
  );
  return workItem;
}

// ── Milestones (Sprint 5 — Task 5.3) ──────────────────────────────────────

export async function fetchProjectMilestones(projectId: string): Promise<Milestone[]> {
  const { milestones } = await apiRequest<{ milestones: Milestone[] }>(
    `/api/v1/projects/${projectId}/milestones`,
  );
  return milestones;
}

export async function createMilestone(
  projectId: string,
  data: {
    title: string;
    dueDate: string;
    description?: string;
    status?: 'planned' | 'in_progress' | 'done' | 'blocked';
    ownerId?: string | null;
    completionPct?: number;
    dependsOnIds?: string[];
  },
): Promise<Milestone> {
  const { milestone } = await apiRequest<{ milestone: Milestone }>(
    `/api/v1/projects/${projectId}/milestones`,
    { method: 'POST', body: data },
  );
  return milestone;
}

export async function updateMilestone(
  projectId: string,
  milestoneId: string,
  data: Partial<{
    title: string;
    dueDate: string;
    description: string;
    status: 'planned' | 'in_progress' | 'done' | 'blocked';
    ownerId: string | null;
    completionPct: number;
    dependsOnIds: string[];
  }>,
): Promise<Milestone> {
  const { milestone } = await apiRequest<{ milestone: Milestone }>(
    `/api/v1/projects/${projectId}/milestones/${milestoneId}`,
    { method: 'PATCH', body: data },
  );
  return milestone;
}

export async function deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
  await apiRequest<void>(
    `/api/v1/projects/${projectId}/milestones/${milestoneId}`,
    { method: 'DELETE' },
  );
}

// ── Milestone hierarchy (DH12) ────────────────────────────────────────────

export async function createSubMilestone(
  parentId: string,
  data: {
    title: string;
    dueDate: string;
    description?: string;
    status?: 'planned' | 'in_progress' | 'done' | 'blocked';
    ownerId?: string | null;
    completionPct?: number;
  },
): Promise<Milestone> {
  const { milestone } = await apiRequest<{ milestone: Milestone }>(
    `/api/v1/pm/milestones/${parentId}/sub-milestones`,
    { method: 'POST', body: data },
  );
  return milestone;
}

export async function listSubMilestones(milestoneId: string): Promise<Milestone[]> {
  const { subMilestones } = await apiRequest<{ subMilestones: Milestone[] }>(
    `/api/v1/pm/milestones/${milestoneId}/sub-milestones`,
  );
  return subMilestones;
}

export async function moveSubMilestone(
  milestoneId: string,
  newParentId: string | null,
): Promise<Milestone> {
  const { milestone } = await apiRequest<{ milestone: Milestone }>(
    `/api/v1/pm/milestones/${milestoneId}/parent`,
    { method: 'PATCH', body: { parentId: newParentId } },
  );
  return milestone;
}
