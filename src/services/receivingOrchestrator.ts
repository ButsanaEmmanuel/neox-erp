/**
 * Receiving Orchestrator - handles GRN posting and Inbound/Transfer state transitions.
 */
import { logisticsStorage } from '../lib/storage/logisticsStorage';
import { 
    Shipment, Transfer, GRN, GRNLineSnapshot, 
    ExceptionCase, ExceptionType, AuditEvent 
} from '../types/logistics';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date().toISOString();

// --- Query Helpers ---

export function getReadyToReceiveShipments(): Shipment[] {
    const shipments = logisticsStorage.getShipments();
    // ARRIVED or RECEIVING status are candidates for GRN
    return shipments.filter(s => s.status === 'ARRIVED' || s.status === 'RECEIVING' || s.status === 'IN_TRANSIT');
}

export function getReadyToReceiveTransfers(): Transfer[] {
    const transfers = logisticsStorage.getTransfers();
    return transfers.filter(t => t.status === 'IN_TRANSIT' || t.status === 'RECEIVING');
}

export function getGRNsForTarget(type: 'SHIPMENT' | 'TRANSFER', id: string): GRN[] {
    const grns = logisticsStorage.getGRNs();
    return grns.filter(g => g.targetType === type && g.targetId === id);
}

// --- Internal Exception Helper ---

function createException(
    type: ExceptionType,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    entityType: 'SHIPMENT' | 'TRANSFER' | 'DELIVERY' | 'GRN' | 'SHIPMENT_LINE',
    entityId: string,
    summary: string,
    details: string,
    actor: string
): ExceptionCase {
    const exc: ExceptionCase = {
        id: uuidv4(),
        code: `EXC-${Date.now()}-${entityId.slice(0, 6)}`,
        type,
        status: 'OPEN',
        severity,
        linkedEntityType: entityType,
        linkedEntityId: entityId,
        summary,
        details,
        createdBy: actor,
        attachments: [],
        auditLog: [{
            id: uuidv4(), action: 'CREATED',
            message: `Exception auto-created: ${summary}`,
            actor, timestamp: now()
        }],
        createdAt: now(),
        updatedAt: now()
    };

    const exceptions = logisticsStorage.getExceptions();
    exceptions.push(exc);
    logisticsStorage.saveExceptions(exceptions);

    return exc;
}

// --- GRN Posting ---

export interface ReceivingLineDraft {
    sourceLineId: string;
    itemId: string;
    sku: string;
    description: string;
    uom: string;
    qtyReceived: number;
    qtyDamaged: number;
    qtyShort: number;
    notes?: string;
}

export function postShipmentGRN(shipmentId: string, lines: ReceivingLineDraft[], actor: string): { grn: GRN; exceptions: ExceptionCase[] } {
    const shipments = logisticsStorage.getShipments();
    const shp = shipments.find(s => s.id === shipmentId);
    if (!shp) throw new Error('Shipment not found');

    const grns = logisticsStorage.getGRNs();
    const grnNo = `GRN-S-${new Date().getFullYear()}-${String(grns.length + 1).padStart(4, '0')}`;
    const grnId = uuidv4();

    const grn: GRN = {
        id: grnId,
        grnNo,
        targetType: 'SHIPMENT',
        targetId: shipmentId,
        date: now(),
        receivedBy: actor,
        locationId: shp.destinationLocationId,
        lines: lines.map(l => ({ ...l })),
        attachments: [],
        auditLog: [{ id: uuidv4(), action: 'POSTED', message: `GRN ${grnNo} posted`, actor, timestamp: now() }]
    };

    const newExceptions: ExceptionCase[] = [];

    // Update shipment lines and check for discrepancies
    shp.lines = shp.lines.map(shpLine => {
        const draft = lines.find(l => l.sourceLineId === shpLine.id);
        if (!draft) return shpLine;

        const totalRcvdForLine = draft.qtyReceived + draft.qtyDamaged + draft.qtyShort;
        
        // Update line totals
        shpLine.qtyReceived += draft.qtyReceived;
        shpLine.qtyDamaged += draft.qtyDamaged;
        shpLine.qtyShort += draft.qtyShort;

        // Auto-create exceptions if needed
        if (draft.qtyDamaged > 0) {
            newExceptions.push(createException(
                'DAMAGE', 'MEDIUM', 'SHIPMENT', shipmentId,
                `Damage reported for ${shpLine.sku}`,
                `${draft.qtyDamaged} ${shpLine.uom} reported as damaged during GRN ${grnNo}. Notes: ${draft.notes || 'None'}`,
                actor
            ));
        }
        if (draft.qtyShort > 0) {
            newExceptions.push(createException(
                'SHORTAGE', 'HIGH', 'SHIPMENT', shipmentId,
                `Shortage reported for ${shpLine.sku}`,
                `${draft.qtyShort} ${shpLine.uom} reported as short during GRN ${grnNo}. Notes: ${draft.notes || 'None'}`,
                actor
            ));
        }

        return shpLine;
    });

    // Check if fully received
    const isFullyReceived = shp.lines.every(l => (l.qtyReceived + l.qtyDamaged + l.qtyShort) >= l.qtyOrdered);
    shp.status = isFullyReceived ? 'CLOSED' : 'RECEIVING';
    shp.updatedAt = now();
    shp.auditLog.push({ 
        id: uuidv4(), 
        action: 'GRN_POSTED', 
        message: `GRN ${grnNo} processed. Status: ${shp.status}`, 
        actor, 
        timestamp: now() 
    });

    grns.push(grn);
    logisticsStorage.saveGRNs(grns);
    logisticsStorage.saveShipments(shipments);

    return { grn, exceptions: newExceptions };
}

export function postTransferGRN(transferId: string, lines: ReceivingLineDraft[], actor: string): { grn: GRN; exceptions: ExceptionCase[] } {
    const transfers = logisticsStorage.getTransfers();
    const trf = transfers.find(t => t.id === transferId);
    if (!trf) throw new Error('Transfer not found');

    const grns = logisticsStorage.getGRNs();
    const grnNo = `GRN-T-${new Date().getFullYear()}-${String(grns.length + 1).padStart(4, '0')}`;
    const grnId = uuidv4();

    const grn: GRN = {
        id: grnId,
        grnNo,
        targetType: 'TRANSFER',
        targetId: transferId,
        date: now(),
        receivedBy: actor,
        locationId: trf.destLocationId,
        lines: lines.map(l => ({ ...l })),
        attachments: [],
        auditLog: [{ id: uuidv4(), action: 'POSTED', message: `GRN ${grnNo} posted`, actor, timestamp: now() }]
    };

    const newExceptions: ExceptionCase[] = [];

    trf.lines = trf.lines.map(trfLine => {
        const draft = lines.find(l => l.sourceLineId === trfLine.id);
        if (!draft) return trfLine;

        trfLine.qtyReceived += draft.qtyReceived;
        trfLine.qtyDamaged += draft.qtyDamaged;
        trfLine.qtyShort += draft.qtyShort;

        if (draft.qtyDamaged > 0) {
            newExceptions.push(createException(
                'DAMAGE', 'MEDIUM', 'TRANSFER', transferId,
                `Damage reported for ${trfLine.sku}`,
                `${draft.qtyDamaged} ${trfLine.uom} reported as damaged during GRN ${grnNo}. Notes: ${draft.notes || 'None'}`,
                actor
            ));
        }
        if (draft.qtyShort > 0) {
            newExceptions.push(createException(
                'SHORTAGE', 'HIGH', 'TRANSFER', transferId,
                `Shortage reported for ${trfLine.sku}`,
                `${draft.qtyShort} ${trfLine.uom} reported as short during GRN ${grnNo}. Notes: ${draft.notes || 'None'}`,
                actor
            ));
        }

        return trfLine;
    });

    const isFullyReceived = trf.lines.every(l => {
        const expected = l.qtyDispatched > 0 ? l.qtyDispatched : l.qtyRequested;
        return (l.qtyReceived + l.qtyDamaged + l.qtyShort) >= expected;
    });
    
    trf.status = isFullyReceived ? 'CLOSED' : 'RECEIVING';
    trf.updatedAt = now();
    trf.auditLog.push({ 
        id: uuidv4(), 
        action: 'GRN_POSTED', 
        message: `GRN ${grnNo} processed. Status: ${trf.status}`, 
        actor, 
        timestamp: now() 
    });

    grns.push(grn);
    logisticsStorage.saveGRNs(grns);
    logisticsStorage.saveTransfers(transfers);

    return { grn, exceptions: newExceptions };
}
