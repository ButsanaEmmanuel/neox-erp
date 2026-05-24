// DH1 — Extracted from useHRMStore.ts.
// Leave requests slice — pure local state, no cross-store coupling, no
// API calls (the leave module's API surface is consumed elsewhere via
// leaveApi.service; this store only holds the cached UI list seeded by
// the bootstrap and mutated optimistically).

import { create } from 'zustand';
import type { LeaveRequest } from '../../types/hrm';

const LEAVE_REQUESTS: LeaveRequest[] = [];

export interface LeaveStore {
    leaveRequests: LeaveRequest[];
    addLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'status'>) => void;
    approveLeave: (id: string) => void;
    rejectLeave: (id: string, comment: string) => void;
}

export const useLeaveStore = create<LeaveStore>((set) => ({
    leaveRequests: LEAVE_REQUESTS,

    addLeaveRequest: (request) => set((s) => ({
        leaveRequests: [...s.leaveRequests, { ...request, id: `lv-${Date.now()}`, status: 'pending' as const }],
    })),

    approveLeave: (id) => set((s) => ({
        leaveRequests: s.leaveRequests.map((lr) => (lr.id === id ? { ...lr, status: 'approved' } : lr)),
    })),

    rejectLeave: (id, comment) => set((s) => ({
        leaveRequests: s.leaveRequests.map((lr) => (lr.id === id ? { ...lr, status: 'rejected', reviewerComment: comment } : lr)),
    })),
}));
