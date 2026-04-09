import { create } from 'zustand';
import {
    Shipment, Transfer, Delivery, ExceptionCase, GRN,
    ShipmentStatus, TransferStatus, DeliveryStatus, ExceptionStatus
} from '../../types/logistics';
import { logisticsService } from '../../services/logistics.service';

export const canTransitionShipment = (shipment: Shipment, targetStatus: ShipmentStatus): boolean => {
    const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
        'DRAFT': ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED': ['BOOKED', 'CANCELLED'],
        'BOOKED': ['DISPATCHED', 'CANCELLED'],
        'DISPATCHED': ['IN_TRANSIT', 'CANCELLED'],
        'IN_TRANSIT': ['ARRIVED', 'EXCEPTION_HOLD'],
        'ARRIVED': ['RECEIVING', 'DELIVERED'],
        'RECEIVING': ['PUT_AWAY'],
        'PUT_AWAY': ['CLOSED'],
        'EXCEPTION_HOLD': ['IN_TRANSIT', 'ARRIVED', 'CANCELLED'],
        'DELIVERED': ['CLOSED'],
        'CLOSED': [],
        'CANCELLED': []
    };
    return allowedTransitions[shipment.status]?.includes(targetStatus) ?? false;
};

export const canTransitionTransfer = (transfer: Transfer, targetStatus: TransferStatus): boolean => {
    // For demo purposes, allow most logical forward/backward flows
    // but prevent moving to CLOSED/CANCELLED/REJECTED without proper flow if needed.
    // However, let's be more permissive for the user to "fix" states.
    const forbiddenTransitions: Partial<Record<TransferStatus, TransferStatus[]>> = {
        'CLOSED': ['REQUESTED', 'APPROVED', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVING'],
        'REJECTED': ['APPROVED', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVING']
    };

    if (transfer.status === targetStatus) return false;

    const forbidden = forbiddenTransitions[transfer.status as keyof typeof forbiddenTransitions];
    if (forbidden?.includes(targetStatus)) return false;

    return true; // Allow most transitions for flexibility
};

interface LogisticsState {
    shipments: Shipment[];
    transfers: Transfer[];
    deliveries: Delivery[];
    exceptions: ExceptionCase[];
    grns: GRN[];

    isLoading: boolean;
    error: string | null;

    fetchShipments: () => Promise<void>;
    fetchTransfers: () => Promise<void>;
    fetchDeliveries: () => Promise<void>;
    fetchExceptions: () => Promise<void>;
    fetchGRNs: () => Promise<void>;

    // Create/Update Actions
    saveShipment: (shipment: Shipment) => Promise<void>;
    saveTransfer: (transfer: Transfer) => Promise<void>;
    saveDelivery: (delivery: Delivery) => Promise<void>;
    saveException: (exception: ExceptionCase) => Promise<void>;

    // Status Transitions
    transitionShipmentStatus: (id: string, status: ShipmentStatus) => Promise<void>;
    transitionTransferStatus: (id: string, status: TransferStatus) => Promise<void>;
    transitionDeliveryStatus: (id: string, status: DeliveryStatus) => Promise<void>;
    transitionExceptionStatus: (id: string, status: ExceptionStatus) => Promise<void>;

    // Receiving
    saveGRN: (grn: GRN) => Promise<void>;

    // Extended Shipment Actions
    deleteShipment: (id: string) => Promise<void>;
    addShipmentAudit: (id: string, action: string, message: string, actor: string) => Promise<void>;
    addShipmentAttachment: (id: string, attachment: Omit<import('../../types/logistics').Attachment, 'id' | 'createdAt'>) => Promise<void>;
    createExceptionFromShipment: (shipmentId: string, exception: ExceptionCase) => Promise<void>;

    // Extended Transfer Actions
    deleteTransfer: (id: string) => Promise<void>;
    addTransferAudit: (id: string, action: string, message: string, actor: string) => Promise<void>;
    addTransferAttachment: (id: string, attachment: Omit<import('../../types/logistics').Attachment, 'id' | 'createdAt'>) => Promise<void>;
    createExceptionFromTransfer: (transferId: string, exception: ExceptionCase) => Promise<void>;
    recordTransferReceiving: (id: string, lines: { lineId: string, qtyReceived: number, qtyDamaged: number, qtyShort: number }[], receivedBy: string) => Promise<void>;
}

export const useLogisticsStore = create<LogisticsState>((set, get) => ({
    shipments: [],
    transfers: [],
    deliveries: [],
    exceptions: [],
    grns: [],

    isLoading: false,
    error: null,

    fetchShipments: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await logisticsService.getShipments();
            set({ shipments: data, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchTransfers: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await logisticsService.getTransfers();
            set({ transfers: data, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchDeliveries: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await logisticsService.getDeliveries();
            set({ deliveries: data, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchExceptions: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await logisticsService.getExceptions();
            set({ exceptions: data, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchGRNs: async () => {
        try {
            const data = await logisticsService.getGRNs();
            set({ grns: data });
        } catch (err) {
            set({ error: (err as Error).message });
        }
    },

    saveShipment: async (shipment) => {
        try {
            await logisticsService.saveShipment(shipment);
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    saveTransfer: async (transfer) => {
        const existing = get().transfers.find(t => t.id === transfer.id || t.code === transfer.code);
        if (existing && !transfer.id) return; // Skip if already exists and we are creating

        try {
            await logisticsService.saveTransfer(transfer);
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    saveDelivery: async (delivery) => {
        try {
            await logisticsService.saveDelivery(delivery);
            await get().fetchDeliveries();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    saveException: async (exception) => {
        try {
            await logisticsService.saveException(exception);
            await get().fetchExceptions();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    transitionShipmentStatus: async (id, status) => {
        try {
            await logisticsService.transitionShipmentStatus(id, status, 'current-user');
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    transitionTransferStatus: async (id, status) => {
        try {
            await logisticsService.transitionTransferStatus(id, status, 'current-user');
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    transitionDeliveryStatus: async (id, status) => {
        try {
            await logisticsService.transitionDeliveryStatus(id, status, 'current-user');
            await get().fetchDeliveries();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    transitionExceptionStatus: async (id, status) => {
        try {
            await logisticsService.transitionExceptionStatus(id, status, 'current-user');
            await get().fetchExceptions();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    saveGRN: async (grn) => {
        try {
            await logisticsService.saveGRN(grn);
            // Optionally fetch shipments again if their lines were updated by the backend/service
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    deleteShipment: async (id) => {
        try {
            await logisticsService.deleteShipment(id);
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    addShipmentAudit: async (id, action, message, actor) => {
        try {
            await logisticsService.addShipmentAudit(id, action, message, actor);
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    addShipmentAttachment: async (id, attachment) => {
        try {
            await logisticsService.addShipmentAttachment(id, attachment);
            await get().fetchShipments();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    createExceptionFromShipment: async (shipmentId, exception) => {
        try {
            await logisticsService.createExceptionFromShipment(shipmentId, exception);
            await get().fetchShipments();
            await get().fetchExceptions();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    deleteTransfer: async (id) => {
        try {
            await logisticsService.deleteTransfer(id);
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    addTransferAudit: async (id, action, message, actor) => {
        try {
            await logisticsService.addTransferAudit(id, action, message, actor);
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    addTransferAttachment: async (id, attachment) => {
        try {
            await logisticsService.addTransferAttachment(id, attachment);
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    createExceptionFromTransfer: async (transferId, exception) => {
        try {
            await logisticsService.createExceptionFromTransfer(transferId, exception);
            await get().fetchTransfers();
            await get().fetchExceptions();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },

    recordTransferReceiving: async (id, lines, receivedBy) => {
        try {
            await logisticsService.recordTransferReceiving(id, lines, receivedBy);
            await get().fetchTransfers();
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    }
}));
