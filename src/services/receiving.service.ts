import { grnRepo, poRepo, inventoryRepo } from '../lib/repositories/scmRepositories';
import { GRN, GRNLine, InventoryTransaction } from '../types/po';
import { poService } from './purchaseOrder.service';
import { v4 as uuidv4 } from 'uuid';

export class ReceivingService {

    createGRN(
        poId: string,
        items: { poLineId: string, qty: number, locationId: string }[],
        userId: string
    ): GRN {
        const po = poRepo.getById(poId);
        if (!po) throw new Error('PO not found');

        const grnId = uuidv4();
        const grnNumber = `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const lines: GRNLine[] = items.map(item => {
            const poLine = po.lines.find(l => l.id === item.poLineId);
            if (!poLine) throw new Error(`Invalid PO Line ${item.poLineId}`);

            return {
                poLineId: item.poLineId,
                productId: poLine.productId,
                qtyReceived: item.qty,
                uom: poLine.uom,
                locationId: item.locationId
            };
        });

        const newGRN: GRN = {
            id: grnId,
            grnNumber,
            poId,
            receiptDate: new Date().toISOString(),
            locationId: items[0].locationId,
            status: 'POSTED',
            receivedBy: userId,
            lines,
            createdAt: new Date().toISOString()
        };

        grnRepo.create(newGRN);

        lines.forEach(line => {
            if (line.productId) {
                const txn: InventoryTransaction = {
                    id: uuidv4(),
                    type: 'RECEIPT',
                    refType: 'GRN',
                    refId: grnId,
                    productId: line.productId,
                    qty: line.qtyReceived,
                    locationId: line.locationId,
                    createdAt: new Date().toISOString()
                };
                inventoryRepo.addTransaction(txn);
            }
        });

        const updatedLines = po.lines.map(line => {
            const receivedInThisGRN = lines
                .filter(gl => gl.poLineId === line.id)
                .reduce((sum, gl) => sum + gl.qtyReceived, 0);

            const newQtyReceived = line.qtyReceived + receivedInThisGRN;

            return {
                ...line,
                qtyReceived: newQtyReceived,
                status: newQtyReceived >= line.qtyOrdered ? 'RECEIVED' : (newQtyReceived > 0 ? 'PARTIALLY_RECEIVED' : 'OPEN')
            };
        });

        const allReceived = updatedLines.every((l: any) => l.qtyReceived >= l.qtyOrdered);
        const anyReceived = updatedLines.some((l: any) => l.qtyReceived > 0);

        let newStatus = po.status;
        if (allReceived) newStatus = 'RECEIVED';
        else if (anyReceived) newStatus = 'PARTIALLY_RECEIVED';

        poRepo.update(poId, {
            lines: updatedLines as any,
            status: newStatus as any
        });

        poService.updateStatusFromReceiving(poId, newStatus as any, userId);

        return newGRN;
    }
}

export const receivingService = new ReceivingService();
