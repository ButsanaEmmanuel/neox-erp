// DH1 — Extracted from useHRMStore.ts.
// Timesheets slice — local state with a single cross-store read
// (getOrCreateTimesheet looks up employee.name in useDirectoryStore).

import { create } from 'zustand';
import type { TimesheetWeek, TimesheetActivity } from '../../types/hrm';
import { useDirectoryStore } from './useDirectoryStore';

const TIMESHEETS: TimesheetWeek[] = [];

export interface TimesheetsStore {
    timesheets: TimesheetWeek[];
    getOrCreateTimesheet: (employeeId: string, weekStart: string) => TimesheetWeek;
    updateTimesheetActivity: (weekId: string, activity: TimesheetActivity) => void;
    deleteTimesheetActivity: (weekId: string, activityId: string) => void;
    submitTimesheet: (id: string, total: number) => void;
    approveTimesheet: (id: string) => void;
    rejectTimesheet: (id: string, comment: string) => void;
}

export const useTimesheetsStore = create<TimesheetsStore>((set, get) => ({
    timesheets: TIMESHEETS,

    getOrCreateTimesheet: (employeeId, weekStart) => {
        const existing = get().timesheets.find((ts) => ts.employeeId === employeeId && ts.weekStart === weekStart);
        if (existing) return existing;

        const employee = useDirectoryStore.getState().employees.find((e) => e.id === employeeId);
        const newTs: TimesheetWeek = {
            id: `ts-${Date.now()}`,
            employeeId,
            employeeName: employee?.name || 'Unknown',
            weekStart,
            status: 'draft',
            activities: [],
            total: 0,
        };

        set((s) => ({ timesheets: [...s.timesheets, newTs] }));
        return newTs;
    },

    updateTimesheetActivity: (weekId, activity) => set((s) => ({
        timesheets: s.timesheets.map((ts) => {
            if (ts.id !== weekId) return ts;
            const existingActivityIndex = ts.activities.findIndex((a) => a.id === activity.id);
            const newActivities = [...ts.activities];
            if (existingActivityIndex >= 0) newActivities[existingActivityIndex] = activity;
            else newActivities.push(activity);
            const total = newActivities.reduce((sum, act) => sum + Object.values(act.hours).reduce((dSum, h) => dSum + h, 0), 0);
            return { ...ts, activities: newActivities, total };
        }),
    })),

    deleteTimesheetActivity: (weekId, activityId) => set((s) => ({
        timesheets: s.timesheets.map((ts) => {
            if (ts.id !== weekId) return ts;
            const newActivities = ts.activities.filter((a) => a.id !== activityId);
            const total = newActivities.reduce((sum, act) => sum + Object.values(act.hours).reduce((dSum, h) => dSum + h, 0), 0);
            return { ...ts, activities: newActivities, total };
        }),
    })),

    submitTimesheet: (id, total) => set((s) => ({
        timesheets: s.timesheets.map((ts) => (ts.id === id
            ? { ...ts, status: 'submitted', total, submittedAt: new Date().toISOString() }
            : ts)),
    })),

    approveTimesheet: (id) => set((s) => ({
        timesheets: s.timesheets.map((ts) => (ts.id === id
            ? { ...ts, status: 'approved', approvedAt: new Date().toISOString() }
            : ts)),
    })),

    rejectTimesheet: (id, comment) => set((s) => ({
        timesheets: s.timesheets.map((ts) => (ts.id === id
            ? { ...ts, status: 'rejected', reviewerComment: comment, rejectedAt: new Date().toISOString() }
            : ts)),
    })),
}));
