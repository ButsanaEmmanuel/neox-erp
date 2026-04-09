
export type POStatus =
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'SENT'
    | 'ACKNOWLEDGED'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'CLOSED'
    | 'REJECTED'
    | 'CANCELLED';

export const PO_STATUS_LABELS: Record<POStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    SENT: 'Sent',
    ACKNOWLEDGED: 'Acknowledged',
    PARTIALLY_RECEIVED: 'Partially Received',
    RECEIVED: 'Received',
    CLOSED: 'Closed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled'
};

export interface PurchaseOrderLine {
    id: string;
    poId: string;
    productId: string | null; // Null if manual/non-catalog
    itemCode: string; // Snapshot
    description: string; // Snapshot
    uom: string;
    qtyOrdered: number;
    unitPrice: number;
    discount: number;
    taxCode: string;
    taxAmount: number;
    lineTotal: number;
    qtyReceived: number; // Computed from GRNs
    status: 'OPEN' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
}

export interface POAuditLogEntry {
    timestamp: string;
    actor: string;
    action: string;
    meta?: Record<string, any>;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string; // Auto-sequence
    supplierId: string;
    shipToLocationId: string;
    currency: string;
    paymentTerms: string;
    orderDate: string;
    expectedDeliveryDate: string;
    status: POStatus;

    // Totals
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    freightTotal: number;
    grandTotal: number;

    notes?: string;

    // Workflow
    createdBy: string;
    approvedBy?: string;
    approvedAt?: string;
    sentAt?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;

    // Revision control
    revision: number;
    changeReason?: string;

    auditLog: POAuditLogEntry[];
    lines: PurchaseOrderLine[];
}

export type GRNStatus = 'DRAFT' | 'POSTED';

export interface GRNLine {
    poLineId: string;
    productId: string | null;
    qtyReceived: number;
    uom: string;
    locationId: string; // Can be different per line if needed
}

export interface GRN {
    id: string;
    grnNumber: string; // Auto-sequence GRN-2026-XXXX
    poId: string;
    receiptDate: string;
    locationId: string; // Default destination
    status: GRNStatus;
    receivedBy: string;
    lines: GRNLine[];
    createdAt: string;
}

export interface InventoryTransaction {
    id: string;
    type: 'RECEIPT' | 'ADJUSTMENT' | 'TRANSFER' | 'CONSUMPTION';
    refType: 'GRN' | 'MANUAL' | 'ORDER';
    refId: string;
    productId: string;
    qty: number; // Positive for receipt, negative for consumption
    locationId: string;
    createdAt: string;
}

// DTOs
export interface CreatePODTO {
    supplierId: string;
    shipToLocationId: string;
    currency: string;
    paymentTerms: string;
    expectedDeliveryDate: string;
    notes?: string;
    lines: Omit<PurchaseOrderLine, 'id' | 'poId' | 'qtyReceived' | 'status' | 'lineTotal' | 'taxAmount'>[];
}

export interface UpdatePODTO extends Partial<CreatePODTO> {
    changeReason?: string;
}
