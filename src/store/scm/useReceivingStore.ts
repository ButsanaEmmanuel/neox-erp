import { create } from 'zustand';

export type ReceivingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXCEPTION';
export type ReceivingCondition = 'GOOD' | 'DAMAGED' | 'MISSING' | 'WRONG_ITEM';

export interface ReceivingLine {
    id: string;
    productId: string;
    expectedQty: number;
    receivedQty: number;
    condition: ReceivingCondition;
}

export interface ReceivingReceipt {
    id: string;
    sourceType: 'PO' | 'TRANSFER' | 'SHIPMENT';
    sourceId: string;
    status: ReceivingStatus;
    createdAt: string;
    receivedAt?: string;
    lines: ReceivingLine[];
}

interface ReceivingState {
    receipts: ReceivingReceipt[];
    // Minimal actions
    addReceipt: (receipt: ReceivingReceipt) => void;
}

export const useReceivingStore = create<ReceivingState>((set) => ({
    receipts: [],
    addReceipt: (receipt) => set((state) => ({ receipts: [...state.receipts, receipt] }))
}));
