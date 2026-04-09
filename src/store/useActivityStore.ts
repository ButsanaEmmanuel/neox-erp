import { create } from 'zustand';
import { Activity, CreateActivityPayload } from '../types/activity';
import { v4 as uuidv4 } from 'uuid';

interface ActivityState {
    activities: Activity[];
    isLoading: boolean;

    // Actions
    logActivity: (payload: CreateActivityPayload) => void;
    getActivitiesByDeal: (dealId: string) => Activity[];
    getActivitiesByPerson: (personId: string) => Activity[];
}

const INITIAL_ACTIVITIES: Activity[] = [];

export const useActivityStore = create<ActivityState>((set, get) => ({
    activities: INITIAL_ACTIVITIES,
    isLoading: false,

    logActivity: (payload) => {
        const newActivity: Activity = {
            id: uuidv4(),
            ...payload,
            timestamp: payload.timestamp || new Date().toISOString(),
            actorId: 'user-1', // Default to current user
            createdAt: new Date().toISOString()
        };

        set((state) => ({
            activities: [newActivity, ...state.activities]
        }));
    },

    getActivitiesByDeal: (dealId) => {
        return get().activities.filter((a) => a.dealId === dealId);
    },

    getActivitiesByPerson: (personId) => {
        return get().activities.filter((a) => a.personId === personId);
    }
}));
