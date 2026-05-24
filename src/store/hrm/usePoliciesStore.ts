// DH1 — Extracted from useHRMStore.ts.
// Policies slice — local-only.

import { create } from 'zustand';
import type { Policy } from '../../types/hrm';

const POLICIES: Policy[] = [];

export interface PoliciesStore {
    policies: Policy[];
    acknowledgePolicy: (id: string) => void;
}

export const usePoliciesStore = create<PoliciesStore>((set) => ({
    policies: POLICIES,

    acknowledgePolicy: (id) => set((s) => ({
        policies: s.policies.map((p) => (p.id === id
            ? { ...p, acknowledged: true, acknowledgedDate: new Date().toISOString() }
            : p)),
    })),
}));
