import { useMemo } from 'react';
import { useScmStore } from '../store/scm/useScmStore';
import { usePoStore } from '../store/scm/usePoStore';
import { useLogisticsStore } from '../store/scm/useLogisticsStore';
import { useReceivingStore } from '../store/scm/useReceivingStore';
import { useExceptionsStore } from '../store/scm/useExceptionsStore';

export interface ScmOverviewFilters {
    locationId: string | 'all' | 'global';
    timeWindowDays: number; // 7, 14, 30, 90
    supplierId?: string;
    categoryId?: string;
}

export interface KpiConfig {
    label: string;
    value: string | number;
    delta?: string;
    color: 'blue' | 'rose' | 'emerald' | 'amber' | 'slate';
    path: string;
}

export interface ScmAlert {
    id: string;
    type: 'STOCKOUT' | 'OVERDUE_PO' | 'RECEIVING_DISCREPANCY' | 'STUCK_TRANSFER' | 'DELAYED_SHIPMENT' | 'FAILED_DELIVERY';
    title: string;
    description: string;
    ageDays: number;
    severity: 'HIGH' | 'CRITICAL' | 'MEDIUM';
    path: string;
    actionLabel?: string;
}

export interface WorkQueueItem {
    id: string;
    title: string;
    subtitle: string;
    path: string;
    urgent?: boolean;
}

export interface UpcomingLine {
    id: string;
    date: Date;
    title: string;
    subtitle: string;
    metrics: string;
    path: string;
}

export function useScmOverview(filters: ScmOverviewFilters) {
    const scmStore = useScmStore();
    const poStore = usePoStore();
    const logisticsStore = useLogisticsStore();
    const receivingStore = useReceivingStore();
    const exceptionsStore = useExceptionsStore();

    const now = useMemo(() => new Date(), []);
    const windowEnd = useMemo(() => {
        const d = new Date(now);
        d.setDate(d.getDate() + filters.timeWindowDays);
        return d;
    }, [now, filters.timeWindowDays]);

    // 1. Normalize Indexes
    const productById = useMemo(() => new Map(scmStore.products.map(p => [p.id, p])), [scmStore.products]);
    const locationById = useMemo(() => new Map(scmStore.locations.map(l => [l.id, l])), [scmStore.locations]);
    const supplierById = useMemo(() => new Map(scmStore.suppliers.map(s => [s.id, s])), [scmStore.suppliers]);

    // 2. Location Scoping Helper
    const isGlobal = filters.locationId === 'all' || filters.locationId === 'global';

    // Improved helper with explicit field checking to satisfy TS
    function applyFilter<T>(items: T[], fields: (keyof T)[]): T[] {
        if (isGlobal) return items;
        return items.filter(item => fields.some(f => item[f] === (filters.locationId as any)));
    }

    // 3. Inventory KPIs
    const inventoryMetrics = useMemo(() => {
        let value = 0;
        let stockouts = 0;
        let lowStock = 0;
        let overstock = 0;

        const { criticalThreshold, lowThreshold } = scmStore.stockAlertSettings.defaultThresholds;
        const relevantInv = applyFilter(scmStore.inventory, ['locationId']);

        relevantInv.forEach(row => {
            const product = productById.get(row.productId);
            if (!product) return;

            // Product/Category filters
            if (filters.categoryId && product.category !== filters.categoryId) return;
            if (filters.supplierId && product.preferredSupplierId !== filters.supplierId) return;

            const unitCost = product.costPerUnit || 0;
            value += row.onHand * unitCost;

            const available = row.onHand - row.reserved;
            if (available <= 0) stockouts++;
            else if (available <= criticalThreshold || available <= lowThreshold) lowStock++;

            // Overstock - using a dummy maxStock or a default for now if not in row
            if (row.onHand > 500) overstock++;
        });

        return { value, stockouts, lowStock, overstock };
    }, [scmStore.inventory, scmStore.stockAlertSettings, productById, filters, isGlobal]);

    // 4. PO KPIs
    const poMetrics = useMemo(() => {
        let openCount = 0;
        let openValue = 0;
        let overdueCount = 0;

        const relevantPOs = poStore.purchaseOrders.filter(po => {
            if (filters.supplierId && po.supplierId !== filters.supplierId) return false;
            // POs don't have locationId directly, check shipToLocationId if we want to filter them too
            if (!isGlobal && po.shipToLocationId !== filters.locationId) return false;
            return true;
        });

        relevantPOs.forEach(po => {
            if (['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
                openCount++;
                openValue += po.grandTotal;

                const expected = new Date(po.expectedDeliveryDate || po.createdAt);
                if (expected < now) overdueCount++;
            }
        });

        return { openCount, openValue, overdueCount };
    }, [poStore.purchaseOrders, filters, now, isGlobal]);

    // 5. Logistics KPIs
    const logisticsMetrics = useMemo(() => {
        const transfers = applyFilter(logisticsStore.transfers, ['sourceLocationId', 'destLocationId']);
        const shipments = applyFilter(logisticsStore.shipments, ['originLocationId', 'destinationLocationId'] as any);

        let inTransit = 0;
        transfers.forEach(t => { if (['DISPATCHED', 'IN_TRANSIT'].includes(t.status)) inTransit++; });
        shipments.forEach(s => { if (['DISPATCHED', 'IN_TRANSIT'].includes(s.status)) inTransit++; });

        return { inTransit };
    }, [logisticsStore.transfers, logisticsStore.shipments, filters.locationId, isGlobal]);

    // 6. Exceptions
    const openExceptions = useMemo(() => {
        return exceptionsStore.exceptions.filter(e => e.status === 'OPEN').length;
    }, [exceptionsStore.exceptions]);

    // --- KPIs Final ---
    const kpis: KpiConfig[] = [
        { label: 'Inventory Value', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inventoryMetrics.value), color: 'blue', path: `/scm/inventory?location=${filters.locationId}` },
        { label: 'Stockouts', value: inventoryMetrics.stockouts, color: 'rose', path: `/scm/inventory?filter=stockout&location=${filters.locationId}` },
        { label: 'Low Stock', value: inventoryMetrics.lowStock, color: 'amber', path: `/scm/inventory?filter=low&location=${filters.locationId}` },
        { label: 'Overstock', value: inventoryMetrics.overstock, color: 'slate', path: `/scm/inventory?filter=overstock&location=${filters.locationId}` },
        { label: 'Open POs', value: poMetrics.openCount, delta: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(poMetrics.openValue), color: 'emerald', path: `/scm/purchase-orders?status=open` },
        { label: 'Overdue Inbound', value: poMetrics.overdueCount, color: 'rose', path: `/scm/purchase-orders?status=open&overdue=true` },
        { label: 'In Transit', value: logisticsMetrics.inTransit, color: 'blue', path: `/scm/logistics-transfers?status=in_transit&location=${filters.locationId}` },
        { label: 'Open Exceptions', value: openExceptions, color: 'amber', path: `/scm/logistics-exceptions?status=open` }
    ];

    // --- Alerts ---
    const alerts = useMemo(() => {
        const list: ScmAlert[] = [];

        // Receiving Discrepancies
        receivingStore.receipts.forEach(rcpt => {
            if (rcpt.status === 'EXCEPTION' || rcpt.lines.some(l => l.receivedQty !== l.expectedQty || l.condition !== 'GOOD')) {
                list.push({
                    id: `alert-rcpt-${rcpt.id}`,
                    type: 'RECEIVING_DISCREPANCY',
                    title: `Receiving Discrepancy: ${rcpt.sourceId}`,
                    description: `Unexpected quantity or damaged items reported.`,
                    ageDays: Math.floor((now.getTime() - new Date(rcpt.createdAt).getTime()) / 86400000),
                    severity: 'CRITICAL',
                    path: `/scm/logistics-receiving?receipt=${rcpt.id}`,
                    actionLabel: 'Resolve'
                });
            }
        });

        // Overdue POs
        poStore.purchaseOrders.forEach(po => {
            if (['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
                const expected = new Date(po.expectedDeliveryDate || po.createdAt);
                if (expected < now) {
                    list.push({
                        id: `alert-po-${po.id}`,
                        type: 'OVERDUE_PO',
                        title: `Overdue PO: ${po.poNumber}`,
                        description: `Expected on ${expected.toLocaleDateString()}`,
                        ageDays: Math.floor((now.getTime() - expected.getTime()) / 86400000),
                        severity: 'HIGH',
                        path: `/scm/purchase-orders-detail-${po.id}`,
                        actionLabel: 'Contact Supplier'
                    });
                }
            }
        });

        // Stuck Transfers
        const _48hAgo = new Date(now.getTime() - 48 * 3600000);
        logisticsStore.transfers.forEach(trf => {
            if (['DISPATCHED', 'IN_TRANSIT'].includes(trf.status) && trf.dispatchDate) {
                const dispatched = new Date(trf.dispatchDate);
                if (dispatched < _48hAgo) {
                    list.push({
                        id: `alert-trf-${trf.id}`,
                        type: 'STUCK_TRANSFER',
                        title: `Stuck Transfer: ${trf.code}`,
                        description: `In transit for >48h. Possible loss.`,
                        ageDays: Math.floor((now.getTime() - dispatched.getTime()) / 86400000),
                        severity: 'HIGH',
                        path: `/scm/logistics-transfers-detail-${trf.id}`
                    });
                }
            }
        });

        return list.sort((a, b) => {
            const severityWeight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
            if (severityWeight[a.severity] !== severityWeight[b.severity]) {
                return severityWeight[b.severity] - severityWeight[a.severity];
            }
            return b.ageDays - a.ageDays;
        }).slice(0, 10);
    }, [receivingStore.receipts, poStore.purchaseOrders, logisticsStore.transfers, now]);

    // --- Work Queues ---
    const queues = useMemo(() => {
        const procurement: WorkQueueItem[] = poStore.purchaseOrders
            .filter(po => ['DRAFT', 'PENDING_APPROVAL'].includes(po.status))
            .map(po => ({ id: po.id, title: `Approve ${po.poNumber}`, subtitle: supplierById.get(po.supplierId)?.name || po.supplierId, path: `/scm/purchase-orders-detail-${po.id}` }));

        const warehouse: WorkQueueItem[] = receivingStore.receipts
            .filter(r => ['PENDING', 'IN_PROGRESS'].includes(r.status))
            .map(r => ({ id: r.id, title: `Receive ${r.sourceId}`, subtitle: `${r.lines.length} items`, path: `/scm/logistics-receiving?receipt=${r.id}` }));

        const logistics: WorkQueueItem[] = logisticsStore.transfers
            .filter(t => ['REQUESTED', 'APPROVED'].includes(t.status))
            .map(t => ({ id: t.id, title: `Dispatch ${t.code}`, subtitle: `${locationById.get(t.destLocationId)?.name || t.destLocationId}`, path: `/scm/logistics-transfers-detail-${t.id}` }));

        return { procurement, warehouse, logistics };
    }, [poStore.purchaseOrders, receivingStore.receipts, logisticsStore.transfers, supplierById, locationById]);

    // --- Upcoming ---
    const upcoming = useMemo(() => {
        const inbound: UpcomingLine[] = [];
        const outbound: UpcomingLine[] = [];

        poStore.purchaseOrders.forEach(po => {
            const date = new Date(po.expectedDeliveryDate || po.createdAt);
            if (date >= now && date <= windowEnd) {
                inbound.push({ id: po.id, date, title: po.poNumber, subtitle: supplierById.get(po.supplierId)?.name || 'Supplier', metrics: `${po.lines.length} lines`, path: `/scm/purchase-orders-detail-${po.id}` });
            }
        });

        logisticsStore.deliveries.forEach(dlv => {
            const date = new Date(dlv.shipDate || dlv.createdAt);
            if (date >= now && date <= windowEnd) {
                outbound.push({ id: dlv.id, date, title: dlv.code, subtitle: dlv.destinationText || 'Customer', metrics: `${dlv.lines.length} items`, path: `/scm/logistics-deliveries-detail-${dlv.id}` });
            }
        });

        return { inbound, outbound };
    }, [poStore.purchaseOrders, logisticsStore.deliveries, now, windowEnd, supplierById]);

    // --- Debug Counts ---
    const debugCounts = {
        inventory: scmStore.inventory.length,
        products: scmStore.products.length,
        pos: poStore.purchaseOrders.length,
        transfers: logisticsStore.transfers.length,
        shipments: logisticsStore.shipments.length,
        receipts: receivingStore.receipts.length,
        exceptions: exceptionsStore.exceptions.length
    };

    return { kpis, alerts, queues, upcoming, debugCounts };
}
