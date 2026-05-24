// DH1 — Extracted from useHRMStore.ts.
// HR cases slice — local-only.

import { create } from 'zustand';
import type { HRCase, CaseNote } from '../../types/hrm';

const HR_CASES: HRCase[] = [];

export interface CasesStore {
    cases: HRCase[];
    addCase: (hrCase: Omit<HRCase, 'id' | 'notes'>) => void;
    updateCaseStatus: (id: string, status: HRCase['status']) => void;
    addCaseNote: (caseId: string, note: Omit<CaseNote, 'id'>) => void;
}

export const useCasesStore = create<CasesStore>((set) => ({
    cases: HR_CASES,

    addCase: (hrCase) => set((s) => ({
        cases: [...s.cases, { ...hrCase, id: `case-${Date.now()}`, notes: [] }],
    })),

    updateCaseStatus: (id, status) => set((s) => ({
        cases: s.cases.map((c) => (c.id === id
            ? { ...c, status, ...(status === 'resolved' ? { resolvedDate: new Date().toISOString() } : {}) }
            : c)),
    })),

    addCaseNote: (caseId, note) => set((s) => ({
        cases: s.cases.map((c) => (c.id === caseId
            ? { ...c, notes: [...c.notes, { ...note, id: `casn-${Date.now()}` }] }
            : c)),
    })),
}));
