import { Attachment, AuditEvent } from './logistics'; // Reusing common types if possible, or we can define them locally if needed.

export type RequisitionType = 'STOCK' | 'SERVICE';

export type RequisitionStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SOURCING'          // Decision pending: stock vs PO vs Transfer
    | 'PO_CREATED'        // Link to Procurement
    | 'TRANSFER_CREATED'  // Link to Logistics Transfer
    | 'FULFILLING'        // Stock picking in progress
    | 'FULFILLED'         // Request completely satisfied
    | 'CLOSED'            // End of life
    | 'EXCEPTION_HOLD'
    | 'CANCELLED';

export type FulfillmentRoute = 'FROM_STOCK' | 'TRANSFER' | 'PROCUREMENT_PO';

export type RequisitionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface RequisitionLine {
    id: string;

    // Stock-specific (Type = STOCK)
    productId?: string;
    sku?: string;
    description?: string;
    uom?: string;
    qtyRequested: number;
    qtyApproved: number;
    qtyAllocated: number; // Reserved from stock
    qtyFulfilled: number; // Actually delivered / consumed

    // Service-specific (Type = SERVICE)
    serviceName?: string;
    serviceDescription?: string;
    estimatedCost?: number;
    currency?: string;
}

export interface Requisition {
    id: string;
    code: string; // e.g., REQ-2026-00001
    type: RequisitionType;
    status: RequisitionStatus;

    requestedBy: string;
    requestedAt: string;
    department?: string;
    projectId?: string;

    requestedForLocationId: string; // Required for all
    neededBy?: string;
    priority: RequisitionPriority;
    justification?: string; // Required on submit

    fulfillmentRoute?: FulfillmentRoute; // Set after approval
    preferredSupplierId?: string; // Only if route = PROCUREMENT_PO

    linkedPOId?: string; // Only if PO created
    linkedTransferId?: string; // Only if Transfer created

    lines: RequisitionLine[];
    attachments: any[]; // Or Attachment[] if imported
    auditLog: any[]; // Or AuditEvent[] if imported
    exceptionIds: string[]; // Exception IDs linked to this req
}
