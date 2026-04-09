import { LogisticsFlowType, Shipment, Transfer, Delivery, ExceptionCase, GRN } from '../../types/logistics';

const STORAGE_KEYS = {
    SHIPMENTS: 'neox_logistics_shipments_v2',
    TRANSFERS: 'neox_logistics_transfers_v2',
    DELIVERIES: 'neox_logistics_deliveries_v2',
    EXCEPTIONS: 'neox_logistics_exceptions_v2',
    GRNS: 'neox_logistics_grns_v2'
};

export const logisticsStorage = {
    getShipments: (): Shipment[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SHIPMENTS);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },
    saveShipments: (data: Shipment[]) => {
        localStorage.setItem(STORAGE_KEYS.SHIPMENTS, JSON.stringify(data));
    },

    getTransfers: (): Transfer[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },
    saveTransfers: (data: Transfer[]) => {
        localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(data));
    },

    getDeliveries: (): Delivery[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.DELIVERIES);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },
    saveDeliveries: (data: Delivery[]) => {
        localStorage.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(data));
    },

    getExceptions: (): ExceptionCase[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.EXCEPTIONS);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },
    saveExceptions: (data: ExceptionCase[]) => {
        localStorage.setItem(STORAGE_KEYS.EXCEPTIONS, JSON.stringify(data));
    },

    getGRNs: (): GRN[] => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.GRNS);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    },
    saveGRNs: (data: GRN[]) => {
        localStorage.setItem(STORAGE_KEYS.GRNS, JSON.stringify(data));
    }
};
