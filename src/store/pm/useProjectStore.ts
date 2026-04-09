import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project,
  WorkItem,
  Document,
  ImportRecord,
  ProjectScope,
  ProjectActivity,
  TelecomImportBatch,
  TelecomImportRow,
  WorkItemStatus,
} from '../../types/pm';
import { calculateTelecomAmounts, evaluateFinancialEligibility } from '../../services/pm/telecomCalculation.service';
import { detectTelecomByClient } from '../../services/pm/telecomImport.service';
import { suspendContractorPayableSync, syncContractorPayableToFinance } from '../../services/pm/telecomFinanceSync.service';
import { bulkImportTelecomWorkItemsInBackend, createProjectInBackend, fetchProjectsForUser, notifyTeam as notifyProjectTeam } from '../../services/pm/projectCollaborationBackend.service';

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

  setActiveProject: (id: string | null) => void;
  replaceProjectDataset: (projects: Project[], workItems: WorkItem[]) => void;
  loadProjectsForUser: (userId: string) => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'kpis'>) => string;
  createProjectWithWorkflow: (project: CreateProjectInput) => Promise<{ projectId: string; redirectToImport: boolean }>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addWorkItem: (item: Omit<WorkItem, 'id'>) => void;
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => void;
  updateTelecomManualFields: (id: string, updates: Pick<WorkItem, 'ticket_number' | 'operational_manual_fields' | 'acceptance_manual_fields'>) => void;
  retryFinanceSync: (id: string) => void;
  deleteWorkItem: (id: string) => void;
  importWorkItems: (items: Omit<WorkItem, 'id'>[]) => void;
  importTelecomRows: (projectId: string, fileName: string, rows: TelecomImportRow[], uploader: string, actorUserId?: string) => Promise<{ batchId: string; created: number; failed: number }>;
  addImportRecord: (record: ImportRecord) => void;
  addDocument: (doc: Document) => void;
  addScopeItem: (projectId: string, type: 'objectives' | 'deliverables' | 'outOfScope' | 'assumptions', text: string) => void;
  logActivity: (activity: Omit<ProjectActivity, 'id' | 'timestamp'>) => void;
}

const MOCK_PROJECTS: Project[] = [];
const MOCK_WORK_ITEMS: WorkItem[] = [];
const MOCK_ACTIVITIES: ProjectActivity[] = [];

function emitGlobalProjectsRefresh() {
  try {
    localStorage.setItem('neox.global.projects.refreshAt', String(Date.now()));
  } catch {
    // no-op
  }
}

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

function deriveTelecomStatus(source: WorkItem, eligible: boolean): WorkItemStatus {
  if (!source.ticket_number || source.ticket_number <= 0) return 'needs_manual_completion';
  if (source.qaStatus !== 'approved') return 'awaiting_qa_approval';
  if (source.acceptanceStatus !== 'signed') return 'awaiting_signed_acceptance';
  return eligible ? 'finance_synced' : 'finance_pending';
}

function computeDelayMetrics(planningDate?: string, forecastDate?: string): Partial<WorkItem> {
  if (!planningDate || !forecastDate) return {};
  const plan = new Date(planningDate + 'T00:00:00Z');
  const forecast = new Date(forecastDate + 'T00:00:00Z');
  if (Number.isNaN(plan.getTime()) || Number.isNaN(forecast.getTime())) return {};
  const diffMs = forecast.getTime() - plan.getTime();
  const delay_days = Math.round(diffMs / 86400000);
  const delay_weeks = delay_days === 0 ? 0 : delay_days > 0 ? Math.ceil(delay_days / 7) : -Math.ceil(Math.abs(delay_days) / 7);
  return {
    delay_days,
    delay_weeks,
    schedule_status: (delay_days > 0 ? 'delayed' : delay_days < 0 ? 'early' : 'on_time') as WorkItem['schedule_status'],
    start_variance_days: delay_days,
    is_delayed: delay_days > 0,
  };
}

export const useProjectStore = create<ProjectStore>()(
  persist(
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

          emitGlobalProjectsRefresh();

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
            emitGlobalProjectsRefresh();

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

        updateProject: (id, updates) => {
          set((state: ProjectStore) => ({
            projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          }));
          emitGlobalProjectsRefresh();
          const active = get().projects.find((p) => p.id === id);
          if (active) {
            void notifyProjectTeam(id, {
              actionType: 'project_updated',
              message: `Project ${active.name} was updated.`,
              meta: { updates },
            }).catch(() => {});
          }
        },

        deleteProject: (id) => {
          set((state: ProjectStore) => ({
            projects: state.projects.filter((p) => p.id !== id),
            workItems: state.workItems.filter((wi) => wi.projectId !== id),
            activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          }));
          emitGlobalProjectsRefresh();
        },

        addWorkItem: (newItem) => {
          const item: WorkItem = { ...newItem, id: `wi-${Date.now()}` };
          set((state: ProjectStore) => {
            const newWorkItems = [item, ...state.workItems];
            return {
              workItems: newWorkItems,
              projects: recalcProjectKpis(state.projects, newWorkItems),
              activities: [
                {
                  id: `act-${Date.now()}`,
                  projectId: item.projectId,
                  userId: 'current-user',
                  userName: 'System',
                  action: `created item: ${item.title}`,
                  targetId: item.id,
                  targetName: item.title,
                  timestamp: new Date().toISOString(),
                  type: 'work-item',
                },
                ...state.activities,
              ],
            };
          });
          emitGlobalProjectsRefresh();
        },

        updateWorkItem: (id, updates) => {
          set((state: ProjectStore) => {
            const originalItem = state.workItems.find((wi) => wi.id === id);
            const source = { ...originalItem, ...updates } as WorkItem;

            let calculatedPatch: Partial<WorkItem> = {};
            const hasAuthoritativeBackendTelecomState =
              updates.is_financially_eligible !== undefined ||
              updates.financial_eligibility_reason !== undefined ||
              updates.po_unit_price_completed !== undefined ||
              updates.contractor_payable_amount !== undefined ||
              updates.finance_sync_status !== undefined ||
              updates.finance_sync_at !== undefined ||
              updates.finance_reference_id !== undefined ||
              updates.finance_error_message !== undefined;

            // Recompute delay metrics when forecast or planning date changes
            if (updates.forecast_date !== undefined || updates.planning_audit_date !== undefined) {
              const delayPatch = computeDelayMetrics(
                source.planning_audit_date,
                source.forecast_date,
              );
              calculatedPatch = { ...calculatedPatch, ...delayPatch };
            }
            const eligibilityTouched =
              updates.ticket_number !== undefined ||
              updates.po_unit_price !== undefined ||
              updates.qaStatus !== undefined ||
              updates.acceptanceStatus !== undefined;

            if (!hasAuthoritativeBackendTelecomState && eligibilityTouched && source.po_unit_price !== undefined) {
              const eligibility = evaluateFinancialEligibility({
                po_unit_price: source.po_unit_price,
                ticket_number: source.ticket_number,
                qaStatus: source.qaStatus,
                acceptanceStatus: source.acceptanceStatus,
              });

              const rowStatus = deriveTelecomStatus(source, eligibility.is_financially_eligible);
              const calc = calculateTelecomAmounts({
                po_unit_price: source.po_unit_price,
                ticket_number: source.ticket_number,
                qaStatus: source.qaStatus,
                acceptanceStatus: source.acceptanceStatus,
              });

              if (!eligibility.is_financially_eligible) {
                const blocked = suspendContractorPayableSync({
                  projectId: source.projectId,
                  workItemId: source.id,
                  reason: eligibility.financial_eligibility_reason || 'Awaiting operational prerequisites.',
                  currency: 'USD',
                });

                calculatedPatch = {
                  is_financially_eligible: false,
                  financial_eligibility_reason: eligibility.financial_eligibility_reason,
                  po_unit_price_completed: calc.po_unit_price_completed > 0 ? calc.po_unit_price_completed : undefined,
                  contractor_payable_amount: undefined,
                  finance_sync_status: blocked.status,
                  finance_sync_at: blocked.synced_at,
                  finance_reference_id: blocked.reference_id,
                  finance_error_message: blocked.error_message,
                  status: rowStatus,
                };
              } else {
                const finance = syncContractorPayableToFinance({
                  projectId: source.projectId,
                  workItemId: source.id,
                  amount: calc.contractor_payable_amount,
                  currency: 'USD',
                });

                calculatedPatch = {
                  is_financially_eligible: true,
                  financial_eligibility_reason: undefined,
                  po_unit_price_completed: calc.po_unit_price_completed,
                  contractor_payable_amount: calc.contractor_payable_amount,
                  finance_sync_status: finance.status,
                  finance_sync_at: finance.synced_at,
                  finance_reference_id: finance.reference_id,
                  finance_error_message: undefined,
                  status: finance.status === 'synced' ? 'finance_synced' : 'finance_pending',
                };
              }
            } else if (!hasAuthoritativeBackendTelecomState && (source.type === 'site' || source.import_batch_id)) {
              const calc = calculateTelecomAmounts({
                po_unit_price: source.po_unit_price,
                ticket_number: source.ticket_number,
              });
              calculatedPatch = {
                is_financially_eligible: calc.is_financially_eligible,
                financial_eligibility_reason: calc.financial_eligibility_reason,
                po_unit_price_completed: calc.po_unit_price_completed > 0 ? calc.po_unit_price_completed : undefined,
                contractor_payable_amount: calc.is_financially_eligible ? calc.contractor_payable_amount : undefined,
              };
            }

            const newWorkItems = state.workItems.map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...updates,
                    ...calculatedPatch,
                  }
                : item
            );

            const updatedProjects = recalcProjectKpis(state.projects, newWorkItems);

            return {
              workItems: newWorkItems,
              projects: updatedProjects,
              activities: [
                {
                  id: `act-${Date.now()}`,
                  projectId: originalItem?.projectId || '',
                  userId: 'current-user',
                  userName: 'System',
                  action:
                    updates.ticket_number !== undefined
                      ? `updated ticket number for ${originalItem?.title}`
                      : updates.qaStatus !== undefined || updates.acceptanceStatus !== undefined
                      ? `updated validation gates for ${originalItem?.title}`
                      : updates.status
                      ? `updated status to ${updates.status} for ${originalItem?.title}`
                      : `updated ${originalItem?.title}`,
                  targetId: id,
                  targetName: originalItem?.title || '',
                  timestamp: new Date().toISOString(),
                  type: updates.ticket_number !== undefined || updates.qaStatus !== undefined || updates.acceptanceStatus !== undefined ? 'finance-sync' : 'work-item',
                },
                ...state.activities,
              ],
            };
          });
          emitGlobalProjectsRefresh();
        },
        

        updateTelecomManualFields: (id, updates) => {
          get().updateWorkItem(id, {
            ...updates,
            manual_completion_status: updates.ticket_number ? 'complete' : 'pending',
            status: updates.ticket_number ? 'ready_for_calculation' : 'needs_manual_completion',
          });
        },

        retryFinanceSync: (id) => {
          const row = get().workItems.find((item) => item.id === id);
          if (!row) return;
          get().updateWorkItem(id, {
            ticket_number: row.ticket_number,
            po_unit_price: row.po_unit_price,
          });
        },

        deleteWorkItem: (id) => {
          set((state: ProjectStore) => {
            const item = state.workItems.find((wi) => wi.id === id);
            const newWorkItems = state.workItems.filter((wi) => wi.id !== id);
            return {
              workItems: newWorkItems,
              projects: recalcProjectKpis(state.projects, newWorkItems),
              activities: item
                ? [
                    {
                      id: `act-${Date.now()}`,
                      projectId: item.projectId,
                      userId: 'current-user',
                      userName: 'System',
                      action: `deleted item: ${item.title}`,
                      targetId: id,
                      targetName: item.title,
                      timestamp: new Date().toISOString(),
                      type: 'work-item',
                    },
                    ...state.activities,
                  ]
                : state.activities,
            };
          });
          emitGlobalProjectsRefresh();
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
          emitGlobalProjectsRefresh();
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
          emitGlobalProjectsRefresh();
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
    },
    {
      name: 'neox.projects.v3.telecom',
      partialize: (state: ProjectStore) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        workItems: state.workItems,
        documents: state.documents,
        imports: state.imports,
        telecomImportBatches: state.telecomImportBatches,
      }),
    }
  )
);
