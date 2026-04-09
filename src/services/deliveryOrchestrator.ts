/**
 * Delivery Orchestrator - workflow transitions + Shipment auto-creation.
 * Handles: allocate, pick, pack, ship (-> creates outbound Shipment), deliver (-> POD), close.
 */
import { logisticsStorage } from '../lib/storage/logisticsStorage';
import { Delivery, DeliveryStatus, DeliveryLine, Shipment, POD, ExceptionCase } from '../types/logistics';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date().toISOString();

// --- Transition guard ---
const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
    DRAFT: ['ALLOCATED', 'CANCELLED'],
    ALLOCATED: ['PICKING', 'EXCEPTION_HOLD', 'CANCELLED'],
    PICKING: ['PICKED', 'EXCEPTION_HOLD'],
    PICKED: ['PACKED'],
    PACKED: ['SHIPPED'],
    SHIPPED: ['DELIVERED', 'EXCEPTION_HOLD'],
    DELIVERED: ['CLOSED', 'EXCEPTION_HOLD'],
    CLOSED: [],
    EXCEPTION_HOLD: ['DRAFT', 'ALLOCATED', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    CANCELLED: []
};

export function canTransitionDelivery(current: DeliveryStatus, next: DeliveryStatus): boolean {
    return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

// --- Create delivery ---
export function createDelivery(delivery: Omit<Delivery, 'id' | 'code' | 'status' | 'auditLog' | 'exceptionIds' | 'createdAt' | 'updatedAt' | 'createdBy'> & { createdBy: string }): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const seq = String(deliveries.length + 1).padStart(4, '0');

    const newDelivery: Delivery = {
        ...delivery,
        id: uuidv4(),
        code: `DLV-${new Date().getFullYear()}-${seq}`,
        status: 'DRAFT',
        exceptionIds: [],
        auditLog: [{
            id: uuidv4(), action: 'CREATED',
            message: 'Delivery Created', actor: delivery.createdBy, timestamp: now()
        }],
        createdAt: now(),
        updatedAt: now()
    };

    deliveries.push(newDelivery);
    logisticsStorage.saveDeliveries(deliveries);
    return newDelivery;
}

// --- Allocate ---
export function allocateDelivery(id: string, actor: string): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'ALLOCATED')) throw new Error('Cannot allocate from ' + dlv.status);

    dlv.lines = dlv.lines.map(l => ({ ...l, qtyAllocated: l.qtyRequested }));
    dlv.status = 'ALLOCATED';
    dlv.updatedAt = now();
    dlv.auditLog.push({ id: uuidv4(), action: 'STATUS_CHANGED_ALLOCATED', message: 'Stock allocated', actor, timestamp: now() });

    logisticsStorage.saveDeliveries(deliveries);
    return dlv;
}

// --- Start Picking ---
export function startPicking(id: string, actor: string): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'PICKING')) throw new Error('Cannot start picking from ' + dlv.status);

    dlv.status = 'PICKING';
    dlv.updatedAt = now();
    dlv.auditLog.push({ id: uuidv4(), action: 'STATUS_CHANGED_PICKING', message: 'Picking started', actor, timestamp: now() });

    logisticsStorage.saveDeliveries(deliveries);
    return dlv;
}

// --- Mark Picked ---
export function markPicked(id: string, lineUpdates: { lineId: string; qtyPicked: number }[], actor: string): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'PICKED')) throw new Error('Cannot mark picked from ' + dlv.status);

    dlv.lines = dlv.lines.map(l => {
        const upd = lineUpdates.find(u => u.lineId === l.id);
        if (!upd) return l;
        return { ...l, qtyPicked: Math.min(upd.qtyPicked, l.qtyAllocated) };
    });
    dlv.status = 'PICKED';
    dlv.updatedAt = now();
    dlv.auditLog.push({ id: uuidv4(), action: 'STATUS_CHANGED_PICKED', message: 'Items picked', actor, timestamp: now() });

    logisticsStorage.saveDeliveries(deliveries);
    return dlv;
}

// --- Mark Packed ---
export function markPacked(id: string, actor: string): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'PACKED')) throw new Error('Cannot pack from ' + dlv.status);

    dlv.status = 'PACKED';
    dlv.updatedAt = now();
    dlv.auditLog.push({ id: uuidv4(), action: 'STATUS_CHANGED_PACKED', message: 'Items packed', actor, timestamp: now() });

    logisticsStorage.saveDeliveries(deliveries);
    return dlv;
}

// --- Ship Delivery (creates outbound Shipment) ---
export interface ShipPayload {
    carrierId: string;
    trackingNo: string;
    shipDate: string;
    etaDate: string;
    qtyShippedPerLine: { lineId: string; qtyShipped: number }[];
}

export function shipDelivery(id: string, payload: ShipPayload, actor: string): { delivery: Delivery; shipment: Shipment } {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'SHIPPED')) throw new Error('Cannot ship from ' + dlv.status);

    // Update delivery lines
    dlv.lines = dlv.lines.map(l => {
        const upd = payload.qtyShippedPerLine.find(u => u.lineId === l.id);
        if (!upd) return l;
        return { ...l, qtyShipped: Math.min(upd.qtyShipped, l.qtyPicked) };
    });

    dlv.carrierId = payload.carrierId;
    dlv.trackingNo = payload.trackingNo;
    dlv.shipDate = payload.shipDate;
    dlv.etaDate = payload.etaDate;
    dlv.status = 'SHIPPED';
    dlv.updatedAt = now();

    // Create outbound Shipment
    const shipments = logisticsStorage.getShipments();
    const shpSeq = String(shipments.length + 1).padStart(4, '0');
    const shipment: Shipment = {
        id: uuidv4(),
        code: `SHP-${new Date().getFullYear()}-${shpSeq}`,
        flowType: 'OUTBOUND',
        deliveryId: dlv.id,
        customerId: dlv.customerId,
        originLocationId: dlv.sourceLocationId,
        destinationLocationId: dlv.destinationLocationId,
        carrierId: payload.carrierId,
        trackingNo: payload.trackingNo,
        shipDate: payload.shipDate,
        etaDate: payload.etaDate,
        status: 'DISPATCHED',
        tags: [],
        lines: dlv.lines.filter(l => l.qtyShipped > 0).map(l => ({
            id: uuidv4(),
            itemId: l.itemId,
            sku: l.sku,
            description: l.description,
            uom: l.uom,
            qtyOrdered: l.qtyRequested,
            qtyShipped: l.qtyShipped,
            qtyReceived: 0,
            qtyDamaged: 0,
            qtyShort: 0,
            unitPrice: l.unitPrice || 0,
            currency: l.currency || 'USD',
            receivingBatches: []
        })),
        attachments: [],
        auditLog: [{ id: uuidv4(), action: 'CREATED', message: `Shipment created from Delivery ${dlv.code}`, actor, timestamp: now() }],
        exceptionIds: [],
        createdAt: now(),
        createdBy: actor,
        updatedAt: now()
    };

    dlv.linkedShipmentId = shipment.id;
    dlv.auditLog.push({
        id: uuidv4(), action: 'STATUS_CHANGED_SHIPPED',
        message: `Shipped via ${payload.carrierId} - Shipment ${shipment.code} created`,
        actor, timestamp: now()
    });

    shipments.push(shipment);
    logisticsStorage.saveShipments(shipments);
    logisticsStorage.saveDeliveries(deliveries);

    return { delivery: dlv, shipment };
}

// --- Deliver + POD ---
export interface PODPayload {
    signedBy: string;
    deliveredAt: string;
    notes?: string;
    qtyDeliveredPerLine: { lineId: string; qtyDelivered: number; qtyShort: number }[];
}

export function deliverWithPOD(id: string, payload: PODPayload, actor: string): { delivery: Delivery; exceptions: ExceptionCase[] } {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'DELIVERED')) throw new Error('Cannot deliver from ' + dlv.status);

    // Update lines
    let hasShortage = false;
    dlv.lines = dlv.lines.map(l => {
        const upd = payload.qtyDeliveredPerLine.find(u => u.lineId === l.id);
        if (!upd) return l;
        if (upd.qtyShort > 0) hasShortage = true;
        return { ...l, qtyDelivered: upd.qtyDelivered, qtyShort: upd.qtyShort };
    });

    // Capture POD
    const pod: POD = {
        id: uuidv4(),
        deliveryId: dlv.id,
        status: 'CAPTURED',
        signedBy: payload.signedBy,
        signatureType: 'TYPED',
        deliveredAt: payload.deliveredAt,
        notes: payload.notes,
        attachments: []
    };
    dlv.pod = pod;
    dlv.deliveredDate = payload.deliveredAt;
    dlv.status = hasShortage ? 'EXCEPTION_HOLD' : 'DELIVERED';
    dlv.updatedAt = now();
    dlv.auditLog.push({
        id: uuidv4(), action: 'STATUS_CHANGED_DELIVERED',
        message: `POD captured - signed by ${payload.signedBy}${hasShortage ? ' (shortages detected)' : ''}`,
        actor, timestamp: now()
    });

    // Create exceptions for shortages
    const exceptions: ExceptionCase[] = [];
    if (hasShortage) {
        const shortLines = dlv.lines.filter(l => l.qtyShort > 0);
        for (const sl of shortLines) {
            const exc: ExceptionCase = {
                id: uuidv4(),
                code: `EXC-${Date.now()}-${sl.id.slice(0, 6)}`,
                type: 'SHORTAGE',
                status: 'OPEN',
                severity: 'MEDIUM',
                linkedEntityType: 'DELIVERY',
                linkedEntityId: dlv.id,
                summary: `${sl.qtyShort} ${sl.uom} of ${sl.description} short on delivery`,
                details: `Shortage recorded during POD capture for ${dlv.code}`,
                createdBy: actor,
                attachments: [],
                auditLog: [{ id: uuidv4(), action: 'CREATED', message: 'Exception auto-created from delivery shortage', actor, timestamp: now() }],
                createdAt: now(),
                updatedAt: now()
            };
            dlv.exceptionIds.push(exc.id);
            exceptions.push(exc);
        }
        const allExc = logisticsStorage.getExceptions();
        allExc.push(...exceptions);
        logisticsStorage.saveExceptions(allExc);
    }

    logisticsStorage.saveDeliveries(deliveries);
    return { delivery: dlv, exceptions };
}

// --- Close ---
export function closeDelivery(id: string, actor: string): Delivery {
    const deliveries = logisticsStorage.getDeliveries();
    const dlv = deliveries.find(d => d.id === id);
    if (!dlv) throw new Error('Delivery not found');
    if (!canTransitionDelivery(dlv.status, 'CLOSED')) throw new Error('Cannot close from ' + dlv.status);
    if (!dlv.pod || dlv.pod.status !== 'CAPTURED') throw new Error('POD must be captured before closing');

    dlv.status = 'CLOSED';
    dlv.updatedAt = now();
    dlv.auditLog.push({ id: uuidv4(), action: 'STATUS_CHANGED_CLOSED', message: 'Delivery closed', actor, timestamp: now() });

    logisticsStorage.saveDeliveries(deliveries);
    return dlv;
}

// --- Delete ---
export function deleteDelivery(id: string): void {
    const deliveries = logisticsStorage.getDeliveries().filter(d => d.id !== id);
    logisticsStorage.saveDeliveries(deliveries);
}
