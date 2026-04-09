import React, { useState, useMemo, useEffect } from 'react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import {
    ArrowLeft, Package, MapPin, Truck, Clock, CheckCircle2, AlertTriangle,
    FileText, ExternalLink, Boxes, ClipboardCheck, Send, BadgeCheck,
    XCircle, Loader2, X
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';
import { DeliveryStatus } from '../../../types/logistics';
import {
    allocateDelivery, startPicking, markPicked,
    markPacked, shipDelivery, deliverWithPOD, closeDelivery, ShipPayload, PODPayload
} from '../../../services/deliveryOrchestrator';

interface DeliveryDetailPageProps {
    deliveryId: string;
    onBack: () => void;
    onNavigate?: (view: string) => void;
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: any }> = {
    DRAFT: { label: 'Draft', color: 'slate', icon: Clock },
    ALLOCATED: { label: 'Allocated', color: 'blue', icon: CheckCircle2 },
    PICKING: { label: 'Picking', color: 'violet', icon: Package },
    PICKED: { label: 'Picked', color: 'purple', icon: Package },
    PACKED: { label: 'Packed', color: 'amber', icon: Boxes },
    SHIPPED: { label: 'Shipped', color: 'blue', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'emerald', icon: MapPin },
    CLOSED: { label: 'Closed', color: 'emerald', icon: CheckCircle2 },
    EXCEPTION_HOLD: { label: 'Exception', color: 'rose', icon: AlertTriangle },
    CANCELLED: { label: 'Cancelled', color: 'slate', icon: XCircle },
};

const DeliveryDetailPage: React.FC<DeliveryDetailPageProps> = ({ deliveryId, onBack, onNavigate }) => {
    const { deliveries, fetchDeliveries, fetchShipments, fetchExceptions } = useLogisticsStore();
    const { locations } = useScmStore();
    const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'pod' | 'exceptions'>('details');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showShipModal, setShowShipModal] = useState(false);
    const [showPODModal, setShowPODModal] = useState(false);

    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    const delivery = useMemo(() => deliveries.find(d => d.id === deliveryId), [deliveries, deliveryId]);
    if (!delivery) return <div className="h-full flex items-center justify-center text-muted">Delivery not found.</div>;

    const config = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.DRAFT;
    const getLocName = (id: string) => locations.find(l => l.id === id)?.name || id;

    const handleAction = async (action: () => void) => {
        setIsProcessing(true);
        try {
            action();
            await Promise.all([fetchDeliveries(), fetchShipments(), fetchExceptions()]);
        } finally { setIsProcessing(false); }
    };

    // ── Action buttons based on status ───────────────────────────────
    const renderActions = () => {
        const s = delivery.status;
        const btn = (label: string, onClick: () => void, color = 'blue', icon?: React.ReactNode) => (
            <button key={label} disabled={isProcessing} onClick={onClick}
                className={cn("px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95 flex items-center gap-2 text-primary",
                    isProcessing ? "opacity-50 cursor-not-allowed" : "",
                    color === 'blue' && "bg-blue-600 hover:bg-blue-500",
                    color === 'emerald' && "bg-emerald-600 hover:bg-emerald-500",
                    color === 'amber' && "bg-amber-600 hover:bg-amber-500",
                    color === 'violet' && "bg-violet-600 hover:bg-violet-500",
                )}>
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : icon} {label}
            </button>
        );

        return (
            <div className="flex items-center gap-2">
                {s === 'DRAFT' && btn('Allocate Stock', () => handleAction(() => allocateDelivery(delivery.id, 'Current User')), 'blue', <ClipboardCheck size={14} />)}
                {s === 'ALLOCATED' && btn('Start Picking', () => handleAction(() => startPicking(delivery.id, 'Current User')), 'violet', <Package size={14} />)}
                {s === 'PICKING' && btn('Mark Picked', () => handleAction(() => markPicked(delivery.id, delivery.lines.map(l => ({ lineId: l.id, qtyPicked: l.qtyAllocated })), 'Current User')), 'violet', <CheckCircle2 size={14} />)}
                {s === 'PICKED' && btn('Pack Items', () => handleAction(() => markPacked(delivery.id, 'Current User')), 'amber', <Boxes size={14} />)}
                {s === 'PACKED' && btn('Ship Delivery', () => setShowShipModal(true), 'blue', <Send size={14} />)}
                {s === 'SHIPPED' && btn('Mark Delivered', () => setShowPODModal(true), 'emerald', <BadgeCheck size={14} />)}
                {s === 'DELIVERED' && delivery.pod?.status === 'CAPTURED' && btn('Close', () => handleAction(() => closeDelivery(delivery.id, 'Current User')), 'emerald', <CheckCircle2 size={14} />)}
            </div>
        );
    };

    const sorted = [...delivery.auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between flex-none bg-app z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-muted hover:text-foreground">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                            {delivery.code}
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1.5",
                                config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
                                config.color === 'blue' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                config.color === 'violet' && "bg-violet-500/10 text-violet-500 border-violet-500/20",
                                config.color === 'purple' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                                config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                            )}>
                                <config.icon size={12} /> {config.label}
                            </span>
                        </h1>
                        <p className="text-sm text-muted">{delivery.customerId || delivery.projectId || delivery.destinationText || 'Delivery'}</p>
                    </div>
                </div>
                {renderActions()}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">
                        {/* Info Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Route</p>
                                <div className="flex items-center gap-2 text-[13px] font-medium">
                                    <span className="text-muted">{getLocName(delivery.sourceLocationId)}</span>
                                    <Truck size={14} className="text-blue-500" />
                                    <span className="text-foreground font-bold">{getLocName(delivery.destinationLocationId)}</span>
                                </div>
                                {delivery.destinationAddress && (
                                    <p className="text-[11px] text-muted mt-1 flex items-center gap-1"><MapPin size={10} />{delivery.destinationAddress}</p>
                                )}
                            </div>
                            <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Shipping</p>
                                <div className="grid grid-cols-2 gap-2 text-[13px]">
                                    <div><span className="text-muted text-[11px]">Carrier</span><p className="font-medium text-foreground">{delivery.carrierId || '—'}</p></div>
                                    <div><span className="text-muted text-[11px]">Tracking</span><p className="font-medium text-foreground font-mono text-[12px]">{delivery.trackingNo || '—'}</p></div>
                                    <div><span className="text-muted text-[11px]">Ship Date</span><p className="font-medium text-foreground">{delivery.shipDate ? format(new Date(delivery.shipDate), 'PP') : '—'}</p></div>
                                    <div><span className="text-muted text-[11px]">ETA</span><p className="font-medium text-foreground">{delivery.etaDate ? format(new Date(delivery.etaDate), 'PP') : '—'}</p></div>
                                </div>
                            </div>
                        </div>

                        {/* Linked Shipment */}
                        {delivery.linkedShipmentId && (
                            <button onClick={() => onNavigate?.(`scm-logistics-shipments-detail-${delivery.linkedShipmentId}`)}
                                className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between hover:bg-blue-500/10 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><Truck size={16} /></div>
                                    <div className="text-left">
                                        <p className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">Linked Shipment</p>
                                        <p className="text-[11px] text-muted">Open outbound shipment details</p>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-muted group-hover:text-blue-500 transition-colors" />
                            </button>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 border-b border-border">
                            {(['details', 'documents', 'pod', 'exceptions'] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={cn("px-4 py-2.5 text-[13px] font-bold capitalize transition-colors border-b-2",
                                        activeTab === tab ? "text-blue-500 border-blue-500" : "text-muted border-transparent hover:text-foreground")}>
                                    {tab === 'pod' ? 'POD' : tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'details' && (
                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-border bg-surface/50">
                                    <h3 className="text-sm font-bold text-foreground">Delivery Lines</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border bg-background">
                                                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest min-w-[180px]">Item</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right w-20">Requested</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-blue-500 uppercase tracking-widest text-right w-20">Allocated</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-violet-500 uppercase tracking-widest text-right w-20">Picked</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-right w-20">Shipped</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-right w-20">Delivered</th>
                                                <th className="px-3 py-3 text-[10px] font-bold text-rose-500 uppercase tracking-widest text-right w-20">Short</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {delivery.lines.map(line => (
                                                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-surface/30">
                                                    <td className="px-4 py-3">
                                                        <span className="text-[13px] font-bold text-foreground">{line.description || line.sku}</span>
                                                        <span className="text-[11px] text-muted block">{line.sku} · {line.uom}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-medium text-foreground">{line.qtyRequested}</td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-medium text-blue-500">{line.qtyAllocated}</td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-medium text-violet-500">{line.qtyPicked}</td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-medium text-amber-500">{line.qtyShipped}</td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-medium text-emerald-500">{line.qtyDelivered}</td>
                                                    <td className="px-3 py-3 text-right text-[13px] font-bold text-rose-500">{line.qtyShort > 0 ? line.qtyShort : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'pod' && (
                            <div className="bg-card border border-border rounded-xl p-6">
                                {delivery.pod?.status === 'CAPTURED' ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                                                <BadgeCheck size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-foreground">Proof of Delivery Captured</h3>
                                                <p className="text-xs text-muted">{format(new Date(delivery.pod.deliveredAt), 'PPp')}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                                            <div><p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Signed By</p><p className="text-[13px] font-medium text-foreground">{delivery.pod.signedBy}</p></div>
                                            <div><p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Type</p><p className="text-[13px] font-medium text-foreground">{delivery.pod.signatureType}</p></div>
                                        </div>
                                        {delivery.pod.notes && (
                                            <div className="pt-4 border-t border-border">
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Notes</p>
                                                <p className="text-[13px] text-foreground">{delivery.pod.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted">
                                        <FileText size={24} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No Proof of Delivery captured yet</p>
                                        <p className="text-xs text-muted/60 mt-1">POD will be captured when the delivery is marked as delivered</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
                                <FileText size={24} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No documents attached</p>
                            </div>
                        )}

                        {activeTab === 'exceptions' && (
                            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
                                {delivery.exceptionIds.length === 0 ? (
                                    <>
                                        <AlertTriangle size={24} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No exceptions</p>
                                    </>
                                ) : (
                                    <div className="text-left p-4 space-y-3">
                                        {delivery.exceptionIds.map(excId => (
                                            <div key={excId} className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 flex items-center gap-3">
                                                <AlertTriangle size={14} className="text-rose-500" />
                                                <span className="text-[13px] text-foreground">Exception ID: {excId.slice(0, 8)}...</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="h-8" />
                    </div>
                </div>

                {/* Right Rail — Audit */}
                <div className="w-72 border-l border-border bg-surface/20 overflow-y-auto custom-scrollbar flex-none p-4">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5"><Clock size={12} /> Audit Trail</h4>
                    <div className="space-y-3">
                        {sorted.map(evt => (
                            <div key={evt.id} className="relative pl-4 border-l-2 border-border">
                                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500" />
                                <p className="text-[11px] font-medium text-foreground leading-tight">{evt.message}</p>
                                <p className="text-[10px] text-muted mt-0.5">{format(new Date(evt.timestamp), 'PP p')} · {evt.actor}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ship Modal */}
            {showShipModal && <ShipModal delivery={delivery} onClose={() => setShowShipModal(false)} onShip={async (p) => {
                setIsProcessing(true);
                try {
                    shipDelivery(delivery.id, p, 'Current User');
                    await Promise.all([fetchDeliveries(), fetchShipments()]);
                    setShowShipModal(false);
                } finally { setIsProcessing(false); }
            }} />}

            {/* POD Modal */}
            {showPODModal && <PODModal delivery={delivery} onClose={() => setShowPODModal(false)} onDeliver={async (p) => {
                setIsProcessing(true);
                try {
                    deliverWithPOD(delivery.id, p, 'Current User');
                    await Promise.all([fetchDeliveries(), fetchExceptions()]);
                    setShowPODModal(false);
                } finally { setIsProcessing(false); }
            }} />}
        </div>
    );
};

// ── Ship Modal ───────────────────────────────────────────────────────
const ShipModal: React.FC<{ delivery: any; onClose: () => void; onShip: (p: ShipPayload) => void }> = ({ delivery, onClose, onShip }) => {
    const [carrierId, setCarrierId] = useState(delivery.carrierId || '');
    const [trackingNo, setTrackingNo] = useState('');
    const [shipDate, setShipDate] = useState(new Date().toISOString().split('T')[0]);
    const [etaDate, setEtaDate] = useState('');
    const valid = carrierId && trackingNo && shipDate && etaDate;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-[500px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Send size={18} className="text-blue-500" /> Ship Delivery</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Carrier *</label>
                        <input value={carrierId} onChange={e => setCarrierId(e.target.value)} placeholder="e.g. FedEx, DHL..."
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Tracking # *</label>
                        <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="Tracking number..."
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Ship Date *</label>
                            <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">ETA *</label>
                            <input type="date" value={etaDate} onChange={e => setEtaDate(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 h-9 rounded-lg text-[13px] font-medium text-muted border border-border hover:bg-surface">Cancel</button>
                    <button disabled={!valid} onClick={() => onShip({
                        carrierId, trackingNo,
                        shipDate: new Date(shipDate).toISOString(),
                        etaDate: new Date(etaDate).toISOString(),
                        qtyShippedPerLine: delivery.lines.map((l: any) => ({ lineId: l.id, qtyShipped: l.qtyPicked || l.qtyAllocated || l.qtyRequested }))
                    })} className={cn("px-6 h-9 rounded-lg font-bold text-[13px] flex items-center gap-2 transition-all active:scale-95",
                        valid ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg" : "bg-surface text-muted cursor-not-allowed")}>
                        <Send size={14} /> Ship & Create Shipment
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── POD Modal ────────────────────────────────────────────────────────
const PODModal: React.FC<{ delivery: any; onClose: () => void; onDeliver: (p: PODPayload) => void }> = ({ delivery, onClose, onDeliver }) => {
    const [signedBy, setSignedBy] = useState('');
    const [notes, setNotes] = useState('');
    const valid = signedBy.trim().length > 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-[500px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><BadgeCheck size={18} className="text-emerald-500" /> Proof of Delivery</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Signed By *</label>
                        <input value={signedBy} onChange={e => setSignedBy(e.target.value)} placeholder="Recipient name..."
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery notes..." rows={3}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" />
                    </div>
                </div>
                <div className="p-5 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 h-9 rounded-lg text-[13px] font-medium text-muted border border-border hover:bg-surface">Cancel</button>
                    <button disabled={!valid} onClick={() => onDeliver({
                        signedBy, notes: notes || undefined, deliveredAt: new Date().toISOString(),
                        qtyDeliveredPerLine: delivery.lines.map((l: any) => ({ lineId: l.id, qtyDelivered: l.qtyShipped, qtyShort: 0 }))
                    })} className={cn("px-6 h-9 rounded-lg font-bold text-[13px] flex items-center gap-2 transition-all active:scale-95",
                        valid ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg" : "bg-surface text-muted cursor-not-allowed")}>
                        <BadgeCheck size={14} /> Capture POD & Deliver
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryDetailPage;


