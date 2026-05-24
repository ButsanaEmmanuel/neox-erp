// DH1 — Extracted from useHRMStore.ts.
// Recruitment slice. `hireCandidate` is the single cross-store action:
// it creates an EmploymentProfile (addEmployeeLocal in useDirectoryStore)
// AND a matching OnboardingPlan (addOnboardingPlanFromHire in
// useOnboardingStore). Everything else stays local to this slice.

import { create } from 'zustand';
import type {
    Candidate, CandidateStage, CandidateNote,
    EmploymentProfile, OnboardingPlan, OnboardingTask,
} from '../../types/hrm';
import { useDirectoryStore } from './useDirectoryStore';
import { useOnboardingStore } from './useOnboardingStore';

const CANDIDATES: Candidate[] = [];

export interface RecruitmentStore {
    candidates: Candidate[];
    moveCandidateStage: (candidateId: string, stage: CandidateStage) => void;
    addCandidateNote: (candidateId: string, note: Omit<CandidateNote, 'id'>) => void;
    addCandidate: (candidate: Omit<Candidate, 'id' | 'notes'>) => void;
    hireCandidate: (
        candidateId: string,
        startDate: string,
        departmentId?: string,
        hiringManagerId?: string,
        templateId?: string,
        offerComp?: { amount: number; currency: string; period: string },
    ) => void;
    markOnboardingPending: (candidateId: string) => void;
    rejectCandidate: (candidateId: string, reason?: string) => void;
}

export const useRecruitmentStore = create<RecruitmentStore>((set, get) => ({
    candidates: CANDIDATES,

    moveCandidateStage: (candidateId, stage) => set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidateId ? { ...c, stage } : c)),
    })),

    addCandidateNote: (candidateId, note) => set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidateId
            ? { ...c, notes: [...c.notes, { ...note, id: `cn-${Date.now()}` }] }
            : c)),
    })),

    addCandidate: (candidate) => set((s) => ({
        candidates: [...s.candidates, { ...candidate, id: `cand-${Date.now()}`, notes: [] }],
    })),

    hireCandidate: (candidateId, startDate, departmentId, hiringManagerId, templateId, offerComp) => {
        const candidate = get().candidates.find((c) => c.id === candidateId);
        if (!candidate) return;

        const directoryState = useDirectoryStore.getState();
        const onboardingState = useOnboardingStore.getState();

        const empId = `emp-${Date.now()}`;
        const now = new Date().toISOString();
        const deptName = departmentId
            ? (directoryState.departments.find((d) => d.id === departmentId)?.name || 'Unknown')
            : 'Unknown';

        // Pick template: explicit > department-matched > general
        const effectiveTemplateId = templateId
            || onboardingState.onboardingTemplates.find((t) => t.departmentId === departmentId)?.id
            || 'tmpl-general';
        const template = onboardingState.onboardingTemplates.find((t) => t.id === effectiveTemplateId);
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

        const maxDueDays = Math.max(...blueprints.map((b) => b.defaultDueDays ?? 0), 30);
        const targetDate = new Date(startMs + maxDueDays * 86400000).toISOString().split('T')[0];
        const planId = `ob-${Date.now()}`;

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

        // Apply across 3 stores: candidates (local), employees (directory), onboardingPlans (onboarding).
        set((s) => ({
            candidates: s.candidates.map((c) => (c.id === candidateId
                ? { ...c, stage: 'hired' as CandidateStage, onboardingPending: false, linkedEmployeeId: empId }
                : c)),
        }));
        directoryState.addEmployeeLocal(newEmployee);
        onboardingState.addOnboardingPlanFromHire(newPlan);
    },

    markOnboardingPending: (candidateId) => set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidateId
            ? { ...c, stage: 'hired' as CandidateStage, onboardingPending: true }
            : c)),
    })),

    rejectCandidate: (candidateId, reason) => set((s) => ({
        candidates: s.candidates.map((c) => (c.id === candidateId
            ? {
                ...c,
                stage: 'rejected' as CandidateStage,
                rejectionReason: reason,
                notes: reason
                    ? [...c.notes, { id: `cn-rej-${Date.now()}`, author: 'System', date: new Date().toISOString(), text: `Rejected: ${reason}` }]
                    : c.notes,
            }
            : c)),
    })),
}));
