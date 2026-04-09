import { poRepo } from '../lib/repositories/scmRepositories';
import { PurchaseOrder, POStatus, CreatePODTO, UpdatePODTO, PurchaseOrderLine } from '../types/po';
import { v4 as uuidv4 } from 'uuid';

export class PurchaseOrderService {

    // --- QUERY ---
    getAllPOs(): PurchaseOrder[] {
        return poRepo.getAll();
    }

    getPOById(id: string): PurchaseOrder | undefined {
        return poRepo.getById(id);
    }

    // --- COMPUTATION ---
    private computeTotals(lines: PurchaseOrderLine[]): {
        subtotal: number;
        taxTotal: number;
        discountTotal: number;
        grandTotal: number
    } {
        let subtotal = 0;
        let taxTotal = 0;
        let discountTotal = 0;

        lines.forEach(line => {
            const lineSub = line.qtyOrdered * line.unitPrice;
            const lineDisc = (lineSub * (line.discount || 0)) / 100;
            const taxable = lineSub - lineDisc;
            // Simplified tax calc (assuming taxCode is % for now, e.g. "VAT20" -> 20)
            const taxRate = parseFloat(line.taxCode.replace(/[^0-9.]/g, '')) || 0;
            const lineTax = (taxable * taxRate) / 100;

            subtotal += lineSub;
            discountTotal += lineDisc;
            taxTotal += lineTax;
        });

        return {
            subtotal,
            taxTotal,
            discountTotal,
            grandTotal: subtotal - discountTotal + taxTotal // + freight (handled separately usually)
        };
    }

    // --- ACTIONS ---
    createPO(dto: CreatePODTO, userId: string = 'user-1'): PurchaseOrder {
        const id = uuidv4();
        const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Map DTO lines to internal structure
        const lines: PurchaseOrderLine[] = dto.lines.map(l => ({
            ...l,
            id: uuidv4(),
            poId: id,
            qtyReceived: 0,
            status: 'OPEN',
            lineTotal: (l.qtyOrdered * l.unitPrice) * (1 - (l.discount || 0) / 100), // Approx
            taxAmount: 0 // Recomputed below
        }));

        const totals = this.computeTotals(lines);

        const newPO: PurchaseOrder = {
            id,
            poNumber,
            supplierId: dto.supplierId,
            shipToLocationId: dto.shipToLocationId,
            currency: dto.currency,
            paymentTerms: dto.paymentTerms,
            orderDate: new Date().toISOString(),
            expectedDeliveryDate: dto.expectedDeliveryDate,
            status: 'DRAFT',
            notes: dto.notes,

            subtotal: totals.subtotal,
            taxTotal: totals.taxTotal,
            discountTotal: totals.discountTotal,
            freightTotal: 0,
            grandTotal: totals.grandTotal,

            createdBy: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            revision: 1,
            auditLog: [{
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'CREATED',
                meta: { poNumber }
            }],
            lines
        };

        poRepo.create(newPO);
        return newPO;
    }

    updatePO(id: string, updates: UpdatePODTO, userId: string): PurchaseOrder {
        const po = poRepo.getById(id);
        if (!po) throw new Error('PO not found');
        if (po.status !== 'DRAFT') throw new Error('Only DRAFT POs can be edited');

        // Logic to update lines would go here (complex merge), simplified for now
        // Assuming updates might include re-calc

        const updatedPO = {
            ...po,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Re-calc totals if lines changed
        if (updates.lines) {
            // In a real app, we would re-validate and re-calculate everything here.
            // For MVP, we assume the DTO is fully formed with correct line calculations from the UI
            // or we re-run computeTotals here.

            // Re-calculate totals based on new lines
            const totals = this.computeTotals(updates.lines as PurchaseOrderLine[]);
            Object.assign(updatedPO, totals);
        }

        poRepo.update(id, updatedPO as PurchaseOrder);
        return updatedPO as PurchaseOrder;
    }

    // --- STATUS TRANSITIONS ---

    submit(id: string, userId: string): void {
        const po = poRepo.getById(id);
        if (!po || po.status !== 'DRAFT') throw new Error('Invalid transition');

        poRepo.update(id, {
            status: 'PENDING_APPROVAL',
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'SUBMITTED'
            }]
        });
    }

    approve(id: string, userId: string): void {
        const po = poRepo.getById(id);
        if (!po || po.status !== 'PENDING_APPROVAL') throw new Error('Invalid transition');

        poRepo.update(id, {
            status: 'APPROVED',
            approvedBy: userId,
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'APPROVED'
            }]
        });
    }

    reject(id: string, userId: string, reason: string): void {
        const po = poRepo.getById(id);
        if (!po || po.status !== 'PENDING_APPROVAL') throw new Error('Invalid transition');

        poRepo.update(id, {
            status: 'REJECTED',
            updatedAt: new Date().toISOString(),
            changeReason: reason,
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'REJECTED', // Keep it REJECTED, user can then choose to close it manually
                meta: { reason }
            }]
        });
    }

    send(id: string, userId: string): void {
        const po = poRepo.getById(id);
        if (!po || po.status !== 'APPROVED') throw new Error('Invalid transition');

        poRepo.update(id, {
            status: 'SENT',
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'SENT'
            }]
        });
    }

    acknowledge(id: string, userId: string): void {
        const po = poRepo.getById(id);
        if (!po || po.status !== 'SENT') throw new Error('Invalid transition');

        poRepo.update(id, {
            status: 'ACKNOWLEDGED',
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'ACKNOWLEDGED'
            }]
        });
    }

    close(id: string, userId: string): void {
        const po = poRepo.getById(id);
        if (!po || (po.status !== 'RECEIVED' && po.status !== 'REJECTED')) {
            throw new Error('PO can only be closed if it is RECEIVED or REJECTED');
        }

        poRepo.update(id, {
            status: 'CLOSED',
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'CLOSED'
            }]
        });
    }

    // Called by ReceivingService
    updateStatusFromReceiving(id: string, status: POStatus, userId: string): void {
        // Validation handled by caller usually
        const po = poRepo.getById(id);
        if (!po) return;

        poRepo.update(id, {
            status: status,
            updatedAt: new Date().toISOString(),
            auditLog: [...po.auditLog, {
                timestamp: new Date().toISOString(),
                actor: userId,
                action: 'STATUS_AUTO_UPDATE',
                meta: { newStatus: status }
            }]
        });
    }
}

export const poService = new PurchaseOrderService();

