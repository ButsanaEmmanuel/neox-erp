import { useRequisitionsStore } from '../store/scm/useRequisitionsStore';
import { useLogisticsStore } from '../store/scm/useLogisticsStore';
import { usePoStore } from '../store/scm/usePoStore';
import { FulfillmentRoute } from '../types/requisition';
import { v4 as uuidv4 } from 'uuid';
import { createScmRequisitionCommitment } from './scmFinanceIntegration.service';

// Helper to check stock and allocate (mock logic)
export async function handleStockAllocation(requisitionId: string, actor: string = 'System') {
    const { requisitions, allocateFromStock } = useRequisitionsStore.getState();
    const req = requisitions.find(r => r.id === requisitionId);
    if (!req) return;

    // Simulate checking inventory and reserving
    const allocations = req.lines
        .filter(l => l.qtyApproved > 0)
        .map(l => ({ lineId: l.id, qty: l.qtyApproved })); // Mock: full allocation

    allocateFromStock(req.id, allocations, actor);

    // In a real system, you would call `useScmStore.getState().reserveInventory(...)` here
}

export async function orchestrateFulfillmentRoute(requisitionId: string, route: FulfillmentRoute, actor: string = 'System') {
    const { setFulfillmentRoute } = useRequisitionsStore.getState();
    setFulfillmentRoute(requisitionId, route, actor);

    if (route === 'FROM_STOCK') {
        // Automatically allocate available stock if internal
        await handleStockAllocation(requisitionId, actor);
    }

    if (route === 'PROCUREMENT_PO') {
        const req = useRequisitionsStore.getState().requisitions.find(r => r.id === requisitionId);
        if (req) {
            const estimated = req.lines.reduce((sum, line) => sum + Number(line.estimatedCost || 0) * Number(line.qtyApproved || line.qtyRequested || 0), 0);
            if (estimated > 0) {
                try {
                    await createScmRequisitionCommitment({
                        requisitionId: req.id,
                        requisitionCode: req.code,
                        amount: estimated,
                        currencyCode: req.lines.find((l) => l.currency)?.currency || 'USD',
                        neededBy: req.neededBy,
                        memo: 'Requisition ' + req.code + ' routed to Procurement PO',
                    });
                } catch (error) {
                    console.error('Failed to sync requisition commitment to finance', error);
                }
            }
        }
    }
}

export async function createPOForRequisition(requisitionId: string, supplierId: string, actor: string = 'Current User'): Promise<string | undefined> {
    const reqStore = useRequisitionsStore.getState();
    const poStore = usePoStore.getState();

    const req = reqStore.requisitions.find(r => r.id === requisitionId);
    if (!req) return;

    // Use current date
    const today = new Date();
    const expectedDelivery = new Date(today);
    expectedDelivery.setDate(today.getDate() + 7); // Default 7 days lead time

    const dto: import('../types/po').CreatePODTO = {
        supplierId,
        shipToLocationId: req.requestedForLocationId,
        currency: 'USD',
        paymentTerms: 'Net 30',
        expectedDeliveryDate: expectedDelivery.toISOString().split('T')[0],
        notes: `Created from Requisition ${req.code}. ${req.justification || ''}`,
        lines: req.lines.map(l => ({
            productId: l.productId || null,
            itemCode: l.sku || 'SERVICE',
            description: l.description || l.serviceName || 'No description',
            uom: l.uom || (req.type === 'STOCK' ? 'ea' : 'svc'),
            qtyOrdered: l.qtyApproved,
            unitPrice: l.estimatedCost || 0,
            discount: 0,
            taxCode: 'VAT0', // Default zero tax for internal
        }))
    };

    try {
        const poId = await poStore.createPO(dto);

        // Link back
        reqStore.linkToPO(req.id, poId, actor);
        return poId;
    } catch (error) {
        console.error('Failed to create PO from requisition:', error);
        throw error;
    }
}

export async function createTransferForRequisition(requisitionId: string, sourceLocationId: string, actor: string = 'Current User'): Promise<string | undefined> {
    const reqStore = useRequisitionsStore.getState();
    const logsStore = useLogisticsStore.getState();

    const req = reqStore.requisitions.find(r => r.id === requisitionId);
    if (!req) return;

    const transferId = uuidv4();
    const seq = String(logsStore.transfers.length + 1).padStart(4, '0');
    const trfCode = `TRF-2026-${seq}`;

    const trfLines: import('../types/logistics').TransferLine[] = req.lines
        .filter(l => l.qtyApproved > 0)
        .map(l => ({
            id: uuidv4(),
            itemId: l.productId || 'SERVICE', // Aligned with TransferLine
            sku: l.sku || '',
            description: l.description || l.serviceName || '',
            uom: l.uom || 'ea',
            qtyRequested: l.qtyApproved,
            qtyPicked: 0,
            qtyDispatched: 0,
            qtyReceived: 0,
            qtyDamaged: 0,
            qtyShort: 0
        }));

    const newTransfer: import('../types/logistics').Transfer = {
        id: transferId,
        code: trfCode,
        status: 'REQUESTED', // Aligned with TransferStatus
        sourceLocationId: sourceLocationId,
        destLocationId: req.requestedForLocationId,
        requestedBy: actor,
        neededDate: req.neededBy || new Date().toISOString(),
        lines: trfLines,
        attachments: [],
        exceptionIds: [],
        auditLog: [{
            id: uuidv4(),
            action: 'CREATED',
            message: `Created from Requisition ${req.code}`,
            actor,
            timestamp: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await logsStore.saveTransfer(newTransfer);
    reqStore.linkToTransfer(req.id, transferId, actor);

    return transferId;
}
