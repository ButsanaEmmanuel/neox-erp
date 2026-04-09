import { create } from 'zustand';

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface ScmException {
    id: string;
    type: string;
    entityType: 'PO' | 'RECEIPT' | 'TRANSFER' | 'SHIPMENT' | 'DELIVERY' | 'INVENTORY';
    entityId: string;
    severity: ExceptionSeverity;
    status: ExceptionStatus;
    description: string;
    createdAt: string;
    resolvedAt?: string;
}

interface ExceptionsState {
    exceptions: ScmException[];
    addException: (exception: ScmException) => void;
}

export const useExceptionsStore = create<ExceptionsState>((set) => ({
    exceptions: [],
    addException: (exception) => set((state) => ({ exceptions: [...state.exceptions, exception] }))
}));
