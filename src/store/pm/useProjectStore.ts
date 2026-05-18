import { create } from 'zustand';
import {
  Project,
  ProjectMember,
  WorkItem,
  Document,
  ImportRecord,
  ProjectScope,
  ProjectActivity,
  TelecomImportBatch,
  TelecomImportRow,
  WorkItemStatus,
} from '../../types/pm';
import { detectTelecomByClient } from '../../services/pm/telecomImport.service';
import { bulkImportTelecomWorkItemsInBackend, createProjectInBackend, fetchProjectsForUser } from '../../services/pm/projectCollaborationBackend.service';
import * as projectApi from '../../services/pm/projectApi.service';

type CreateProjectInput = Omit<Project, 'id' | 'kpis'> & {
  creatorUserId?: string;
  creatorDisplayName?: string;
};

interface ProjectStore {
  projects: Project[];
  projectsLoading: boolean;
  projectsLoaded: boolean;
  activeProjectId: string | null;
  workItems: WorkItem[];
  documents: Document[];
  imports: ImportRecord[];
  activities: ProjectActivity[];
  telecomImportBatches: TelecomImportBatch[];
  projectMembers: Record<string, ProjectMember[]>;

  setActiveProject: (id: string | null) => void;
  replaceProjectDataset: (projects: Project[], workItems: WorkItem[]) => void;
  loadProjectsForUser: (userId: string) => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'kpis'>) => string;
  createProjectWithWorkflow: (project: CreateProjectInput) => Promise<{ projectId: string; redirectToImport: boolean }>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addWorkItem: (item: Omit<WorkItem, 'id'>) => Promise<void>;
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => Promise<void>;
  updateTelecomManualFields: (id: string, updates: Pick<WorkItem, 'ticket_number' | 'operational_manual_fields' | 'acceptance_manual_fields'>) => void;
  retryFinanceSync: (id: string) => void;
  deleteWorkItem: (id: string) => Promise<void>;
  importWorkItems: (items: Omit<WorkItem, 'id'>[]) => void;
  importTelecomRows: (projectId: string, fileName: string, rows: TelecomImportRow[], uploader: string, actorUserId?: string) => Promise<{ batchId: string; created: number; failed: number }>;
  addImportRecord: (record: ImportRecord) => void;
  addDocument: (doc: Document) => void;
  addScopeItem: (projectId: string, type: 'objectives' | 'deliverables' | 'outOfScope' | 'assumptions', text: string) => void;
  logActivity: (activity: Omit<ProjectActivity, 'id' | 'timestamp'>) => void;
  fetchProjectMembers: (projectId: string) => Promise<void>;
  addProjectMember: (projectId: string, data: { userId: string; role: string }) => Promise<void>;
  removeProjectMember: (projectId: string, userId: string) => Promise<void>;
}

const MOCK_PROJECTS: Project[] = [];
const MOCK_WORK_ITEMS: WorkItem[] = [];
const MOCK_ACTIVITIES: ProjectActivity[] = [];

function recalcProjectKpis(projects: Project[], workItems: WorkItem[]): Project[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return projects.map((p) => {
    const pItems = workItems.filter((wi) => wi.projectId === p.id);
    const total = pItems.length;
    const done = pItems.filter((wi) => wi.status === 'done' || wi.status === 'complete' || wi.status === 'finance_synced').length;
    const qa = pItems.filter((wi) => wi.status === 'pending-qa').length;
    const pendingAcceptance = pItems.filter((wi) => wi.status === 'pending-acceptance').length;
    const overdue = pItems.filter((wi) => wi.status !== 'done' && wi.plannedDate && wi.plannedDate < todayStr).length;

    const delayedItems = pItems.filter((wi) => wi.schedule_status === 'delayed' || wi.is_delayed).length;
    const earlyItems = pItems.filter((wi) => wi.schedule_status === 'early').length;
    const onTimeItems = pItems.filter((wi) => wi.schedule_status === 'on_time').length;
    const varianceRows = pItems.filter((wi) => typeof wi.start_variance_days === 'number');
    const averageDelayDays = varianceRows.length > 0
      ? Math.round((varianceRows.reduce((sum, wi) => sum + Number(wi.start_variance_days || 0), 0) / varianceRows.length) * 10) / 10
      : 0;

    const telecomSummary = p.isTelecomProject
      ? {
          totalImportedRows: pItems.length,
          incompleteItems: pItems.filter((wi) => wi.status === 'needs_manual_completion' || wi.manual_completion_status !== 'complete').length,
          financePending: pItems.filter((wi) => wi.finance_sync_status === 'pending' || wi.finance_sync_status === 'blocked').length,
          financeSynced: pItems.filter((wi) => wi.finance_sync_status === 'synced').length,
          errorRows: pItems.filter((wi) => wi.status === 'validation_error' || wi.finance_sync_status === 'error' || wi.finance_sync_status === 'blocked').length,
          qaApprovedItems: pItems.filter((wi) => wi.qaStatus === 'approved').length,
          acceptanceSignedItems: pItems.filter((wi) => wi.acceptanceStatus === 'signed').length,
          delayedItems,
          onTimeItems,
          earlyItems,
          averageDelayDays,
        }
      : undefined;

    return {
      ...p,
      telecomSummary,
      kpis: {
        totalWorkItems: total,
        completed: done,
        pendingQA: qa,
        pendingAcceptance,
        overdue,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      },
    };
  });
}

export const useProjectStore = create<ProjectStore>()(
  (set, get) => {
    const initialProjects = recalcProjectKpis(MOCK_PROJECTS, MOCK_WORK_ITEMS);

      return {
        projects: initialProjects,
        projectsLoading: false,
        projectsLoaded: false,
        activeProjectId: null,
        workItems: MOCK_WORK_ITEMS,
        documents: [],
        imports: [],
        activities: MOCK_ACTIVITIES,
        telecomImportBatches: [],
        projectMembers: {},

        setActiveProject: (id: string | null) => set({ activeProjectId: id }),

        replaceProjectDataset: (projects, workItems) =>
          set((state: ProjectStore) => ({
            projects: recalcProjectKpis(projects, workItems),
            workItems,
            projectsLoaded: true,
            projectsLoading: false,
            activeProjectId: state.activeProjectId && projects.some((p) => p.id === state.activeProjectId)
              ? state.activeProjectId
              : (projects[0]?.id || null),
          })),

        loadProjectsForUser: async (userId: string) => {
          if (!userId) {
            set({ projects: [], workItems: [], projectsLoaded: true, projectsLoading: false, activeProjectId: null });
            return;
          }
          set({ projectsLoading: true });
          try {
            const response = await fetchProjectsForUser(userId);
            const projects = Array.isArray(response.projects) ? response.projects : [];
            const workItems = Array.isArray(response.workItems) ? response.workItems : [];
            get().replaceProjectDataset(projects, workItems);
          } catch (error) {
            console.error('Failed to load user projects from backend', error);
            set({ projectsLoading: false, projectsLoaded: true });
          }
        },

        logActivity: (activity) => {
          const newActivity: ProjectActivity = {
            ...activity,
            id: `act-${Date.now()}`,
            timestamp: new Date().toISOString(),
          };
          set((state: ProjectStore) => ({
            activities: [newActivity, ...state.activities],
          }));
        },

        createProject: (newProject) => {
          const id = `proj-${Date.now()}`;
          const inferredTelecom = detectTelecomByClient(newProject.clientName, newProject.projectCategory);
          const isTelecomProject = newProject.isTelecomProject ?? inferredTelecom;
          const bulkImportRequired = newProject.bulkImportRequired ?? isTelecomProject;

          const project: Project = {
            ...newProject,
            id,
            projectMode: newProject.projectMode || (isTelecomProject ? 'telecom_multi_site' : 'standard'),
            isTelecomProject,
            bulkImportRequired,
            kpis: {
              totalWorkItems: 0,
              completed: 0,
              pendingQA: 0,
              pendingAcceptance: 0,
              overdue: 0,
              progress: 0,
            },
          };

          set((state: ProjectStore) => ({
            projects: [project, ...state.projects],
            activeProjectId: id,
            activities: [
              {
                id: `act-${Date.now()}`,
                projectId: id,
                userId: 'current-user',
                userName: 'System',
                action: isTelecomProject
                  ? 'created telecom multi-site parent project'
                  : 'created standard project',
                targetId: id,
                targetName: project.name,
                timestamp: new Date().toISOString(),
                type: 'project',
              },
              ...state.activities,
            ],
          }));

          return id;
        },

        createProjectWithWorkflow: async (newProject) => {
          try {
            const response = await createProjectInBackend({
              name: newProject.name,
              clientName: newProject.clientName || newProject.client || '',
              clientId: newProject.clientId || undefined,
              managerId: newProject.managerId,
              status: newProject.status,
              projectMode: newProject.projectMode,
              projectCategory: newProject.projectCategory,
              isTelecomProject: newProject.isTelecomProject,
              bulkImportRequired: newProject.bulkImportRequired,
              purchase_order: newProject.purchase_order,
              poNumber: newProject.poNumber,
              startDate: newProject.startDate,
              endDate: newProject.endDate,
              description: newProject.description,
              creatorUserId: newProject.creatorUserId,
              creatorDisplayName: newProject.creatorDisplayName,
            });
            const created = response?.project;
            if (!created) {
              throw new Error('Project creation failed: backend did not return a project.');
            }

            const existingProjects = get().projects.filter((p) => p.id !== created.id);
            const existingWorkItems = get().workItems.filter((wi) => wi.projectId !== created.id);
            const createdWorkItems = (created.workItems || []) as WorkItem[];
            const nextProjects = recalcProjectKpis([created as Project, ...existingProjects], [...createdWorkItems, ...existingWorkItems]);

            set({
              projects: nextProjects,
              workItems: [...createdWorkItems, ...existingWorkItems],
              activeProjectId: created.id,
            });

            return {
              projectId: created.id,
              redirectToImport: Boolean(created.isTelecomProject && created.bulkImportRequired),
            };
          } catch (error) {
            const fallbackId = get().createProject(newProject);
            const fallback = get().projects.find((p) => p.id === fallbackId);
            return {
              projectId: fallbackId,
              redirectToImport: Boolean(fallback?.isTelecomProject && fallback?.bulkImportRequired),
            };
          }
        },

        updateProject: async (id, updates) => {
          const updated = await projectApi.updateProject(id, updates);
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? updated : p)),
          }));
        },

        deleteProject: async (id) => {
          await projectApi.deleteProject(id);
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            workItems: state.workItems.filter((wi) => wi.projectId !== id),
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          }));
        },

        fetchProjectMembers: async (projectId) => {
          const members = await projectApi.fetchProjectMembers(projectId);
          set((state) => ({
            projectMembers: { ...state.projectMembers, [projectId]: members },
          }));
        },

        addProjectMember: async (projectId, data) => {
          await projectApi.addProjectMember(projectId, data);
          // Invalide le cache pour forcer un re-fetch
          set((state) => ({
            projectMembers: { ...state.projectMembers, [projectId]: [] },
          }));
        },

        removeProjectMember: async (projectId, userId) => {
          await projectApi.removeProjectMember(projectId, userId);
          set((state) => ({
            projectMembers: {
              ...state.projectMembers,
              [projectId]: (state.projectMembers[projectId] ?? []).filter(
                (m) => m.userId !== userId
              ),
            },
          }));
        },

        addWorkItem: async (item) => {
          const created = await projectApi.createWorkItem(item.projectId, item);
          set((state) => {
            const newWorkItems = [...state.workItems, created];
            return {
              workItems: newWorkItems,
              projects: recalcProjectKpis(state.projects, newWorkItems),
            };
          });
        },

        updateWorkItem: async (id, updates) => {
          const item = get().workItems.find((wi) => wi.id === id);
          if (!item) return;
          const updated = await projectApi.updateWorkItem(item.projectId, id, updates);
          set((state) => ({
            workItems: state.workItems.map((wi) => (wi.id === id ? updated : wi)),
          }));
        },


        updateTelecomManualFields: (_id, _updates) => {
          // TODO: Phase 4 — migrate to finance details endpoint
          // (telecomFinanceSync stubs removed; this action is a no-op until Phase 4)
          console.warn('updateTelecomManualFields: not implemented, pending Phase 4');
        },

        retryFinanceSync: (_id) => {
          // TODO: Phase 4 — migrate to finance details endpoint
          console.warn('retryFinanceSync: not implemented, pending Phase 4');
        },

        deleteWorkItem: async (id) => {
          const item = get().workItems.find((wi) => wi.id === id);
          if (!item) return;
          await projectApi.deleteWorkItem(item.projectId, id);
          set((state) => {
            const newWorkItems = state.workItems.filter((wi) => wi.id !== id);
            return {
              workItems: newWorkItems,
              projects: recalcProjectKpis(state.projects, newWorkItems),
            };
          });
        },

        importWorkItems: (newItems) => {
          set((state: ProjectStore) => {
            const now = Date.now();
            const itemsWithIds: WorkItem[] = newItems.map((item, index) => ({
              ...item,
              id: `wi-${now}-${index}`,
            }));
            const newWorkItems = [...state.workItems, ...itemsWithIds];
            return {
              workItems: newWorkItems,
              projects: recalcProjectKpis(state.projects, newWorkItems),
              activities: [
                {
                  id: `act-${Date.now()}`,
                  projectId: newItems[0]?.projectId || '',
                  userId: 'current-user',
                  userName: 'System',
                  action: `imported ${newItems.length} items`,
                  targetId: 'bulk',
                  targetName: 'Bulk Import',
                  timestamp: new Date().toISOString(),
                  type: 'import',
                },
                ...state.activities,
              ],
            };
          });
        },

        importTelecomRows: async (projectId, fileName, rows, uploader, actorUserId) => {
          const backendResult = await bulkImportTelecomWorkItemsInBackend({
            projectId,
            fileName,
            rows,
            actorUserId,
            actorDisplayName: uploader,
          });
          if (actorUserId) {
            await get().loadProjectsForUser(actorUserId);
          }
          return {
            batchId: backendResult.batchId || `batch-${Date.now()}`,
            created: Number(backendResult.created || 0),
            failed: Number(backendResult.failed || 0),
          };
        },

        addImportRecord: (record) =>
          set((state: ProjectStore) => ({
            imports: [record, ...state.imports],
          })),

        addDocument: (doc) =>
          set((state: ProjectStore) => ({
            documents: [doc, ...state.documents],
            activities: [
              {
                id: `act-${Date.now()}`,
                projectId: doc.projectId,
                userId: 'current-user',
                userName: 'System',
                action: `uploaded document: ${doc.name}`,
                targetId: doc.id,
                targetName: doc.name,
                timestamp: new Date().toISOString(),
                type: 'document',
              },
              ...state.activities,
            ],
          })),

        addScopeItem: (projectId, type, text) =>
          set((state: ProjectStore) => {
            const newItem = {
              id: `${type.slice(0, 3)}-${Date.now()}`,
              text,
              createdAt: new Date().toISOString(),
              ...(type === 'deliverables' ? { status: 'pending', evidenceRequired: false } : {}),
              ...(type === 'assumptions' ? { riskLevel: 'low' } : {}),
            };

            return {
              activities: [
                {
                  id: `act-${Date.now()}`,
                  projectId,
                  userId: 'current-user',
                  userName: 'System',
                  action: `added scope ${type.slice(0, -1)}: ${text}`,
                  targetId: newItem.id,
                  targetName: text,
                  timestamp: new Date().toISOString(),
                  type: 'scope',
                },
                ...state.activities,
              ],
              projects: state.projects.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      scope: {
                        objectives: p.scope?.objectives || [],
                        deliverables: p.scope?.deliverables || [],
                        outOfScope: p.scope?.outOfScope || [],
                        assumptions: p.scope?.assumptions || [],
                        [type]: [...(p.scope?.[type] || []), newItem],
                      } as ProjectScope,
                    }
                  : p
              ),
            };
          }),
      };
    }
);
