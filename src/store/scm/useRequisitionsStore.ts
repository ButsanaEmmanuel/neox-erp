import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
    Requisition, RequisitionStatus, FulfillmentRoute, RequisitionLine
} from '../../types/requisition';
import { requisitionsStorage } from '../../lib/storage/requisitionsStorage';

// Quick helper to standardise timestamping
const now = () => new Date().toISOString();

interface RequisitionsState {
    requisitions: Requisition[];

    // Setup
    fetchRequisitions: () => void;

    // CRUD
    createRequisition: (req: Omit<Requisition, 'id' | 'code' | 'status' | 'requestedAt' | 'attachments' | 'auditLog' | 'exceptionIds'>) => string;
    updateRequisition: (id: string, updates: Partial<Requisition>) => void;
    deleteRequisition: (id: string, actor?: string) => void;

    // Workflow Status
    submitRequisition: (id: string, justification: string, actor?: string) => void;
    approveRequisition: (id: string, actor?: string) => void;
    rejectRequisition: (id: string, reason: string, actor?: string) => void;

    // Routing
    setFulfillmentRoute: (id: string, route: FulfillmentRoute, actor?: string) => void;

    // Fulfillment Links
    linkToPO: (id: string, poId: string, actor?: string) => void;
    linkToTransfer: (id: string, transferId: string, actor?: string) => void;
    allocateFromStock: (id: string, lineAllocations: { lineId: string; qty: number }[], actor?: string) => void;
    markFulfilled: (id: string, lineFulfillments: { lineId: string; qty: number }[], actor?: string) => void;
    closeRequisition: (id: string, actor?: string) => void;

    // Attachments & Audit
    addAudit: (id: string, action: string, message: string, actor?: string) => void;
    addException: (id: string, exceptionId: string) => void;
}

export const useRequisitionsStore = create<RequisitionsState>((set, get) => ({
    requisitions: [],

    fetchRequisitions: () => {
        set({ requisitions: requisitionsStorage.getRequisitions() });
    },

    createRequisition: (data) => {
        const { requisitions } = get();
        // Generate seq number based on existing
        const seq = String(requisitions.length + 1).padStart(5, '0');
        const code = `REQ-${new Date().getFullYear()}-${seq}`;

        const newReq: Requisition = {
            id: uuidv4(),
            code,
            status: 'DRAFT',
            requestedAt: now(),
            attachments: [],
            auditLog: [{
                id: uuidv4(),
                action: 'CREATED',
                message: 'Requisition draft created',
                actor: data.requestedBy,
                timestamp: now()
            }],
            exceptionIds: [],
            ...data
        };

        const updated = [...requisitions, newReq];
        set({ requisitions: updated });
        requisitionsStorage.saveRequisitions(updated);
        return newReq.id;
    },

    updateRequisition: (id, updates) => {
        const { requisitions } = get();
        const updated = requisitions.map(r => r.id === id ? { ...r, ...updates } : r);
        set({ requisitions: updated });
        requisitionsStorage.saveRequisitions(updated);
    },

    deleteRequisition: (id, actor = 'System') => {
        // Soft delete/cancel or hard delete? Let's just remove for now, or CANCEL if we prefer.
        // The prompt says deleteRequisition, but normally we'd want audit. Let's physically delete.
        const { requisitions } = get();
        const updated = requisitions.filter(r => r.id !== id);
        set({ requisitions: updated });
        requisitionsStorage.saveRequisitions(updated);
    },

    submitRequisition: (id, justification, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req || req.status !== 'DRAFT') return;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'SUBMITTED', message: 'Submitted for approval', actor, timestamp: now() }];
        updateRequisition(id, { status: 'SUBMITTED', justification, auditLog: audit });
    },

    approveRequisition: (id, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req || req.status !== 'SUBMITTED') return;

        // Auto approve lines (copy requested to approved)
        const lines = req.lines.map(l => ({ ...l, qtyApproved: l.qtyRequested }));
        const audit = [...req.auditLog, { id: uuidv4(), action: 'APPROVED', message: 'Requisition approved', actor, timestamp: now() }];

        updateRequisition(id, { status: 'APPROVED', lines, auditLog: audit });
    },

    rejectRequisition: (id, reason, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req || req.status !== 'SUBMITTED') return;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'REJECTED', message: `Rejected: ${reason}`, actor, timestamp: now() }];
        updateRequisition(id, { status: 'REJECTED', auditLog: audit });
    },

    setFulfillmentRoute: (id, route, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req || req.status !== 'APPROVED') return;

        let nextStatus: RequisitionStatus = 'SOURCING';
        if (route === 'FROM_STOCK') nextStatus = 'FULFILLING'; // Go straight to fulfillment loop

        const audit = [...req.auditLog, { id: uuidv4(), action: 'ROUTE_SELECTED', message: `Routed via ${route}`, actor, timestamp: now() }];
        updateRequisition(id, { fulfillmentRoute: route, status: nextStatus, auditLog: audit });
    },

    linkToPO: (id, poId, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'PO_CREATED', message: `Linked to Purchase Order`, actor, timestamp: now() }];
        updateRequisition(id, { linkedPOId: poId, status: 'PO_CREATED', auditLog: audit });
    },

    linkToTransfer: (id, transferId, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'TRANSFER_CREATED', message: `Linked to Internal Transfer`, actor, timestamp: now() }];
        updateRequisition(id, { linkedTransferId: transferId, status: 'TRANSFER_CREATED', auditLog: audit });
    },

    allocateFromStock: (id, lineAllocations, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const lines = req.lines.map(line => {
            const alloc = lineAllocations.find(a => a.lineId === line.id);
            if (alloc) return { ...line, qtyAllocated: line.qtyAllocated + alloc.qty };
            return line;
        });

        const audit = [...req.auditLog, { id: uuidv4(), action: 'ALLOCATED', message: 'Stock allocated for fulfillment', actor, timestamp: now() }];
        updateRequisition(id, { lines, status: 'FULFILLING', auditLog: audit });
    },

    markFulfilled: (id, lineFulfillments, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const lines = req.lines.map(line => {
            const flf = lineFulfillments.find(a => a.lineId === line.id);
            if (flf) return { ...line, qtyFulfilled: line.qtyFulfilled + flf.qty };
            return line;
        });

        // Check if fully fulfilled
        const isFullyFulfilled = lines.every(l => l.qtyFulfilled >= l.qtyApproved);
        const status = isFullyFulfilled ? 'FULFILLED' : req.status;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'FULFILLED', message: 'Lines fulfilled', actor, timestamp: now() }];
        updateRequisition(id, { lines, status, auditLog: audit });
    },

    closeRequisition: (id, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const audit = [...req.auditLog, { id: uuidv4(), action: 'CLOSED', message: 'Requisition closed', actor, timestamp: now() }];
        updateRequisition(id, { status: 'CLOSED', auditLog: audit });
    },

    addAudit: (id, action, message, actor = 'Current User') => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const audit = [...req.auditLog, { id: uuidv4(), action, message, actor, timestamp: now() }];
        updateRequisition(id, { auditLog: audit });
    },

    addException: (id, exceptionId) => {
        const { requisitions, updateRequisition } = get();
        const req = requisitions.find(r => r.id === id);
        if (!req) return;

        const exceptionIds = [...req.exceptionIds, exceptionId];
        updateRequisition(id, { exceptionIds });
    }
}));
