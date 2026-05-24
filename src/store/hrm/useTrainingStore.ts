// DH1 — Extracted from useHRMStore.ts.
// Training records slice — local-only, no cross-store coupling.

import { create } from 'zustand';
import type { TrainingRecord } from '../../types/hrm';

const TRAINING_RECORDS: TrainingRecord[] = [];

export interface TrainingStore {
    trainingRecords: TrainingRecord[];
    updateTrainingStatus: (id: string, status: TrainingRecord['status']) => void;
}

export const useTrainingStore = create<TrainingStore>((set) => ({
    trainingRecords: TRAINING_RECORDS,

    updateTrainingStatus: (id, status) => set((s) => ({
        trainingRecords: s.trainingRecords.map((tr) => (tr.id === id
            ? { ...tr, status, ...(status === 'completed' ? { completedDate: new Date().toISOString() } : {}) }
            : tr)),
    })),
}));
