import {
    Shipment, Transfer, Delivery, ExceptionCase, GRN,
    ShipmentStatus, TransferStatus, DeliveryStatus, ExceptionStatus
} from '../types/logistics';
import { logisticsStorage } from '../lib/storage/logisticsStorage';
import { v4 as uuidv4 } from 'uuid';

const getRandomDelay = () => Math.floor(Math.random() * (400 - 150 + 1) + 150);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class LogisticsService {
    // --- Shipments ---
    async getShipments(): Promise<Shipment[]> {
        await delay(getRandomDelay());
        return logisticsStorage.getShipments();
    }

    async saveShipment(shipment: Shipment): Promise<Shipment> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const existing = shipments.findIndex(s => s.id === shipment.id);

        let savedShipment = { ...shipment, updatedAt: new Date().toISOString() };
        if (existing >= 0) {
            shipments[existing] = savedShipment;
        } else {
            savedShipment.createdAt = new Date().toISOString();
            shipments.push(savedShipment);
        }

        logisticsStorage.saveShipments(shipments);
        return savedShipment;
    }

    async transitionShipmentStatus(id: string, newStatus: ShipmentStatus, actor: string): Promise<Shipment> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === id);
        if (!shp) throw new Error('Shipment not found');

        shp.status = newStatus;
        shp.updatedAt = new Date().toISOString();
        shp.auditLog.push({
            id: uuidv4(),
            action: `STATUS_CHANGED_${newStatus}`,
            message: `Status changed to ${newStatus}`,
            actor,
            timestamp: new Date().toISOString()
        });

        logisticsStorage.saveShipments(shipments);
        return shp;
    }

    async deleteShipment(id: string): Promise<void> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const filtered = shipments.filter(s => s.id !== id);
        logisticsStorage.saveShipments(filtered);
    }

    async addShipmentAudit(id: string, action: string, message: string, actor: string): Promise<Shipment> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === id);
        if (!shp) throw new Error('Shipment not found');

        shp.auditLog.push({
            id: uuidv4(),
            action,
            message,
            actor,
            timestamp: new Date().toISOString()
        });
        shp.updatedAt = new Date().toISOString();
        logisticsStorage.saveShipments(shipments);
        return shp;
    }

    async addShipmentAttachment(id: string, attachment: Omit<import('../types/logistics').Attachment, 'id' | 'createdAt'>): Promise<Shipment> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === id);
        if (!shp) throw new Error('Shipment not found');

        shp.attachments.push({
            ...attachment,
            id: uuidv4(),
            createdAt: new Date().toISOString()
        });
        shp.updatedAt = new Date().toISOString();
        logisticsStorage.saveShipments(shipments);
        return shp;
    }

    async createExceptionFromShipment(shipmentId: string, exception: ExceptionCase): Promise<{ shipment: Shipment, exception: ExceptionCase }> {
        await delay(getRandomDelay());
        const shipments = logisticsStorage.getShipments();
        const shp = shipments.find(s => s.id === shipmentId);
        if (!shp) throw new Error('Shipment not found');

        // Create exception
        const exceptions = logisticsStorage.getExceptions();
        const newException = {
            ...exception,
            id: exception.id || uuidv4(),
            linkedEntityType: 'SHIPMENT' as const,
            linkedEntityId: shipmentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        exceptions.push(newException);
        logisticsStorage.saveExceptions(exceptions);

        // Update shipment
        shp.exceptionIds.push(newException.id);
        shp.updatedAt = new Date().toISOString();
        logisticsStorage.saveShipments(shipments);

        return { shipment: shp, exception: newException };
    }

    // --- Transfers ---
    async getTransfers(): Promise<Transfer[]> {
        await delay(getRandomDelay());
        return logisticsStorage.getTransfers();
    }

    async saveTransfer(transfer: Transfer): Promise<Transfer> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const existing = transfers.findIndex(t => t.id === transfer.id);

        let savedTransfer = { ...transfer, updatedAt: new Date().toISOString() };
        if (existing >= 0) {
            transfers[existing] = savedTransfer;
        } else {
            // Idempotency: skip if a transfer with the same code already exists
            const isDuplicate = transfers.some(t => t.code === transfer.code);
            if (!isDuplicate) {
                savedTransfer.createdAt = new Date().toISOString();
                transfers.push(savedTransfer);
            } else {
                return transfers.find(t => t.code === transfer.code)!;
            }
        }

        logisticsStorage.saveTransfers(transfers);
        return savedTransfer;
    }

    async transitionTransferStatus(id: string, newStatus: TransferStatus, actor: string): Promise<Transfer> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === id);
        if (!trf) throw new Error('Transfer not found');

        trf.status = newStatus;
        trf.updatedAt = new Date().toISOString();
        trf.auditLog.push({
            id: uuidv4(),
            action: `STATUS_CHANGED_${newStatus}`,
            message: `Status changed to ${newStatus}`,
            actor,
            timestamp: new Date().toISOString()
        });

        logisticsStorage.saveTransfers(transfers);
        return trf;
    }

    async deleteTransfer(id: string): Promise<void> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const filtered = transfers.filter(t => t.id !== id);
        logisticsStorage.saveTransfers(filtered);
    }

    async addTransferAudit(id: string, action: string, message: string, actor: string): Promise<Transfer> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === id);
        if (!trf) throw new Error('Transfer not found');

        trf.auditLog.push({
            id: uuidv4(),
            action,
            message,
            actor,
            timestamp: new Date().toISOString()
        });
        trf.updatedAt = new Date().toISOString();
        logisticsStorage.saveTransfers(transfers);
        return trf;
    }

    async addTransferAttachment(id: string, attachment: Omit<import('../types/logistics').Attachment, 'id' | 'createdAt'>): Promise<Transfer> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === id);
        if (!trf) throw new Error('Transfer not found');

        trf.attachments.push({
            ...attachment,
            id: uuidv4(),
            createdAt: new Date().toISOString()
        });
        trf.updatedAt = new Date().toISOString();
        logisticsStorage.saveTransfers(transfers);
        return trf;
    }

    async createExceptionFromTransfer(transferId: string, exception: ExceptionCase): Promise<{ transfer: Transfer, exception: ExceptionCase }> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === transferId);
        if (!trf) throw new Error('Transfer not found');

        // Create exception
        const exceptions = logisticsStorage.getExceptions();
        const newException = {
            ...exception,
            id: exception.id || uuidv4(),
            linkedEntityType: 'TRANSFER' as const,
            linkedEntityId: transferId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        exceptions.push(newException);
        logisticsStorage.saveExceptions(exceptions);

        // Update transfer
        trf.exceptionIds.push(newException.id);
        trf.updatedAt = new Date().toISOString();
        logisticsStorage.saveTransfers(transfers);

        return { transfer: trf, exception: newException };
    }

    async recordTransferReceiving(id: string, lines: { lineId: string, qtyReceived: number, qtyDamaged: number, qtyShort: number }[], receivedBy: string): Promise<Transfer> {
        await delay(getRandomDelay());
        const transfers = logisticsStorage.getTransfers();
        const trf = transfers.find(t => t.id === id);
        if (!trf) throw new Error('Transfer not found');

        let hasDiscrepancy = false;

        trf.lines = trf.lines.map(line => {
            const updateLine = lines.find(l => l.lineId === line.id);
            if (updateLine) {
                const newQtyReceived = (line.qtyReceived || 0) + updateLine.qtyReceived;
                const newQtyDamaged = (line.qtyDamaged || 0) + updateLine.qtyDamaged;
                const newQtyShort = (line.qtyShort || 0) + updateLine.qtyShort;

                if (updateLine.qtyDamaged > 0 || updateLine.qtyShort > 0) {
                    hasDiscrepancy = true;
                }

                return {
                    ...line,
                    qtyReceived: newQtyReceived,
                    qtyDamaged: newQtyDamaged,
                    qtyShort: newQtyShort
                };
            }
            return line;
        });

        trf.status = hasDiscrepancy ? 'EXCEPTION_HOLD' : 'RECEIVED';
        trf.updatedAt = new Date().toISOString();

        trf.auditLog.push({
            id: uuidv4(),
            action: hasDiscrepancy ? 'RECEIVING_DISCREPANCY' : 'RECEIVED',
            message: hasDiscrepancy ? 'Received transfer items with discrepancies' : 'Received all transfer items successfully',
            actor: receivedBy,
            timestamp: new Date().toISOString()
        });

        logisticsStorage.saveTransfers(transfers);
        return trf;
    }

    // --- Deliveries ---
    async getDeliveries(): Promise<Delivery[]> {
        await delay(getRandomDelay());
        return logisticsStorage.getDeliveries();
    }

    async saveDelivery(delivery: Delivery): Promise<Delivery> {
        await delay(getRandomDelay());
        const deliveries = logisticsStorage.getDeliveries();
        const existing = deliveries.findIndex(d => d.id === delivery.id);

        let savedDelivery = { ...delivery, updatedAt: new Date().toISOString() };
        if (existing >= 0) {
            deliveries[existing] = savedDelivery;
        } else {
            savedDelivery.createdAt = new Date().toISOString();
            deliveries.push(savedDelivery);
        }

        logisticsStorage.saveDeliveries(deliveries);
        return savedDelivery;
    }

    async transitionDeliveryStatus(id: string, newStatus: DeliveryStatus, actor: string): Promise<Delivery> {
        await delay(getRandomDelay());
        const deliveries = logisticsStorage.getDeliveries();
        const del = deliveries.find(d => d.id === id);
        if (!del) throw new Error('Delivery not found');

        del.status = newStatus;
        del.updatedAt = new Date().toISOString();
        del.auditLog.push({
            id: uuidv4(),
            action: `STATUS_CHANGED_${newStatus}`,
            message: `Status changed to ${newStatus}`,
            actor,
            timestamp: new Date().toISOString()
        });

        logisticsStorage.saveDeliveries(deliveries);
        return del;
    }

    // --- Exceptions ---
    async getExceptions(): Promise<ExceptionCase[]> {
        await delay(getRandomDelay());
        return logisticsStorage.getExceptions();
    }

    async saveException(exception: ExceptionCase): Promise<ExceptionCase> {
        await delay(getRandomDelay());
        const exceptions = logisticsStorage.getExceptions();
        const existing = exceptions.findIndex(e => e.id === exception.id);

        let savedException = { ...exception, updatedAt: new Date().toISOString() };
        if (existing >= 0) {
            exceptions[existing] = savedException;
        } else {
            savedException.createdAt = new Date().toISOString();
            exceptions.push(savedException);
        }

        logisticsStorage.saveExceptions(exceptions);
        return savedException;
    }

    async transitionExceptionStatus(id: string, newStatus: ExceptionStatus, actor: string): Promise<ExceptionCase> {
        await delay(getRandomDelay());
        const exceptions = logisticsStorage.getExceptions();
        const exc = exceptions.find(e => e.id === id);
        if (!exc) throw new Error('Exception not found');

        exc.status = newStatus;
        exc.updatedAt = new Date().toISOString();
        exc.auditLog.push({
            id: uuidv4(),
            action: `STATUS_CHANGED_${newStatus}`,
            message: `Status changed to ${newStatus}`,
            actor,
            timestamp: new Date().toISOString()
        });

        logisticsStorage.saveExceptions(exceptions);
        return exc;
    }

    // --- GRN (Receiving) ---
    async getGRNs(): Promise<GRN[]> {
        await delay(getRandomDelay());
        return logisticsStorage.getGRNs();
    }

    async saveGRN(grn: GRN): Promise<GRN> {
        await delay(getRandomDelay());
        const grns = logisticsStorage.getGRNs();
        grns.push(grn);
        logisticsStorage.saveGRNs(grns);
        return grn;
    }
}

export const logisticsService = new LogisticsService();
