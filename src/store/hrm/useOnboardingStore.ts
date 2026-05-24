// DH1 — Extracted from useHRMStore.ts.
// Employee lifecycle slice: onboarding + offboarding (templates, plans,
// tasks). Folded together because they share the same shape and the same
// cross-mutation pattern (lifecycle completion flips the employee status
// in useDirectoryStore via patchEmployeeLocal).

import { create } from 'zustand';
import type {
    OnboardingPlan, OnboardingTask, OnboardingTemplate,
    OffboardingPlan, OffboardingTask, OffboardingTemplate,
    ActivityEntry,
} from '../../types/hrm';
import { useDirectoryStore } from './useDirectoryStore';

const ONBOARDING_PLANS: OnboardingPlan[] = [];
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
        ],
    },
    {
        id: 'tmpl-engineering',
        name: 'Engineering Onboarding',
        tasksBlueprint: [
            { title: 'GitHub & Cloud Access', ownerRole: 'it', required: true, defaultDueDays: 0 },
            { title: 'Development Environment Setup', ownerRole: 'employee', required: true, defaultDueDays: 1 },
            { title: 'Architecture Overview Session', ownerRole: 'manager', required: true, defaultDueDays: 2 },
            { title: 'Security Best Practices Training', ownerRole: 'it', required: true, defaultDueDays: 3 },
        ],
    },
];
const OFFBOARDING_PLANS: OffboardingPlan[] = [];
const OFFBOARDING_TEMPLATES: OffboardingTemplate[] = [
    {
        id: 'off-tmpl-standard',
        name: 'Standard Exit Workflow',
        tasksBlueprint: [
            { title: 'Revoke system & building access', ownerRole: 'it', required: true },
            { title: 'Return hardware (Laptop, Badge, Keys)', ownerRole: 'employee', required: true },
            { title: 'Process final payment & tax forms', ownerRole: 'hr', required: true },
            { title: 'Conduct Exit Interview', ownerRole: 'hr', required: false },
        ],
    },
];

export interface OnboardingStore {
    // --- State ---
    onboardingPlans: OnboardingPlan[];
    onboardingTemplates: OnboardingTemplate[];
    activeOnboardingPlanId: string | null;
    offboardingPlans: OffboardingPlan[];
    offboardingTemplates: OffboardingTemplate[];
    activeOffboardingPlanId: string | null;

    // --- Navigation ---
    setActiveOnboardingPlanId: (id: string | null) => void;
    setActiveOffboardingPlanId: (id: string | null) => void;

    // --- Template CRUD ---
    addOnboardingTemplate: (template: Omit<OnboardingTemplate, 'id'>) => void;
    updateOnboardingTemplate: (id: string, updates: Partial<OnboardingTemplate>) => void;
    deleteOnboardingTemplate: (id: string) => void;
    addOffboardingTemplate: (template: Omit<OffboardingTemplate, 'id'>) => void;
    updateOffboardingTemplate: (id: string, updates: Partial<OffboardingTemplate>) => void;
    deleteOffboardingTemplate: (id: string) => void;

    // --- Onboarding lifecycle ---
    updateOnboardingTask: (planId: string, taskId: string, status: OnboardingTask['status']) => void;
    createOnboardingPlanFromTemplate: (templateId: string, employeeId: string, employeeName: string, department: string, startDate: string) => string;
    completeOnboarding: (planId: string, completedBy: string) => void;

    // --- Offboarding lifecycle ---
    startOffboarding: (employeeId: string, templateId: string, exitDate: string, lastWorkingDay: string, reason: string, notes?: string) => void;
    updateOffboardingTask: (planId: string, taskId: string, status: OnboardingTask['status']) => void;
    completeOffboardingPlans: (planId: string) => void;

    // --- Internal cross-store mutator (used by useRecruitmentStore.hireCandidate) ---
    addOnboardingPlanFromHire: (plan: OnboardingPlan) => void;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
    // --- State ---
    onboardingPlans: ONBOARDING_PLANS,
    onboardingTemplates: ONBOARDING_TEMPLATES,
    activeOnboardingPlanId: null,
    offboardingPlans: OFFBOARDING_PLANS,
    offboardingTemplates: OFFBOARDING_TEMPLATES,
    activeOffboardingPlanId: null,

    // --- Navigation ---
    setActiveOnboardingPlanId: (id) => set({ activeOnboardingPlanId: id }),
    setActiveOffboardingPlanId: (id) => set({ activeOffboardingPlanId: id }),

    // --- Template CRUD ---
    addOnboardingTemplate: (tmpl) => set((s) => ({
        onboardingTemplates: [...s.onboardingTemplates, { ...tmpl, id: `tmpl-${Date.now()}` }],
    })),
    updateOnboardingTemplate: (id, updates) => set((s) => ({
        onboardingTemplates: s.onboardingTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
    deleteOnboardingTemplate: (id) => set((s) => ({
        onboardingTemplates: s.onboardingTemplates.filter((t) => t.id !== id),
    })),
    addOffboardingTemplate: (tmpl) => set((s) => ({
        offboardingTemplates: [...s.offboardingTemplates, { ...tmpl, id: `off-tmpl-${Date.now()}` }],
    })),
    updateOffboardingTemplate: (id, updates) => set((s) => ({
        offboardingTemplates: s.offboardingTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
    deleteOffboardingTemplate: (id) => set((s) => ({
        offboardingTemplates: s.offboardingTemplates.filter((t) => t.id !== id),
    })),

    // --- Onboarding lifecycle ---
    updateOnboardingTask: (planId, taskId, status) => {
        let employeeToActivate: string | null = null;
        set((s) => {
            const updatedPlans = s.onboardingPlans.map((plan) => {
                if (plan.id !== planId) return plan;
                const tasks = plan.tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
                const completed = tasks.filter((t) => t.status === 'completed').length;
                const progress = Math.round((completed / tasks.length) * 100);
                const allRequiredDone = tasks.filter((t) => t.required).every((t) => t.status === 'completed');
                const planStatus: 'completed' | 'in_progress' | 'not_started' = allRequiredDone && tasks.filter((t) => t.required).length > 0
                    ? 'completed'
                    : progress > 0 ? 'in_progress' : 'not_started';
                return { ...plan, tasks, progress, status: planStatus };
            });

            const completedPlan = updatedPlans.find((p) => p.id === planId && p.status === 'completed');
            const originalPlan = s.onboardingPlans.find((p) => p.id === planId);
            const justCompleted = completedPlan && originalPlan && originalPlan.status !== 'completed';
            if (justCompleted) employeeToActivate = completedPlan!.employeeId;

            return { onboardingPlans: updatedPlans };
        });

        if (employeeToActivate) {
            useDirectoryStore.getState().patchEmployeeLocal(employeeToActivate, { status: 'active' });
        }
    },

    createOnboardingPlanFromTemplate: (templateId, employeeId, employeeName, department, startDate) => {
        const planId = `ob-${Date.now()}`;
        const now = new Date().toISOString();
        const startMs = new Date(startDate).getTime();

        const template = get().onboardingTemplates.find((t) => t.id === templateId);
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

        const maxDueDays = Math.max(...blueprints.map((b) => b.defaultDueDays ?? 0), 30);
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

        set((s) => ({
            onboardingPlans: [...s.onboardingPlans, newPlan],
            activeOnboardingPlanId: planId,
        }));

        return planId;
    },

    completeOnboarding: (planId, completedBy) => {
        const plan = get().onboardingPlans.find((p) => p.id === planId);
        if (!plan) return;
        const now = new Date().toISOString();
        const activityEntry: ActivityEntry = {
            id: `al-${Date.now()}`,
            who: completedBy,
            action: 'Onboarding completed - employee is now Active',
            timestamp: now,
            entityId: planId,
        };
        set((s) => ({
            onboardingPlans: s.onboardingPlans.map((p) => (p.id === planId
                ? { ...p, status: 'completed' as const, activityLog: [...p.activityLog, activityEntry] }
                : p)),
        }));
        useDirectoryStore.getState().patchEmployeeLocal(plan.employeeId, { status: 'active' });
    },

    // --- Offboarding lifecycle ---
    startOffboarding: (employeeId, templateId, exitDate, lastWorkingDay, reason, notes) => {
        const directoryState = useDirectoryStore.getState();
        const employee = directoryState.employees.find((e) => e.id === employeeId);
        if (!employee) return;
        const template = get().offboardingTemplates.find((t) => t.id === templateId);
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
            department: directoryState.departments.find((d) => d.id === employee.departmentId)?.name || 'Unknown',
            exitDate,
            lastWorkingDay,
            // @ts-ignore — `reason` type missing from OffboardingPlan; preserved from useHRMStore
            reason,
            templateId,
            status: 'in_progress',
            progress: 0,
            tasks,
            notes,
        };

        set((s) => ({
            offboardingPlans: [...s.offboardingPlans, newPlan],
            activeOffboardingPlanId: planId,
        }));
        directoryState.patchEmployeeLocal(employeeId, { status: 'offboarding' as const, endDate: exitDate });
    },

    updateOffboardingTask: (planId, taskId, status) => set((s) => {
        const updatedPlans = s.offboardingPlans.map((plan) => {
            if (plan.id !== planId) return plan;
            const tasks = plan.tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
            const completed = tasks.filter((t) => t.status === 'completed').length;
            const progress = Math.round((completed / tasks.length) * 100);
            return { ...plan, tasks, progress };
        });
        return { offboardingPlans: updatedPlans };
    }),

    completeOffboardingPlans: (planId) => {
        const plan = get().offboardingPlans.find((p) => p.id === planId);
        if (!plan) return;
        set((s) => ({
            offboardingPlans: s.offboardingPlans.map((p) => (p.id === planId ? { ...p, status: 'completed' as const } : p)),
        }));
        useDirectoryStore.getState().patchEmployeeLocal(plan.employeeId, { status: 'inactive' });
    },

    // --- Cross-store helper for useRecruitmentStore.hireCandidate ---
    addOnboardingPlanFromHire: (plan) => set((s) => ({
        onboardingPlans: [...s.onboardingPlans, plan],
        activeOnboardingPlanId: plan.id,
    })),
}));
