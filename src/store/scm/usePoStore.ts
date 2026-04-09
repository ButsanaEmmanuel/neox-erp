import { create } from 'zustand';
import { PurchaseOrder, POStatus, CreatePODTO, UpdatePODTO } from '../../types/po';
import { poService } from '../../services/purchaseOrder.service';
import { receivingService } from '../../services/receiving.service';
import { syncPoFinanceCommitment } from '../../services/scmFinanceIntegration.service';

interface PoState {
    purchaseOrders: PurchaseOrder[];
    selectedPoId: string | null; // Added
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchPOs: () => void;
    setSelectedPoId: (id: string | null) => void; // Added
    createPO: (dto: CreatePODTO) => Promise<string>;
    updatePO: (id: string, updates: UpdatePODTO) => Promise<void>;
    submitPO: (id: string) => Promise<void>;
    approvePO: (id: string) => Promise<void>;
    rejectPO: (id: string, reason: string) => Promise<void>;
    sendPO: (id: string) => Promise<void>;
    acknowledgePO: (id: string) => Promise<void>;
    closePO: (id: string) => Promise<void>;

    // Receiving
    createGRN: (poId: string, items: { poLineId: string, qty: number, locationId: string }[]) => Promise<{ grnNumber: string }>;
}

export const usePoStore = create<PoState>((set, get) => ({
    purchaseOrders: [],
    selectedPoId: null, // Init
    isLoading: false,
    error: null,

    setSelectedPoId: (id) => set({ selectedPoId: id }), // Impl

    fetchPOs: () => {
        set({ isLoading: true });
        try {
            const pos = poService.getAllPOs();
            set({ purchaseOrders: pos, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    createPO: async (dto) => {
        set({ isLoading: true });
        try {
            const newPO = poService.createPO(dto, 'current-user');
            get().fetchPOs(); // Force refresh from repository to ensure consistency
            set({ isLoading: false });
            return newPO.id;
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    updatePO: async (id, updates) => {
        try {
            const updated = poService.updatePO(id, updates, 'current-user');
            set(state => ({
                purchaseOrders: state.purchaseOrders.map(p => p.id === id ? updated : p)
            }));
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    submitPO: async (id) => {
        try {
            poService.submit(id, 'current-user');
            get().fetchPOs(); // Refresh
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    approvePO: async (id) => {
        try {
            poService.approve(id, 'current-user');
            const po = poService.getPOById(id);
            if (po) {
                try {
                    await syncPoFinanceCommitment(po, 'po_approved');
                } catch (syncError) {
                    console.error('Failed to sync PO approval commitment to Finance', syncError);
                }
            }
            get().fetchPOs();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    rejectPO: async (id, reason) => {
        try {
            poService.reject(id, 'current-user', reason);
            get().fetchPOs();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    sendPO: async (id) => {
        try {
            poService.send(id, 'current-user');
            const po = poService.getPOById(id);
            if (po) {
                try {
                    await syncPoFinanceCommitment(po, 'po_sent');
                } catch (syncError) {
                    console.error('Failed to sync PO sent commitment to Finance', syncError);
                }
            }
            get().fetchPOs();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    acknowledgePO: async (id) => {
        try {
            poService.acknowledge(id, 'current-user');
            const po = poService.getPOById(id);
            if (po) {
                try {
                    await syncPoFinanceCommitment(po, 'po_acknowledged');
                } catch (syncError) {
                    console.error('Failed to sync PO acknowledged commitment to Finance', syncError);
                }
            }
            get().fetchPOs();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    closePO: async (id) => {
        try {
            poService.close(id, 'current-user');
            get().fetchPOs();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    createGRN: async (poId, items) => {
        try {
            const grn = receivingService.createGRN(poId, items, 'current-user');
            get().fetchPOs();
            return { grnNumber: grn.grnNumber };
        } catch (err) {
            // set({ error: (err as Error).message });
            alert((err as Error).message); // Simple alert for logic errors
            throw err;
        }
    }
}));




