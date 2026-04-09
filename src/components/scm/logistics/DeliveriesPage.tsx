import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Plus, LayoutGrid, List, ArrowRight, Clock,
    CheckCircle2, Package, Truck, Boxes, MapPin, ChevronRight,
    AlertTriangle, XCircle, ClipboardCheck, BadgeCheck
} from 'lucide-react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { DeliveryStatus } from '../../../types/logistics';
import { cn } from '../../../utils/cn';
import { format, isPast } from 'date-fns';
import DeliveryFormModal from './DeliveryFormModal';

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: any }> = {
    'DRAFT': { label: 'Draft', color: 'slate', icon: Clock },
    'ALLOCATED': { label: 'Allocated', color: 'blue', icon: ClipboardCheck },
    'PICKING': { label: 'Picking', color: 'violet', icon: Package },
    'PICKED': { label: 'Picked', color: 'purple', icon: Package },
    'PACKED': { label: 'Packed', color: 'amber', icon: Boxes },
    'SHIPPED': { label: 'Shipped', color: 'blue', icon: Truck },
    'DELIVERED': { label: 'Delivered', color: 'emerald', icon: MapPin },
    'CLOSED': { label: 'Closed', color: 'emerald', icon: CheckCircle2 },
    'EXCEPTION_HOLD': { label: 'Exception', color: 'rose', icon: AlertTriangle },
    'CANCELLED': { label: 'Cancelled', color: 'slate', icon: XCircle },
};

const BOARD_COLUMNS: DeliveryStatus[] = ['DRAFT', 'ALLOCATED', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CLOSED'];

interface DeliveriesPageProps {
    onNavigate?: (view: string) => void;
}

const DeliveriesPage: React.FC<DeliveriesPageProps> = ({ onNavigate }) => {
    const { deliveries, fetchDeliveries } = useLogisticsStore();
    const { locations } = useScmStore();
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

    const getLocName = (id: string) => locations.find(l => l.id === id)?.name || id;

    const filteredDeliveries = useMemo(() => {
        if (!searchQuery) return deliveries;
        const q = searchQuery.toLowerCase();
        return deliveries.filter(d =>
            d.code.toLowerCase().includes(q) ||
            (d.customerId || '').toLowerCase().includes(q) ||
            (d.destinationText || '').toLowerCase().includes(q) ||
            (d.trackingNo || '').toLowerCase().includes(q) ||
            (d.destinationAddress || '').toLowerCase().includes(q)
        );
    }, [deliveries, searchQuery]);

    return (
        <div className="flex flex-col h-full bg-app">
            <div className="p-6 border-b border-border flex flex-col gap-4 flex-none bg-app z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight">Outbound Deliveries</h1>
                        <p className="text-sm text-muted">Manage B2B and Direct-to-Customer shipping</p>
                    </div>
                    <button onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95">
                        <Plus size={16} /> New Delivery
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input type="text" placeholder="Search deliveries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-64 transition-all" />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                        <button className={cn("p-1.5 rounded-md transition-colors", viewMode === 'table' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                            onClick={() => setViewMode('table')}><List size={14} /></button>
                        <button className={cn("p-1.5 rounded-md transition-colors", viewMode === 'board' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                            onClick={() => setViewMode('board')}><LayoutGrid size={14} /></button>
                    </div>
                </div>
            </div>

            {viewMode === 'table' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-3 border-b border-border grid grid-cols-[140px_1fr_160px_120px_120px_100px_40px] items-center gap-4 sticky top-0 bg-app/95 backdrop-blur-sm z-10">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Delivery ID</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Customer / Dest</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Origin</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Ship Date</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Status</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-center">POD</span>
                        <span />
                    </div>

                    <div className="pb-6">
                        {filteredDeliveries.length === 0 ? (
                            <div className="p-12 text-center text-muted text-sm border-b border-border">No deliveries found.</div>
                        ) : (
                            filteredDeliveries.map(delivery => {
                                const Config = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.DRAFT;
                                const isLate = delivery.etaDate && !['DELIVERED', 'CLOSED', 'CANCELLED'].includes(delivery.status) && isPast(new Date(delivery.etaDate));
                                return (
                                    <div key={delivery.id}
                                        className="px-6 h-[72px] border-b border-border grid grid-cols-[140px_1fr_160px_120px_120px_100px_40px] items-center gap-4 hover:bg-surface/50 transition-colors cursor-pointer group"
                                        onClick={() => onNavigate?.(`scm-logistics-deliveries-detail-${delivery.id}`)}>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">{delivery.code}</span>
                                            <span className="text-[10px] text-muted font-medium mt-0.5">{delivery.lines.length} items</span>
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[13px] text-foreground font-medium truncate">{delivery.customerId || delivery.destinationText || '—'}</span>
                                            <span className="text-[11px] text-muted truncate mt-0.5 flex items-center gap-1">
                                                <MapPin size={10} /> {delivery.destinationAddress || getLocName(delivery.destinationLocationId)}
                                            </span>
                                        </div>

                                        <div className="text-[13px] text-muted truncate">{getLocName(delivery.sourceLocationId)}</div>

                                        <div className="text-[13px] text-foreground tabular-nums text-right font-medium flex items-center justify-end gap-1">
                                            {delivery.shipDate ? format(new Date(delivery.shipDate), 'MMM d, yyyy') : 'TBD'}
                                            {isLate && <AlertTriangle size={12} className="text-rose-500" />}
                                        </div>

                                        <div className="flex justify-end">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5",
                                                Config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
                                                Config.color === 'blue' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                                Config.color === 'violet' && "bg-violet-500/10 text-violet-500 border-violet-500/20",
                                                Config.color === 'purple' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                                                Config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                                Config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                                Config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                                            )}>
                                                <Config.icon size={12} /> {Config.label}
                                            </span>
                                        </div>

                                        <div className="flex justify-center">
                                            {delivery.pod?.status === 'CAPTURED' ? (
                                                <BadgeCheck size={14} className="text-emerald-500" />
                                            ) : (
                                                <span className="text-[10px] text-muted">—</span>
                                            )}
                                        </div>

                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted text-muted hover:text-foreground rounded-md transition-all justify-self-end">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'board' && (
                <div className="flex-1 overflow-x-auto p-6 flex gap-4 bg-surface/30">
                    {BOARD_COLUMNS.map((status) => {
                        const colDeliveries = filteredDeliveries.filter(d => d.status === status);
                        const Config = STATUS_CONFIG[status];
                        return (
                            <div key={status} className="w-[280px] flex-none flex flex-col gap-3">
                                <div className="flex items-center justify-between pb-2 border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <Config.icon size={14} className={cn(
                                            Config.color === 'slate' && 'text-muted',
                                            Config.color === 'blue' && 'text-blue-500',
                                            Config.color === 'violet' && 'text-violet-500',
                                            Config.color === 'purple' && 'text-purple-500',
                                            Config.color === 'amber' && 'text-amber-500',
                                            Config.color === 'emerald' && 'text-emerald-500',
                                            Config.color === 'rose' && 'text-rose-500',
                                        )} />
                                        <span className="text-xs font-bold text-foreground uppercase tracking-widest">{Config.label}</span>
                                    </div>
                                    <span className="text-xs font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border">{colDeliveries.length}</span>
                                </div>

                                <div className="space-y-3">
                                    {colDeliveries.map(d => (
                                        <div key={d.id}
                                            className="bg-card border border-border p-3 rounded-lg shadow-sm hover:border-blue-500/30 transition-colors cursor-pointer"
                                            onClick={() => onNavigate?.(`scm-logistics-deliveries-detail-${d.id}`)}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[13px] font-bold text-foreground">{d.code}</span>
                                                {d.pod?.status === 'CAPTURED' && <BadgeCheck size={12} className="text-emerald-500" />}
                                            </div>
                                            <span className="text-[11px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded border border-border truncate max-w-full block mb-2">
                                                {d.customerId || d.destinationText || '—'}
                                            </span>
                                            <div className="flex items-center gap-2 text-[11px] text-muted mb-3">
                                                <span className="truncate">{getLocName(d.sourceLocationId)}</span>
                                                <ArrowRight size={10} className="flex-none" />
                                                <span className="truncate text-foreground font-medium flex gap-1 items-center"><MapPin size={10} /> {d.destinationAddress?.split(',')[0] || getLocName(d.destinationLocationId)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                                                    <Clock size={12} />
                                                    {d.shipDate ? format(new Date(d.shipDate), 'MMM d') : 'TBD'}
                                                </div>
                                                <div className="text-[10px] font-bold text-muted">{d.lines.length} items</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreateModal && <DeliveryFormModal onClose={() => setShowCreateModal(false)} onCreated={fetchDeliveries} />}
        </div>
    );
};

export default DeliveriesPage;


