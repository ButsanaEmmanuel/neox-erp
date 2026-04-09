import { Requisition } from '../../types/requisition';

const STORAGE_KEY = 'neox_requisitions_v2';

export const requisitionsStorage = {
    getRequisitions: (): Requisition[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load requisitions from localStorage', error);
            return [];
        }
    },

    saveRequisitions: (requisitions: Requisition[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(requisitions));
        } catch (error) {
            console.error('Failed to save requisitions to localStorage', error);
        }
    },

    clear: () => {
        localStorage.removeItem(STORAGE_KEY);
    }
};
