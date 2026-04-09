/**
 * Exception Orchestrator — issue logging, resolution workflow, hold/unhold management.
 */
import { logisticsStorage } from '../lib/storage/logisticsStorage';
import {
    ExceptionCase, ExceptionType, ExceptionStatus,
    ResolutionActionType, ExceptionResolution,
    Shipment, Transfer, Delivery
} from '../types/logistics';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date().toISOString();

// ── Policy: which combinations are blocking ──────────────────────────
const ALWAYS_BLOCKING_TYPES: ExceptionType[] = ['DAMAGE', 'SHORTAGE', 'QUALITY_FAIL', 'POD_MISSING', 'WRONG_ITEM', 'REFUSED_DELIVERY'];

export function isBlocking(type: ExceptionType, severity: string): boolean {
    if (severity === 'HIGH' || severity === 'CRITICAL') return true;
    if (severity === 'MEDIUM' && ALWAYS_BLOCKING_TYPES.includes(type)) return true;
    return false;
}

// ── Transition guards ────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<ExceptionStatus, ExceptionStatus[]> = {
    OPEN: ['UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
    UNDER_REVIEW: ['RESOLVED', 'CLOSED', 'OPEN'],
    RESOLVED: ['CLOSED', 'OPEN'],
    CLOSED: [],
};

export function canTransitionException(current: ExceptionStatus, next: ExceptionStatus): boolean {
    return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

// ── Log Issue ────────────────────────────────────────────────────────
export interface LogIssuePayload {
    type: ExceptionType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    details: string;
    linkedEntityType: ExceptionCase['linkedEntityType'];
    linkedEntityId: string;
    linkedLineId?: string;
    assignedTo?: string;
    dueDate?: string;
    createdBy: string;
}

export function logIssue(payload: LogIssuePayload): ExceptionCase {
    const exceptions = logisticsStorage.getExceptions();
    const seq = String(exceptions.length + 1).padStart(4, '0');

    const exc: ExceptionCase = {
        id: uuidv4(),
        code: `EXC-${new Date().getFullYear()}-${seq}`,
        type: payload.type,
        status: 'OPEN',
        severity: payload.severity,
        linkedEntityType: payload.linkedEntityType,
        linkedEntityId: payload.linkedEntityId,
        linkedLineId: payload.linkedLineId,
        summary: payload.summary,
        details: payload.details,
        createdBy: payload.createdBy,
        assignedTo: payload.assignedTo,
        dueDate: payload.dueDate,
        attachments: [],
        auditLog: [{
            id: uuidv4(), action: 'CREATED',
            message: `Exception logged: ${payload.summary}`,
            actor: payload.createdBy, timestamp: now()
        }],
        createdAt: now(),
        updatedAt: now()
    };

    exceptions.push(exc);
    logisticsStorage.saveExceptions(exceptions);

    // Link to entity
    linkExceptionToEntity(exc);

    // Recompute hold
    if (isBlocking(exc.type, exc.severity)) {
        applyHoldToEntity(exc.linkedEntityType, exc.linkedEntityId);
    }

    return exc;
}

// ── Transition Exception ─────────────────────────────────────────────
export function transitionException(
    id: string,
    next: ExceptionStatus,
    resolution?: { actionType: ResolutionActionType; notes?: string },
    actor = 'Current User'
): ExceptionCase {
    const exceptions = logisticsStorage.getExceptions();
    const exc = exceptions.find(e => e.id === id);
    if (!exc) throw new Error('Exception not found');
    if (!canTransitionException(exc.status, next)) throw new Error(`Cannot transition from ${exc.status} to ${next}`);

    exc.status = next;
    exc.updatedAt = now();

    if (next === 'RESOLVED' && resolution) {
        exc.resolution = {
            actionType: resolution.actionType,
            notes: resolution.notes,
            resolvedAt: now(),
            resolvedBy: actor
        };
        exc.auditLog.push({
            id: uuidv4(), action: 'RESOLVED',
            message: `Resolved with action: ${resolution.actionType}${resolution.notes ? ' — ' + resolution.notes : ''}`,
            actor, timestamp: now()
        });

        // Recompute hold on entity
        recomputeHoldForEntity(exc.linkedEntityType, exc.linkedEntityId);

        // Add audit event to linked entity
        addAuditToLinkedEntity(exc.linkedEntityType, exc.linkedEntityId,
            'EXCEPTION_RESOLVED', `Exception ${exc.code} resolved: ${resolution.actionType}`, actor);
    } else if (next === 'UNDER_REVIEW') {
        exc.auditLog.push({ id: uuidv4(), action: 'UNDER_REVIEW', message: 'Exception under review', actor, timestamp: now() });
    } else if (next === 'CLOSED') {
        exc.auditLog.push({ id: uuidv4(), action: 'CLOSED', message: 'Exception closed', actor, timestamp: now() });
        recomputeHoldForEntity(exc.linkedEntityType, exc.linkedEntityId);
    }

    logisticsStorage.saveExceptions(exceptions);
    return exc;
}

// ── Assign ───────────────────────────────────────────────────────────
export function assignException(id: string, assignedTo: string, actor = 'Current User'): ExceptionCase {
    const exceptions = logisticsStorage.getExceptions();
    const exc = exceptions.find(e => e.id === id);
    if (!exc) throw new Error('Exception not found');

    exc.assignedTo = assignedTo;
    exc.updatedAt = now();
    exc.auditLog.push({ id: uuidv4(), action: 'ASSIGNED', message: `Assigned to ${assignedTo}`, actor, timestamp: now() });

    logisticsStorage.saveExceptions(exceptions);
    return exc;
}

// ── Delete ───────────────────────────────────────────────────────────
export function deleteException(id: string): void {
    const exceptions = logisticsStorage.getExceptions();
    const exc = exceptions.find(e => e.id === id);
    if (exc) {
        // Unlink from entity
        unlinkExceptionFromEntity(exc);
        recomputeHoldForEntity(exc.linkedEntityType, exc.linkedEntityId);
    }
    logisticsStorage.saveExceptions(exceptions.filter(e => e.id !== id));
}

// ── Hold Management ──────────────────────────────────────────────────
export function recomputeHoldForEntity(entityType: string, entityId: string): void {
    const exceptions = logisticsStorage.getExceptions();
    const openBlockingExceptions = exceptions.filter(e =>
        e.linkedEntityId === entityId &&
        (e.status === 'OPEN' || e.status === 'UNDER_REVIEW') &&
        isBlocking(e.type, e.severity)
    );

    const hasBlockingIssues = openBlockingExceptions.length > 0;

    if (entityType === 'SHIPMENT') {
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === entityId);
        if (!shp) return;

        if (hasBlockingIssues && shp.status !== 'EXCEPTION_HOLD') {
            shp.statusBeforeHold = shp.status;
            shp.status = 'EXCEPTION_HOLD';
            shp.updatedAt = now();
        } else if (!hasBlockingIssues && shp.status === 'EXCEPTION_HOLD') {
            shp.status = shp.statusBeforeHold || 'IN_TRANSIT';
            shp.statusBeforeHold = undefined;
            shp.updatedAt = now();
        }
        logisticsStorage.saveShipments(shipments);
    } else if (entityType === 'TRANSFER') {
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === entityId);
        if (!trf) return;

        if (hasBlockingIssues && trf.status !== 'EXCEPTION_HOLD') {
            trf.statusBeforeHold = trf.status;
            trf.status = 'EXCEPTION_HOLD';
            trf.updatedAt = now();
        } else if (!hasBlockingIssues && trf.status === 'EXCEPTION_HOLD') {
            trf.status = trf.statusBeforeHold || 'DISPATCHED';
            trf.statusBeforeHold = undefined;
            trf.updatedAt = now();
        }
        logisticsStorage.saveTransfers(transfers);
    } else if (entityType === 'DELIVERY') {
        const deliveries = logisticsStorage.getDeliveries();
        const dlv = deliveries.find(d => d.id === entityId);
        if (!dlv) return;

        if (hasBlockingIssues && dlv.status !== 'EXCEPTION_HOLD') {
            dlv.statusBeforeHold = dlv.status;
            dlv.status = 'EXCEPTION_HOLD';
            dlv.updatedAt = now();
        } else if (!hasBlockingIssues && dlv.status === 'EXCEPTION_HOLD') {
            dlv.status = dlv.statusBeforeHold || 'SHIPPED';
            dlv.statusBeforeHold = undefined;
            dlv.updatedAt = now();
        }
        logisticsStorage.saveDeliveries(deliveries);
    }
}

function applyHoldToEntity(entityType: string, entityId: string): void {
    recomputeHoldForEntity(entityType, entityId);
}

// ── Link/Unlink helpers ──────────────────────────────────────────────
function linkExceptionToEntity(exc: ExceptionCase): void {
    if (exc.linkedEntityType === 'SHIPMENT' || exc.linkedEntityType === 'SHIPMENT_LINE') {
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === exc.linkedEntityId);
        if (shp && !shp.exceptionIds.includes(exc.id)) {
            shp.exceptionIds.push(exc.id);
            shp.updatedAt = now();
            logisticsStorage.saveShipments(shipments);
        }
    } else if (exc.linkedEntityType === 'TRANSFER') {
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === exc.linkedEntityId);
        if (trf && !trf.exceptionIds.includes(exc.id)) {
            trf.exceptionIds.push(exc.id);
            trf.updatedAt = now();
            logisticsStorage.saveTransfers(transfers);
        }
    } else if (exc.linkedEntityType === 'DELIVERY') {
        const deliveries = logisticsStorage.getDeliveries();
        const dlv = deliveries.find(d => d.id === exc.linkedEntityId);
        if (dlv && !dlv.exceptionIds.includes(exc.id)) {
            dlv.exceptionIds.push(exc.id);
            dlv.updatedAt = now();
            logisticsStorage.saveDeliveries(deliveries);
        }
    }
}

function unlinkExceptionFromEntity(exc: ExceptionCase): void {
    if (exc.linkedEntityType === 'SHIPMENT' || exc.linkedEntityType === 'SHIPMENT_LINE') {
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === exc.linkedEntityId);
        if (shp) {
            shp.exceptionIds = shp.exceptionIds.filter(id => id !== exc.id);
            logisticsStorage.saveShipments(shipments);
        }
    } else if (exc.linkedEntityType === 'TRANSFER') {
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === exc.linkedEntityId);
        if (trf) {
            trf.exceptionIds = trf.exceptionIds.filter(id => id !== exc.id);
            logisticsStorage.saveTransfers(transfers);
        }
    } else if (exc.linkedEntityType === 'DELIVERY') {
        const deliveries = logisticsStorage.getDeliveries();
        const dlv = deliveries.find(d => d.id === exc.linkedEntityId);
        if (dlv) {
            dlv.exceptionIds = dlv.exceptionIds.filter(id => id !== exc.id);
            logisticsStorage.saveDeliveries(deliveries);
        }
    }
}

// ── Audit helper ─────────────────────────────────────────────────────
function addAuditToLinkedEntity(entityType: string, entityId: string, action: string, message: string, actor: string): void {
    const event = { id: uuidv4(), action, message, actor, timestamp: now() };

    if (entityType === 'SHIPMENT' || entityType === 'SHIPMENT_LINE') {
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === entityId);
        if (shp) { shp.auditLog.push(event); logisticsStorage.saveShipments(shipments); }
    } else if (entityType === 'TRANSFER') {
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === entityId);
        if (trf) { trf.auditLog.push(event); logisticsStorage.saveTransfers(transfers); }
    } else if (entityType === 'DELIVERY') {
        const deliveries = logisticsStorage.getDeliveries();
        const dlv = deliveries.find(d => d.id === entityId);
        if (dlv) { dlv.auditLog.push(event); logisticsStorage.saveDeliveries(deliveries); }
    }
}

// ── Resolution entity code lookup ────────────────────────────────────
export function getLinkedEntityCode(entityType: string, entityId: string): string {
    if (entityType === 'SHIPMENT' || entityType === 'SHIPMENT_LINE') {
        return logisticsStorage.getShipments().find(s => s.id === entityId)?.code || entityId;
    } else if (entityType === 'TRANSFER') {
        return logisticsStorage.getTransfers().find(t => t.id === entityId)?.code || entityId;
    } else if (entityType === 'DELIVERY') {
        return logisticsStorage.getDeliveries().find(d => d.id === entityId)?.code || entityId;
    }
    return entityId;
}
