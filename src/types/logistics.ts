export type LogisticsFlowType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER';

export type ShipmentStatus =
    | 'DRAFT'
    | 'CONFIRMED'
    | 'BOOKED'
    | 'DISPATCHED'
    | 'IN_TRANSIT'
    | 'ARRIVED'
    | 'RECEIVING'
    | 'PUT_AWAY'
    | 'CLOSED'
    | 'EXCEPTION_HOLD'
    | 'DELIVERED'
    | 'CANCELLED';

export type TransferStatus =
    | 'REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'PICKING'
    | 'PICKED'
    | 'PACKED'
    | 'DISPATCHED'
    | 'IN_TRANSIT'
    | 'RECEIVING'
    | 'RECEIVED'
    | 'CLOSED'
    | 'EXCEPTION_HOLD'
    | 'CANCELLED';

export type DeliveryStatus =
    | 'DRAFT'
    | 'ALLOCATED'
    | 'PICKING'
    | 'PICKED'
    | 'PACKED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CLOSED'
    | 'EXCEPTION_HOLD'
    | 'CANCELLED';

export type ExceptionType = 'DAMAGE' | 'SHORTAGE' | 'DELAY' | 'LOST'
    | 'OVER_RECEIPT' | 'CUSTOMS_HOLD' | 'DOCS_MISSING' | 'QUALITY_FAIL'
    | 'POD_MISSING' | 'REFUSED_DELIVERY' | 'WRONG_ITEM' | 'SERIAL_LOT_MISSING' | 'OTHER';

export type ResolutionActionType =
    | 'RE_SCHEDULE'
    | 'CREATE_REPLACEMENT_SHIPMENT'
    | 'CANCEL_SHIPMENT'
    | 'ACCEPT_WITH_DISCREPANCY'
    | 'REQUEST_REPLACEMENT'
    | 'RETURN_TO_SUPPLIER'
    | 'WRITE_OFF'
    | 'CAPTURE_POD'
    | 'RE_DELIVER'
    | 'ISSUE_CREDIT'
    | 'OTHER';

export interface ExceptionResolution {
    actionType: ResolutionActionType;
    notes?: string;
    resolvedAt?: string;
    resolvedBy?: string;
}

export type ExceptionStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

export interface Attachment {
    id: string;
    filename: string;
    type: string;
    url: string; // Base64 or mock URL
    createdAt: string;
    createdBy: string;
}

export interface AuditEvent {
    id: string;
    action: string;
    message: string;
    actor: string;
    timestamp: string;
    meta?: any;
}

export interface ReceivingBatch {
    id: string;
    date: string;
    qtyReceived: number;
    receivedBy: string;
    grnId?: string;
}

export interface ShipmentLine {
    id: string;
    itemId: string;
    sku: string;
    description: string;
    uom: string;
    qtyOrdered: number;
    qtyShipped: number;
    qtyReceived: number;
    qtyDamaged: number;
    qtyShort: number;
    unitPrice: number;
    currency: string;
    receivingBatches: ReceivingBatch[];
}

export interface Shipment {
    id: string;
    code: string; // e.g., SHP-2026-0001
    flowType: LogisticsFlowType;
    poId?: string; // Optional linked PO
    deliveryId?: string; // Optional linked Delivery

    supplierId?: string; // For Inbound
    customerId?: string; // For Outbound

    originLocationId: string;
    destinationLocationId: string;

    carrierId?: string;
    trackingNo?: string;

    shipDate?: string;
    etaDate?: string;
    arrivalDate?: string;

    status: ShipmentStatus;
    statusBeforeHold?: ShipmentStatus;
    tags: string[];
    notes?: string;

    lines: ShipmentLine[];
    attachments: Attachment[];
    auditLog: AuditEvent[];
    exceptionIds: string[];

    createdAt: string;
    createdBy: string;
    updatedAt: string;
}

export type ReceivingTargetType = 'SHIPMENT' | 'TRANSFER';

export interface GRNLineSnapshot {
    sourceLineId: string; // shipmentLineId or transferLineId
    itemId: string;
    sku?: string;
    description?: string;
    uom?: string;
    qtyReceived: number;
    qtyDamaged: number;
    qtyShort: number;
    notes?: string;
}

export interface GRN {
    id: string;
    grnNo: string;
    targetType: ReceivingTargetType;
    targetId: string;
    shipmentId?: string; // backward compat
    date: string;
    receivedBy: string;
    locationId?: string;
    lines: GRNLineSnapshot[];
    notes?: string;
    attachments: Attachment[];
    auditLog: AuditEvent[];
}

export interface TransferLine {
    id: string;
    itemId: string;
    sku: string;
    description: string;
    uom: string;
    qtyRequested: number;
    qtyPicked: number;
    qtyDispatched: number;
    qtyReceived: number;
    qtyDamaged: number;
    qtyShort: number;
    batchOrSerials?: string[];
}

export interface Transfer {
    id: string;
    code: string;
    sourceLocationId: string;
    destLocationId: string;
    requestedBy: string;
    requestedAt?: string;
    neededDate: string;
    approvedBy?: string;
    approvedAt?: string;
    carrierId?: string;
    vehicleInfo?: string;
    trackingNo?: string;
    dispatchDate?: string;
    etaDate?: string;
    arrivalDate?: string;
    notes?: string;
    tags?: string[];
    status: TransferStatus;
    statusBeforeHold?: TransferStatus;
    lines: TransferLine[];
    attachments: Attachment[];
    auditLog: AuditEvent[];
    exceptionIds: string[];
    createdAt: string;
    updatedAt: string;
}

export interface DeliveryLine {
    id: string;
    itemId: string;
    sku: string;
    description: string;
    uom: string;
    qtyRequested: number;
    qtyAllocated: number;
    qtyPicked: number;
    qtyShipped: number;
    qtyDelivered: number;
    qtyShort: number;
    unitPrice?: number;
    currency?: string;
}

export type PODStatus = 'PENDING' | 'CAPTURED';

export interface POD {
    id: string;
    deliveryId: string;
    status: PODStatus;
    signedBy: string;
    signatureType: 'TYPED' | 'NAME' | 'IMAGE';
    deliveredAt: string;
    notes?: string;
    attachments: Attachment[];
}

export interface Delivery {
    id: string;
    code: string;
    customerId?: string;
    projectId?: string;
    destinationText?: string; // free-text label
    sourceLocationId: string;
    destinationLocationId: string;
    destinationAddress?: string;
    carrierId?: string;
    trackingNo?: string;
    linkedShipmentId?: string;
    status: DeliveryStatus;
    statusBeforeHold?: DeliveryStatus;
    shipDate?: string;
    etaDate?: string;
    deliveredDate?: string;
    lines: DeliveryLine[];
    attachments: Attachment[];
    auditLog: AuditEvent[];
    pod?: POD;
    exceptionIds: string[];
    createdAt: string;
    createdBy: string;
    updatedAt: string;
}

export interface ExceptionCase {
    id: string;
    code: string;
    type: ExceptionType;
    status: ExceptionStatus;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    linkedEntityType: 'SHIPMENT' | 'TRANSFER' | 'DELIVERY' | 'GRN' | 'SHIPMENT_LINE';
    linkedEntityId: string;
    linkedLineId?: string;
    summary: string;
    details: string;
    createdBy: string;
    assignedTo?: string;
    dueDate?: string;
    resolution?: ExceptionResolution;
    relatedEntityActions?: {
        createdShipmentId?: string;
        createdTransferId?: string;
        createdGRNId?: string;
        createdDeliveryId?: string;
    };
    attachments: Attachment[];
    auditLog: AuditEvent[];
    createdAt: string;
    updatedAt: string;
}
