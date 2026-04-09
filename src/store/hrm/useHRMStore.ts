
import { create } from 'zustand';
import type {
    EmploymentProfile, Department, CreateEmploymentPayload,
    OnboardingPlan, OnboardingTask, OffboardingPlan,
    Candidate, CandidateStage, CandidateNote,
    TimesheetWeek, TimesheetActivity, LeaveRequest,
    TrainingRecord, Policy, HRCase, CaseNote,
    ActivityEntry, OnboardingTemplate, OffboardingTemplate, OffboardingTask,
} from '../../types/hrm';
import {
  bulkUpsertHrmEmployeesApi,
  createHrmDepartmentApi,
  createHrmEmployeeApi,
  deleteHrmDepartmentApi,
  deleteHrmEmployeeApi,
  fetchHrmEmployeeDetailApi,
  fetchHrmEmployeeActivityApi,
  fetchHrmBootstrapApi,
  HrmEmployeeActivity,
  markHrmEmployeeCredentialsSentApi,
  regenerateHrmEmployeeCredentialsApi,
  updateHrmDepartmentApi,
  updateHrmEmployeeApi,
} from '../../services/hrmApi';

function normalizeEmploymentForSource(profile: EmploymentProfile): EmploymentProfile {
    const source = profile.creationSource ?? 'MANUAL';
    const next = { ...profile, creationSource: source };
    if (source !== 'RECRUITMENT' && next.status === 'onboarding') {
        next.status = 'active';
    }
    return next;
}

// --- Local Fallback Data (DB-only => empty by default) -----------------

export const DEPARTMENTS: Department[] = [];

const EMPLOYEES: EmploymentProfile[] = [];

const ONBOARDING_PLANS: OnboardingPlan[] = [];

const OFFBOARDING_TEMPLATES: OffboardingTemplate[] = [
    {
        id: 'off-tmpl-standard',
        name: 'Standard Exit Workflow',
        tasksBlueprint: [
            { title: 'Revoke system & building access', ownerRole: 'it', required: true },
            { title: 'Return hardware (Laptop, Badge, Keys)', ownerRole: 'employee', required: true },
            { title: 'Process final payment & tax forms', ownerRole: 'hr', required: true },
            { title: 'Conduct Exit Interview', ownerRole: 'hr', required: false },
        ]
    }
];

const OFFBOARDING_PLANS: OffboardingPlan[] = [];

const CANDIDATES: Candidate[] = [];

const TIMESHEETS: TimesheetWeek[] = [];

const LEAVE_REQUESTS: LeaveRequest[] = [];

const TRAINING_RECORDS: TrainingRecord[] = [];

const POLICIES: Policy[] = [];

const HR_CASES: HRCase[] = [];

const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
    {
        id: 'tmpl-general',
        name: 'General Onboarding (All Modules)',
        tasksBlueprint: [
            { title: 'System Access & Email Provisioning', ownerRole: 'it', required: true, defaultDueDays: 0 },
            { title: 'Hardware Setup (Laptop, Workstation)', ownerRole: 'it', required: true, defaultDueDays: 0 },
            { title: 'Contract Signature & Document Review', ownerRole: 'hr', required: true, defaultDueDays: 0 },
            { title: 'Payroll & Bank Details Setup', ownerRole: 'hr', required: true, defaultDueDays: 1 },
            { title: 'Team Introduction & Project Assign', ownerRole: 'manager', required: true, defaultDueDays: 1 },
            { title: 'Review Company Policies & Safety', ownerRole: 'employee', required: true, defaultDueDays: 2 },
        ]
    },
    {
        id: 'tmpl-engineering',
        name: 'Engineering Onboarding',
        tasksBlueprint: [
            { title: 'GitHub & Cloud Access', ownerRole: 'it', required: true, defaultDueDays: 0 },
            { title: 'Development Environment Setup', ownerRole: 'employee', required: true, defaultDueDays: 1 },
            { title: 'Architecture Overview Session', ownerRole: 'manager', required: true, defaultDueDays: 2 },
            { title: 'Security Best Practices Training', ownerRole: 'it', required: true, defaultDueDays: 3 },
        ]
    }
];

// --- Store Interface ---------------------------------------------------

interface HRMStore {
    isLoading: boolean;
    hydrated: boolean;
    error: string | null;
    employeeActivities: Record<string, HrmEmployeeActivity[]>;
    hydrateFromDatabase: () => Promise<void>;
    loadEmployeeActivities: (employeeId: string) => Promise<void>;
    loadEmployeeDetail: (employeeId: string) => Promise<void>;
    regenerateEmployeeCredentials: (employeeId: string) => Promise<void>;
    markEmployeeCredentialsSent: (employeeId: string) => Promise<void>;
    currentRole: 'staff' | 'manager' | 'hr';
    setCurrentRole: (role: 'staff' | 'manager' | 'hr') => void;
    // Config
    activeEmployeeId: string;
    setActiveEmployeeId: (id: string) => void;

    // Core data
    departments: Department[];
    employees: EmploymentProfile[];
    onboardingPlans: OnboardingPlan[];
    onboardingTemplates: OnboardingTemplate[];
    offboardingPlans: OffboardingPlan[];
    offboardingTemplates: OffboardingTemplate[];
    candidates: Candidate[];
    timesheets: TimesheetWeek[];
    leaveRequests: LeaveRequest[];
    trainingRecords: TrainingRecord[];
    policies: Policy[];
    cases: HRCase[];

    // Navigation state for cross-view redirect
    activeOnboardingPlanId: string | null;
    setActiveOnboardingPlanId: (id: string | null) => void;
    activeOffboardingPlanId: string | null;
    setActiveOffboardingPlanId: (id: string | null) => void;

    // Config Actions
    addDepartment: (dept: Omit<Department, 'id'>) => Promise<void>;
    updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;
    deleteDepartment: (id: string) => Promise<void>;
    addOnboardingTemplate: (template: Omit<OnboardingTemplate, 'id'>) => void;
    updateOnboardingTemplate: (id: string, updates: Partial<OnboardingTemplate>) => void;
    deleteOnboardingTemplate: (id: string) => void;
    addOffboardingTemplate: (template: Omit<OffboardingTemplate, 'id'>) => void;
    updateOffboardingTemplate: (id: string, updates: Partial<OffboardingTemplate>) => void;
    deleteOffboardingTemplate: (id: string) => void;

    // Employee CRUD
    addEmployee: (payload: CreateEmploymentPayload) => Promise<void>;
    updateEmployee: (id: string, updates: Partial<EmploymentProfile>) => Promise<void>;
    bulkUpdateEmployees: (ids: string[], updates: Partial<EmploymentProfile>) => Promise<void>;
    bulkAddEmployees: (newEmployees: EmploymentProfile[]) => Promise<void>;
    bulkAddDepartments: (newDepartments: Department[]) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;

    // Onboarding
    updateOnboardingTask: (planId: string, taskId: string, status: OnboardingTask['status']) => void;
    createOnboardingPlanFromTemplate: (templateId: string, employeeId: string, employeeName: string, department: string, startDate: string) => string;

    // Offboarding
    startOffboarding: (employeeId: string, templateId: string, exitDate: string, lastWorkingDay: string, reason: string, notes?: string) => void;
    updateOffboardingTask: (planId: string, taskId: string, status: OnboardingTask['status']) => void;
    completeOffboardingPlans: (planId: string) => void;

    // Recruitment
    moveCandidateStage: (candidateId: string, stage: CandidateStage) => void;
    addCandidateNote: (candidateId: string, note: Omit<CandidateNote, 'id'>) => void;
    addCandidate: (candidate: Omit<Candidate, 'id' | 'notes'>) => void;
    hireCandidate: (candidateId: string, startDate: string, departmentId?: string, hiringManagerId?: string, templateId?: string, offerComp?: { amount: number; currency: string; period: string }) => void;
    markOnboardingPending: (candidateId: string) => void;
    rejectCandidate: (candidateId: string, reason?: string) => void;

    // Timesheets
    getOrCreateTimesheet: (employeeId: string, weekStart: string) => TimesheetWeek;
    updateTimesheetActivity: (weekId: string, activity: TimesheetActivity) => void;
    deleteTimesheetActivity: (weekId: string, activityId: string) => void;
    submitTimesheet: (id: string, total: number) => void;
    approveTimesheet: (id: string) => void;
    rejectTimesheet: (id: string, comment: string) => void;

    // Leave
    addLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'status'>) => void;
    approveLeave: (id: string) => void;
    rejectLeave: (id: string, comment: string) => void;

    // Training
    updateTrainingStatus: (id: string, status: TrainingRecord['status']) => void;

    // Policies
    acknowledgePolicy: (id: string) => void;

    // Cases
    addCase: (hrCase: Omit<HRCase, 'id' | 'notes'>) => void;
    updateCaseStatus: (id: string, status: HRCase['status']) => void;
    addCaseNote: (caseId: string, note: Omit<CaseNote, 'id'>) => void;

    // Onboarding completion lifecycle
    completeOnboarding: (planId: string, completedBy: string) => void;
}

// --- Store Implementation ----------------------------------------------

export const useHRMStore = create<HRMStore>((set, get) => ({
    setCurrentRole: (role) => set({ currentRole: role }),
    isLoading: false,
    hydrated: false,
    error: null,
    employeeActivities: {},
    hydrateFromDatabase: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
            const data = await fetchHrmBootstrapApi({ take: 200, skip: 0 });
            const employees = (data.employees || []).map((emp) => normalizeEmploymentForSource(emp));
            const departments = data.departments || [];
            if (import.meta.env.DEV && data.meta) {
                console.debug('[HRM] bootstrap timings', data.meta);
            }
            set((state) => ({
                isLoading: false,
                hydrated: true,
                departments,
                employees,
                activeEmployeeId: state.activeEmployeeId && employees.some((e) => e.id === state.activeEmployeeId)
                    ? state.activeEmployeeId
                    : (employees[0]?.id || ''),
            }));
        } catch (err) {
            const message = String((err as Error).message || 'Unknown error');
            const friendly = message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('timeout')
                ? 'Network/API unreachable. Verify API server on http://localhost:4000 and try again.'
                : message;
            set({ isLoading: false, error: friendly, hydrated: true });
        }
    },
    loadEmployeeActivities: async (employeeId: string) => {
        const payload = await fetchHrmEmployeeActivityApi(employeeId);
        set((state) => ({
            employeeActivities: {
                ...state.employeeActivities,
                [employeeId]: payload.activities || [],
            },
        }));
    },
    loadEmployeeDetail: async (employeeId: string) => {
        const payload = await fetchHrmEmployeeDetailApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? normalizeEmploymentForSource({ ...employee, ...payload.employee })
                : employee)),
        }));
    },
    regenerateEmployeeCredentials: async (employeeId: string) => {
        const payload = await regenerateHrmEmployeeCredentialsApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? { ...employee, latestCredential: payload.credential }
                : employee)),
        }));
    },
    markEmployeeCredentialsSent: async (employeeId: string) => {
        const payload = await markHrmEmployeeCredentialsSentApi(employeeId);
        set((state) => ({
            employees: state.employees.map((employee) => (employee.id === employeeId
                ? { ...employee, latestCredential: payload.credential }
                : employee)),
        }));
    },
    activeEmployeeId: '',
    setActiveEmployeeId: (id) => set({ activeEmployeeId: id }),

    currentRole: (() => {
        try {
            const sessionRaw = localStorage.getItem('neox-auth-session');
            const parsed = sessionRaw ? JSON.parse(sessionRaw) : null;
            const roleCode = String(parsed?.role || '').toUpperCase();
            if (roleCode === 'ADMIN' || roleCode === 'HR_MANAGER') return 'hr';
            if (roleCode === 'PROJECT_MANAGER' || roleCode === 'SCM_MANAGER' || roleCode === 'FINANCE' || roleCode === 'SALES') return 'manager';
            return 'staff';
        } catch {
            return 'staff';
        }
    })(),

    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    onboardingPlans: ONBOARDING_PLANS,
    onboardingTemplates: ONBOARDING_TEMPLATES,
    offboardingPlans: OFFBOARDING_PLANS,
    offboardingTemplates: OFFBOARDING_TEMPLATES,
    candidates: CANDIDATES,
    timesheets: TIMESHEETS,
    leaveRequests: LEAVE_REQUESTS,
    trainingRecords: TRAINING_RECORDS,
    policies: POLICIES,
    cases: HR_CASES,

    // Navigation state
    activeOnboardingPlanId: null,
    setActiveOnboardingPlanId: (id) => set({ activeOnboardingPlanId: id }),
    activeOffboardingPlanId: null,
    setActiveOffboardingPlanId: (id) => set({ activeOffboardingPlanId: id }),

    // --- Config ---
    addDepartment: async (dept) => {
        const created = await createHrmDepartmentApi(dept);
        set((s) => ({ departments: [...s.departments, created.department] }));
    },
    updateDepartment: async (id, updates) => {
        const updated = await updateHrmDepartmentApi(id, updates);
        set((s) => ({
            departments: s.departments.map((d) => (d.id === id ? { ...d, ...updated.department } : d)),
        }));
    },
    deleteDepartment: async (id) => {
        await deleteHrmDepartmentApi(id);
        set((s) => ({
            departments: s.departments
                .filter((d) => d.id !== id)
                .map((d) => (d.parentId === id ? { ...d, parentId: undefined } : d)),
        }));
    },
    addOnboardingTemplate: (tmpl) => set(s => ({
        onboardingTemplates: [...s.onboardingTemplates, { ...tmpl, id: `tmpl-${Date.now()}` }]
    })),
    updateOnboardingTemplate: (id, updates) => set(s => ({
        onboardingTemplates: s.onboardingTemplates.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    deleteOnboardingTemplate: (id) => set(s => ({
        onboardingTemplates: s.onboardingTemplates.filter(t => t.id !== id)
    })),
    addOffboardingTemplate: (tmpl) => set(s => ({
        offboardingTemplates: [...s.offboardingTemplates, { ...tmpl, id: `off-tmpl-${Date.now()}` }]
    })),
    updateOffboardingTemplate: (id, updates) => set(s => ({
        offboardingTemplates: s.offboardingTemplates.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    deleteOffboardingTemplate: (id) => set(s => ({
        offboardingTemplates: s.offboardingTemplates.filter(t => t.id !== id)
    })),

    // --- Employee CRUD ---
    addEmployee: async (payload) => {
        const created = await createHrmEmployeeApi({
            ...payload,
            creationSource: payload.creationSource || 'MANUAL',
        });
        set((s) => ({ employees: [normalizeEmploymentForSource(created.employee), ...s.employees] }));
    },

    updateEmployee: async (id, updates) => {
        const updated = await updateHrmEmployeeApi(id, updates);
        set((s) => ({
            employees: s.employees.map((e) => (e.id === id ? normalizeEmploymentForSource(updated.employee) : e)),
        }));
    },

    bulkUpdateEmployees: async (ids, updates) => {
        for (const id of ids) {
            const updated = await updateHrmEmployeeApi(id, updates);
            set((s) => ({
                employees: s.employees.map((e) => (e.id === id ? normalizeEmploymentForSource(updated.employee) : e)),
            }));
        }
    },

    bulkAddEmployees: async (newEmployees) => {
        const normalized = newEmployees.map((emp) => normalizeEmploymentForSource({
            ...emp,
            creationSource: emp.creationSource || 'IMPORT',
        }));
        const result = await bulkUpsertHrmEmployeesApi(normalized);
        const createdIds = new Set((result.employees || []).map((e) => e.id));
        set((s) => ({
            employees: [
                ...(result.employees || []).map((e) => normalizeEmploymentForSource(e)),
                ...s.employees.filter((e) => !createdIds.has(e.id)),
            ],
        }));
    },

    bulkAddDepartments: async (newDepartments) => {
        const created: Department[] = [];
        for (const dept of newDepartments) {
            const result = await createHrmDepartmentApi(dept);
            created.push(result.department);
        }
        set((s) => ({ departments: [...s.departments, ...created] }));
    },

    deleteEmployee: async (id) => {
        await deleteHrmEmployeeApi(id);
        set((s) => ({
            employees: s.employees.filter((e) => e.id !== id),
        }));
    },

    // --- Onboarding ---
    updateOnboardingTask: (planId, taskId, status) => set((s) => {
        const updatedPlans = s.onboardingPlans.map(plan => {
            if (plan.id !== planId) return plan;
            const tasks = plan.tasks.map(t => t.id === taskId ? { ...t, status } : t);
            const completed = tasks.filter(t => t.status === 'completed').length;
            const progress = Math.round((completed / tasks.length) * 100);
            // Auto-complete: when all REQUIRED tasks are done
            const allRequiredDone = tasks.filter(t => t.required).every(t => t.status === 'completed');
            const planStatus: 'completed' | 'in_progress' | 'not_started' = allRequiredDone && tasks.filter(t => t.required).length > 0
                ? 'completed'
                : progress > 0 ? 'in_progress' : 'not_started';
            return { ...plan, tasks, progress, status: planStatus };
        });

        // If any plan just became completed, flip the employee to active
        const completedPlan = updatedPlans.find(p => p.id === planId && p.status === 'completed');
        const originalPlan = s.onboardingPlans.find(p => p.id === planId);
        const justCompleted = completedPlan && originalPlan && originalPlan.status !== 'completed';

        return {
            onboardingPlans: updatedPlans,
            ...(justCompleted ? {
                employees: s.employees.map(e => e.id === completedPlan.employeeId
                    ? { ...e, status: 'active' as const, updatedAt: new Date().toISOString() }
                    : e
                ),
            } : {}),
        };
    }),

    createOnboardingPlanFromTemplate: (templateId, employeeId, employeeName, department, startDate) => {
        const planId = `ob-${Date.now()}`;
        const now = new Date().toISOString();
        const startMs = new Date(startDate).getTime();

        // Use getState to read templates
        const template = get().onboardingTemplates.find((t: OnboardingTemplate) => t.id === templateId);
        const blueprints = template?.tasksBlueprint ?? [];

        const tasks: OnboardingTask[] = blueprints.map((bp, i) => {
            const dueDateMs = startMs + (bp.defaultDueDays ?? 0) * 86400000;
            return {
                id: `t-${Date.now()}-${i}`,
                title: bp.title,
                owner: bp.ownerRole,
                status: 'pending' as const,
                dueDate: new Date(dueDateMs).toISOString().split('T')[0],
                required: bp.required,
            };
        });

        const maxDueDays = Math.max(...blueprints.map(b => b.defaultDueDays ?? 0), 30);
        const targetDate = new Date(startMs + maxDueDays * 86400000).toISOString().split('T')[0];

        const newPlan: OnboardingPlan = {
            id: planId,
            employeeId,
            employeeName,
            templateId,
            status: 'not_started',
            progress: 0,
            startDate,
            targetDate,
            department,
            tasks,
            activityLog: [
                { id: `al-${Date.now()}`, who: 'HR', action: `Onboarding plan created from template "${template?.name ?? 'Unknown'}"`, timestamp: now, entityId: planId },
            ],
        };

        set((s: HRMStore) => ({
            onboardingPlans: [...s.onboardingPlans, newPlan],
            activeOnboardingPlanId: planId,
        }));

        return planId;
    },

    // --- Offboarding ---
    startOffboarding: (employeeId, templateId, exitDate, lastWorkingDay, reason, notes) => set(s => {
        const employee = s.employees.find(e => e.id === employeeId);
        if (!employee) return {};
        const template = s.offboardingTemplates.find(t => t.id === templateId);
        const tasks: OffboardingTask[] = (template?.tasksBlueprint ?? []).map((bp, i) => ({
            id: `t-off-${Date.now()}-${i}`,
            title: bp.title,
            owner: bp.ownerRole,
            status: 'pending',
            required: bp.required,
        }));

        const planId = `off-${Date.now()}`;
        const newPlan: OffboardingPlan = {
            id: planId,
            employeeId,
            employeeName: employee.name || 'Unknown',
            department: s.departments.find(d => d.id === employee.departmentId)?.name || 'Unknown',
            exitDate,
            lastWorkingDay,
            // @ts-ignore
            reason,
            templateId,
            status: 'in_progress',
            progress: 0,
            tasks,
            notes,
        };

        return {
            offboardingPlans: [...s.offboardingPlans, newPlan],
            // Update employee status
            employees: s.employees.map(e => e.id === employeeId ? { ...e, status: 'offboarding' as const, endDate: exitDate, updatedAt: new Date().toISOString() } : e),
            activeOffboardingPlanId: planId,
        };
    }),

    updateOffboardingTask: (planId, taskId, status) => set(s => {
        const updatedPlans = s.offboardingPlans.map(plan => {
            if (plan.id !== planId) return plan;
            const tasks = plan.tasks.map(t => t.id === taskId ? { ...t, status } : t);
            const completed = tasks.filter(t => t.status === 'completed').length;
            const progress = Math.round((completed / tasks.length) * 100);
            return { ...plan, tasks, progress };
        });
        return { offboardingPlans: updatedPlans };
    }),

    completeOffboardingPlans: (planId) => set(s => {
        const plan = s.offboardingPlans.find(p => p.id === planId);
        if (!plan) return {};
        return {
            offboardingPlans: s.offboardingPlans.map(p => p.id === planId ? { ...p, status: 'completed' as const } : p),
            employees: s.employees.map(e => e.id === plan.employeeId ? { ...e, status: 'inactive' as const, updatedAt: new Date().toISOString() } : e),
        };
    }),

    // --- Recruitment ---
    moveCandidateStage: (candidateId, stage) => set((s) => ({
        candidates: s.candidates.map(c => c.id === candidateId ? { ...c, stage } : c),
    })),

    addCandidateNote: (candidateId, note) => set((s) => ({
        candidates: s.candidates.map(c => c.id === candidateId
            ? { ...c, notes: [...c.notes, { ...note, id: `cn-${Date.now()}` }] }
            : c
        ),
    })),

    addCandidate: (candidate) => set((s) => ({
        candidates: [...s.candidates, { ...candidate, id: `cand-${Date.now()}`, notes: [] }],
    })),

    hireCandidate: (candidateId, startDate, departmentId, hiringManagerId, templateId, offerComp) => set((s) => {
        const candidate = s.candidates.find(c => c.id === candidateId);
        if (!candidate) return {};
        const empId = `emp-${Date.now()}`;
        const now = new Date().toISOString();
        const deptName = departmentId ? (s.departments.find(d => d.id === departmentId)?.name || 'Unknown') : 'Unknown';

        // Pick template: explicit > department-matched > general
        const effectiveTemplateId = templateId
            || s.onboardingTemplates.find(t => t.departmentId === departmentId)?.id
            || 'tmpl-general';
        const template = s.onboardingTemplates.find(t => t.id === effectiveTemplateId);
        const blueprints = template?.tasksBlueprint ?? [];

        const startMs = new Date(startDate).getTime();
        const tasks: OnboardingTask[] = blueprints.map((bp, i) => {
            const dueDateMs = startMs + (bp.defaultDueDays ?? 0) * 86400000;
            return {
                id: `t-${Date.now()}-${i}`,
                title: bp.title,
                owner: bp.ownerRole,
                status: 'pending' as const,
                dueDate: new Date(dueDateMs).toISOString().split('T')[0],
                required: bp.required,
            };
        });

        const maxDueDays = Math.max(...blueprints.map(b => b.defaultDueDays ?? 0), 30);
        const targetDate = new Date(startMs + maxDueDays * 86400000).toISOString().split('T')[0];
        const planId = `ob-${Date.now()}`;

        // Compensation conversion (offer comp -> employee comp format)
        const compensation = offerComp && offerComp.amount > 0
            ? { currency: offerComp.currency, amount: offerComp.amount, frequency: offerComp.period as 'annual' | 'monthly' | 'hourly' }
            : undefined;

        const newEmployee: EmploymentProfile = {
            id: empId,
            personId: `p-hired-${Date.now()}`,
            employeeCode: `EMP-${Date.now().toString().slice(-4)}`,
            employmentType: 'employee',
            status: 'onboarding',
            creationSource: 'RECRUITMENT',
            departmentId,
            roleTitle: candidate.position,
            managerPersonId: hiringManagerId,
            startDate,
            workLocation: 'TBD',
            compensation,
            createdAt: now,
            updatedAt: now,
            // Embedded person fields from candidate
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
            avatarColor: 'from-emerald-500/30 to-blue-500/20',
            authorityLevel: 'CONTRIBUTOR',
        };

        const newPlan: OnboardingPlan = {
            id: planId,
            employeeId: empId,
            employeeName: candidate.name,
            templateId: effectiveTemplateId,
            status: 'not_started',
            progress: 0,
            startDate,
            targetDate,
            department: deptName,
            tasks,
            activityLog: [
                { id: `al-${Date.now()}`, who: 'HR', action: `Hired from ATS - onboarding started with "${template?.name ?? 'Default'}" template`, timestamp: now, entityId: planId },
            ],
        };

        return {
            candidates: s.candidates.map(c => c.id === candidateId
                ? { ...c, stage: 'hired' as CandidateStage, onboardingPending: false, linkedEmployeeId: empId }
                : c
            ),
            employees: [...s.employees, newEmployee],
            onboardingPlans: [...s.onboardingPlans, newPlan],
            activeOnboardingPlanId: planId,
        };
    }),

    markOnboardingPending: (candidateId) => set((s) => ({
        candidates: s.candidates.map(c => c.id === candidateId
            ? { ...c, stage: 'hired' as CandidateStage, onboardingPending: true }
            : c
        ),
    })),

    rejectCandidate: (candidateId, reason) => set((s) => ({
        candidates: s.candidates.map(c => c.id === candidateId
            ? {
                ...c, stage: 'rejected' as CandidateStage, rejectionReason: reason,
                notes: reason ? [...c.notes, { id: `cn-rej-${Date.now()}`, author: 'System', date: new Date().toISOString(), text: `Rejected: ${reason}` }] : c.notes
            }
            : c
        ),
    })),

    // --- Timesheets ---
    getOrCreateTimesheet: (employeeId: string, weekStart: string): TimesheetWeek => {
        const existing = get().timesheets.find((ts) => ts.employeeId === employeeId && ts.weekStart === weekStart);
        if (existing) return existing;

        const employee = get().employees.find((e) => e.id === employeeId);
        const newTs: TimesheetWeek = {
            id: `ts-${Date.now()}`,
            employeeId,
            employeeName: employee?.name || 'Unknown',
            weekStart,
            status: 'draft',
            activities: [],
            total: 0
        };

        set((s) => ({ timesheets: [...s.timesheets, newTs] }));
        return newTs;
    },

    updateTimesheetActivity: (weekId, activity) => set(s => ({
        timesheets: s.timesheets.map(ts => {
            if (ts.id !== weekId) return ts;
            const existingActivityIndex = ts.activities.findIndex(a => a.id === activity.id);
            let newActivities = [...ts.activities];

            if (existingActivityIndex >= 0) {
                newActivities[existingActivityIndex] = activity;
            } else {
                newActivities.push(activity);
            }

            const total = newActivities.reduce((sum, act) => sum + Object.values(act.hours).reduce((dSum, h) => dSum + h, 0), 0);
            return { ...ts, activities: newActivities, total };
        })
    })),

    deleteTimesheetActivity: (weekId, activityId) => set(s => ({
        timesheets: s.timesheets.map(ts => {
            if (ts.id !== weekId) return ts;
            const newActivities = ts.activities.filter(a => a.id !== activityId);
            const total = newActivities.reduce((sum, act) => sum + Object.values(act.hours).reduce((dSum, h) => dSum + h, 0), 0);
            return { ...ts, activities: newActivities, total };
        })
    })),

    submitTimesheet: (id, total) => set((s) => ({
        timesheets: s.timesheets.map(ts => ts.id === id ? { ...ts, status: 'submitted', total, submittedAt: new Date().toISOString() } : ts),
    })),

    approveTimesheet: (id) => set((s) => ({
        timesheets: s.timesheets.map(ts => ts.id === id ? { ...ts, status: 'approved', approvedAt: new Date().toISOString() } : ts),
    })),

    rejectTimesheet: (id, comment) => set((s) => ({
        timesheets: s.timesheets.map(ts => ts.id === id ? { ...ts, status: 'rejected', reviewerComment: comment, rejectedAt: new Date().toISOString() } : ts),
    })),

    // --- Leave ---
    addLeaveRequest: (request) => set((s) => ({
        leaveRequests: [...s.leaveRequests, { ...request, id: `lv-${Date.now()}`, status: 'pending' as const }],
    })),

    approveLeave: (id) => set((s) => ({
        leaveRequests: s.leaveRequests.map(lr => lr.id === id ? { ...lr, status: 'approved' } : lr),
    })),

    rejectLeave: (id, comment) => set((s) => ({
        leaveRequests: s.leaveRequests.map(lr => lr.id === id ? { ...lr, status: 'rejected', reviewerComment: comment } : lr),
    })),

    // --- Training ---
    updateTrainingStatus: (id, status) => set((s) => ({
        trainingRecords: s.trainingRecords.map(tr => tr.id === id
            ? { ...tr, status, ...(status === 'completed' ? { completedDate: new Date().toISOString() } : {}) }
            : tr
        ),
    })),

    // --- Policies ---
    acknowledgePolicy: (id) => set((s) => ({
        policies: s.policies.map(p => p.id === id ? { ...p, acknowledged: true, acknowledgedDate: new Date().toISOString() } : p),
    })),

    // --- Cases ---
    addCase: (hrCase) => set((s) => ({
        cases: [...s.cases, { ...hrCase, id: `case-${Date.now()}`, notes: [] }],
    })),

    updateCaseStatus: (id, status) => set((s) => ({
        cases: s.cases.map(c => c.id === id
            ? { ...c, status, ...(status === 'resolved' ? { resolvedDate: new Date().toISOString() } : {}) }
            : c
        ),
    })),

    addCaseNote: (caseId, note) => set((s) => ({
        cases: s.cases.map(c => c.id === caseId
            ? { ...c, notes: [...c.notes, { ...note, id: `casn-${Date.now()}` }] }
            : c
        ),
    })),

    // --- Onboarding Completion Lifecycle ---
    completeOnboarding: (planId, completedBy) => set((s) => {
        const plan = s.onboardingPlans.find(p => p.id === planId);
        if (!plan) return {};
        const now = new Date().toISOString();
        const activityEntry: ActivityEntry = {
            id: `al-${Date.now()}`,
            who: completedBy,
            action: 'Onboarding completed - employee is now Active',
            timestamp: now,
            entityId: planId,
        };
        return {
            onboardingPlans: s.onboardingPlans.map(p => p.id === planId
                ? { ...p, status: 'completed' as const, activityLog: [...p.activityLog, activityEntry] }
                : p
            ),
            employees: s.employees.map(e => e.id === plan.employeeId
                ? { ...e, status: 'active' as const, updatedAt: now }
                : e
            ),
        };
    }),
}));
