import React, { useMemo } from 'react';
import { PurchaseOrder, POStatus, PO_STATUS_LABELS } from '../../../types/po';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { clsx } from 'clsx';
// For correct DND implementation, we'd ideally use SortableContext, but keeping it simple for MVP first pass

interface POBoardViewProps {
    purchaseOrders: PurchaseOrder[];
    isLoading: boolean;
    onNavigate?: (view: string) => void;
}

const COLUMNS: POStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'];

export const POBoardView: React.FC<POBoardViewProps> = ({ purchaseOrders, isLoading, onNavigate }) => {
    // Group POs by status
    const columns = useMemo(() => {
        const groups: Record<POStatus, PurchaseOrder[]> = {} as any;
        COLUMNS.forEach(c => groups[c] = []);
        purchaseOrders.forEach(po => {
            if (groups[po.status]) groups[po.status].push(po);
        });
        return groups;
    }, [purchaseOrders]);

    return (
        <div className="h-full overflow-x-auto p-6 whitespace-nowrap">
            <div className="flex gap-4 h-full">
                {COLUMNS.map(status => (
                    <Column key={status} status={status} items={columns[status] || []} onNavigate={onNavigate} />
                ))}
            </div>
        </div>
    );
};

const Column: React.FC<{ status: POStatus; items: PurchaseOrder[]; onNavigate?: (view: string) => void }> = ({ status, items, onNavigate }) => {
    return (
        <div className="w-80 flex-none flex flex-col h-full bg-surface/50 border border-border/60 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-border/60 flex items-center justify-between bg-surface">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">{PO_STATUS_LABELS[status]}</span>
                    <span className="bg-surface text-secondary text-[10px] px-1.5 py-0.5 rounded font-mono">{items.length}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {items.map(po => <POCard key={po.id} po={po} onNavigate={onNavigate} />)}
            </div>
        </div>
    );
};

const POCard: React.FC<{ po: PurchaseOrder; onNavigate?: (view: string) => void }> = ({ po, onNavigate }) => {
    const setSelectedPoId = usePoStore(state => state.setSelectedPoId);
    const { suppliers, locations } = useScmStore();

    // Calc received %
    const totalOrdered = po.lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
    const totalReceived = po.lines.reduce((sum, l) => sum + l.qtyReceived, 0);
    const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    const supplier = suppliers.find(s => s.id === po.supplierId);
    const location = locations.find(l => l.id === po.shipToLocationId);

    return (
        <div
            onClick={() => {
                setSelectedPoId(po.id);
                onNavigate?.('scm-purchase-orders-detail');
            }}
            className="bg-app border border-border p-3 rounded-lg shadow-sm hover:border-blue-500/30 hover:shadow-md cursor-pointer transition-all group active:scale-95 whitespace-normal"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-blue-400 font-mono group-hover:underline">{po.poNumber}</span>
                <span className="text-[10px] text-muted">{format(new Date(po.orderDate), 'MMM d')}</span>
            </div>
            <div className="text-sm font-medium text-primary mb-1 truncate">{supplier?.name || po.supplierId}</div>
            <div className="text-xs text-muted mb-3 truncate">📍 {location?.name || po.shipToLocationId}</div>

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <span className="text-xs font-mono font-bold text-secondary">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(po.grandTotal)}
                </span>
                {receivedPct > 0 && (
                    <div className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {receivedPct}% Rcvd
                    </div>
                )}
            </div>
        </div>
    );
};



