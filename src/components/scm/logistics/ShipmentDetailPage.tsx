import React, { useMemo } from 'react';
import { useLogisticsStore, canTransitionShipment } from '../../../store/scm/useLogisticsStore';
import { ArrowLeft, Package, MapPin, Truck, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ShipmentStatus } from '../../../types/logistics';
import { StatusPill } from './StatusPill';
import { AuditTimeline } from './AuditTimeline';
import { AttachmentsPanel } from './AttachmentsPanel';

interface ShipmentDetailPageProps {
    shipmentId: string;
    onBack: () => void;
}

const ShipmentDetailPage: React.FC<ShipmentDetailPageProps> = ({ shipmentId, onBack }) => {
    const { shipments, transitionShipmentStatus } = useLogisticsStore();
    const shipment = useMemo(() => shipments.find(s => s.id === shipmentId), [shipments, shipmentId]);

    if (!shipment) {
        return (
            <div className="flex flex-col h-full bg-app p-6 items-center justify-center">
                <AlertTriangle size={48} className="text-muted mb-4" />
                <h2 className="text-xl font-bold text-foreground">Shipment Not Found</h2>
                <button onClick={onBack} className="mt-4 text-blue-500 hover:underline">Go Back</button>
            </div>
        );
    }

    const availableTransitions: ShipmentStatus[] = [
        'DRAFT', 'CONFIRMED', 'BOOKED', 'DISPATCHED', 'IN_TRANSIT',
        'ARRIVED', 'RECEIVING', 'PUT_AWAY', 'CLOSED', 'EXCEPTION_HOLD', 'DELIVERED', 'CANCELLED'
    ];

    const validNextStatuses = availableTransitions.filter(status =>
        status !== shipment.status && canTransitionShipment(shipment, status)
    );

    const handleTransition = async (newStatus: ShipmentStatus) => {
        await transitionShipmentStatus(shipment.id, newStatus);
    };

    const totalQty = shipment.lines.reduce((acc, line) => acc + (line.qtyOrdered || 0), 0);
    const totalShipped = shipment.lines.reduce((acc, line) => acc + (line.qtyShipped || 0), 0);
    const totalReceived = shipment.lines.reduce((acc, line) => acc + (line.qtyReceived || 0), 0);
    const totalValue = shipment.lines.reduce((acc, line) => acc + (line.qtyOrdered * (line.unitPrice || 0)), 0);

    return (
        <div className="flex flex-col h-full bg-app overflow-hidden">
            {/* Header */}
            <div className="flex-none z-20 bg-app/95 backdrop-blur-sm border-b border-border p-6 flex flex-col gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-[13px] font-medium text-muted hover:text-foreground transition-colors w-fit"
                >
                    <ArrowLeft size={16} /> Back to Shipments
                </button>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
                                {shipment.code}
                                <StatusPill status={shipment.status} />
                            </h1>
                            <p className="text-sm text-muted mt-1">{shipment.flowType} Shipment • Created {format(new Date(shipment.createdAt), 'MMM d, yyyy')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {validNextStatuses.map(status => (
                            <button
                                key={status}
                                onClick={() => handleTransition(status)}
                                className="px-4 h-9 rounded-lg text-[13px] font-bold bg-surface hover:bg-muted border border-border text-foreground transition-all shadow-sm active:scale-95"
                            >
                                Mark as {status.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-[1fr_320px] gap-6 max-w-[1400px] h-full">
                    {/* Main Content Area */}
                    <div className="flex flex-col gap-6">
                        {/* Info Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-muted">
                                    <MapPin size={14} />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Route</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Origin</span>
                                        <span className="text-sm font-medium text-foreground">{shipment.originLocationId}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Destination</span>
                                        <span className="text-sm font-medium text-foreground">{shipment.destinationLocationId}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-muted">
                                    <Truck size={14} />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Carrier Details</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Carrier</span>
                                        <span className="text-sm font-medium text-foreground">{shipment.carrierId || 'Unassigned'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Tracking</span>
                                        <span className="text-sm font-medium text-blue-500 hover:underline cursor-pointer">{shipment.trackingNo || 'Pending'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-muted">
                                    <Package size={14} />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Summary</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Items</span>
                                        <span className="text-sm font-medium text-foreground">{shipment.lines.length} ({totalQty} units)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">Total Value</span>
                                        <span className="text-sm font-medium text-foreground">${totalValue.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shipment Lines Table */}
                        <div className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-border flex justify-between items-center bg-surface/50">
                                <h3 className="text-[13px] font-bold text-foreground">Shipment Contents</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border bg-app/50">
                                            <th className="p-3 text-[10px] font-bold text-muted uppercase tracking-widest">SKU / Item</th>
                                            <th className="p-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Ordered</th>
                                            <th className="p-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Shipped</th>
                                            <th className="p-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Received</th>
                                            <th className="p-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Short/Damage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[13px]">
                                        {shipment.lines.map((item, idx) => (
                                            <tr key={idx} className="border-b border-border last:border-none hover:bg-muted/20 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{item.sku}</span>
                                                        <span className="text-xs text-muted truncate max-w-[200px]">{item.description}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-foreground font-medium">{item.qtyOrdered} <span className="text-xs text-muted">{item.uom}</span></td>
                                                <td className="p-3 text-right text-blue-500 font-medium">{item.qtyShipped}</td>
                                                <td className="p-3 text-right text-emerald-500 font-medium">{item.qtyReceived}</td>
                                                <td className="p-3 text-right font-medium">
                                                    {(item.qtyShort > 0 || item.qtyDamaged > 0) ? (
                                                        <span className="text-rose-500">{item.qtyShort + item.qtyDamaged}</span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-3 border-t border-border bg-app/50 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted">
                                <span>Totals</span>
                                <div className="flex gap-8 text-foreground items-center">
                                    <span>Ordered: {totalQty}</span>
                                    <span>Shipped: <span className="text-blue-500">{totalShipped}</span></span>
                                    <span>Received: <span className="text-emerald-500">{totalReceived}</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Attachments Panel */}
                        <div className="mt-4">
                            <AttachmentsPanel attachments={shipment.attachments || []} />
                        </div>
                    </div>

                    {/* Right Rail (Timeline) */}
                    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden pb-4">
                        <AuditTimeline auditLog={shipment.auditLog || []} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShipmentDetailPage;


