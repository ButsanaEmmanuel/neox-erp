import React from 'react';
import { PurchaseOrder, PO_STATUS_LABELS } from '../../../types/po';
import { format } from 'date-fns';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';

interface POListViewProps {
    purchaseOrders: PurchaseOrder[];
    isLoading: boolean;
    onNavigate?: (view: string) => void;
}

const STATUS_Styles: Record<string, string> = {
    DRAFT: 'bg-slate-500/10 text-secondary border-slate-500/20',
    PENDING_APPROVAL: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    SENT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    ACKNOWLEDGED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    PARTIALLY_RECEIVED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    RECEIVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CLOSED: 'bg-slate-500/10 text-muted border-slate-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export const POListView: React.FC<POListViewProps> = ({ purchaseOrders, isLoading, onNavigate }) => {
    const setSelectedPoId = usePoStore(state => state.setSelectedPoId);
    const { suppliers, locations } = useScmStore();

    if (isLoading) {
        return <div className="p-6 text-secondary">Loading purchase orders...</div>;
    }

    if (purchaseOrders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p>No purchase orders found.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-surface sticky top-0 z-10 text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-border">
                    <tr>
                        <th className="px-6 py-3">PO Number</th>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-6 py-3">Destination</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Order Date</th>
                        <th className="px-6 py-3">Expected Delivery</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                    {purchaseOrders.map(po => {
                        // Calc received %
                        const totalOrdered = po.lines.reduce((sum, l) => sum + l.qtyOrdered, 0);
                        const totalReceived = po.lines.reduce((sum, l) => sum + l.qtyReceived, 0);
                        const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                        const supplier = suppliers.find(s => s.id === po.supplierId);
                        const location = locations.find(l => l.id === po.shipToLocationId);

                        return (
                            <tr
                                key={po.id}
                                onClick={() => {
                                    setSelectedPoId(po.id);
                                    onNavigate?.('scm-purchase-orders-detail');
                                }}
                                className="hover:bg-surface cursor-pointer transition-colors group"
                            >
                                <td className="px-6 py-4 font-mono text-sm text-blue-400">{po.poNumber}</td>
                                <td className="px-6 py-4 text-sm text-primary">{supplier?.name || po.supplierId}</td>
                                <td className="px-6 py-4 text-sm text-secondary truncate max-w-[150px]">{location?.name || po.shipToLocationId}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${STATUS_Styles[po.status] || STATUS_Styles.DRAFT}`}>
                                        {PO_STATUS_LABELS[po.status]}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-secondary">{format(new Date(po.orderDate), 'MMM d, yyyy')}</td>
                                <td className="px-6 py-4 text-sm text-secondary">{format(new Date(po.expectedDeliveryDate), 'MMM d, yyyy')}</td>
                                <td className="px-6 py-4 text-sm font-mono text-primary text-right">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: po.currency }).format(po.grandTotal)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight size={16} className="text-muted group-hover:text-secondary transition-colors inline-block" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};



