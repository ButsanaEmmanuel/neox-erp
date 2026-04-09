import React, { useState, useMemo } from 'react';
import {
    Search, Filter, Plus, LayoutGrid, List,
    ArrowRight, Clock, ChevronRight, X
} from 'lucide-react';
import { ShipmentStatus } from '../../../types/logistics';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import { StatusPill, SHIPMENT_STATUS_CONFIG } from './StatusPill';
import { FilterDrawer } from './FilterDrawer';
import { ShipmentFormModal } from './ShipmentFormModal';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';

interface ShipmentsPageProps {
    onNavigate?: (view: string) => void;
}

const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ onNavigate }) => {
    const { shipments } = useLogisticsStore();
    const [activeTab, setActiveTab] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status')?.toUpperCase() as ShipmentStatus;

    // Filter State
    const [selectedStatuses, setSelectedStatuses] = useState<ShipmentStatus[]>(initialStatus ? [initialStatus] : []);
    const [selectedCarrier, setSelectedCarrier] = useState<string>('');

    // Sync filters to URL
    React.useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedStatuses.length > 0) {
            url.searchParams.set('status', selectedStatuses[0].toLowerCase());
        } else {
            url.searchParams.delete('status');
        }
        window.history.pushState({}, '', url);
    }, [selectedStatuses]);

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => {
            if (s.flowType !== activeTab) return false;

            // Search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesCode = s.code.toLowerCase().includes(query);
                const matchesTracking = s.trackingNo?.toLowerCase().includes(query);
                const matchesOrigin = s.originLocationId.toLowerCase().includes(query);
                const matchesDest = s.destinationLocationId.toLowerCase().includes(query);
                const matchesCarrier = s.carrierId?.toLowerCase().includes(query);
                if (!matchesCode && !matchesTracking && !matchesOrigin && !matchesDest && !matchesCarrier) {
                    return false;
                }
            }

            // Filters
            if (selectedStatuses.length > 0 && !selectedStatuses.includes(s.status)) return false;
            if (selectedCarrier && s.carrierId !== selectedCarrier) return false;

            return true;
        });
    }, [shipments, activeTab, searchQuery, selectedStatuses, selectedCarrier]);

    // Unique carriers for filter dropdown
    const availableCarriers = useMemo(() => {
        const carriers = new Set(shipments.map(s => s.carrierId).filter(Boolean));
        return Array.from(carriers) as string[];
    }, [shipments]);

    return (
        <div className="flex flex-col h-full bg-app relative">
            <FilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filter Shipments"
                onReset={() => {
                    setSelectedStatuses([]);
                    setSelectedCarrier('');
                }}
            >
                <div className="flex flex-col gap-6">
                    {/* Status Filter */}
                    <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(SHIPMENT_STATUS_CONFIG) as ShipmentStatus[]).map(status => {
                                const isSelected = selectedStatuses.includes(status);
                                return (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedStatuses(prev => prev.filter(s => s !== status));
                                            } else {
                                                setSelectedStatuses(prev => [...prev, status]);
                                            }
                                        }}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                            isSelected
                                                ? "bg-blue-500/10 border-blue-500/50 text-blue-500"
                                                : "bg-surface border-border text-foreground hover:border-muted"
                                        )}
                                    >
                                        {SHIPMENT_STATUS_CONFIG[status].label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Carrier Filter */}
                    <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Carrier</label>
                        <select
                            value={selectedCarrier}
                            onChange={(e) => setSelectedCarrier(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-sm text-foreground focus:outline-none focus:border-blue-500"
                        >
                            <option value="">All Carriers</option>
                            {availableCarriers.map(carrier => (
                                <option key={carrier} value={carrier}>{carrier}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </FilterDrawer>

            {/* Header */}
            <div className="p-6 border-b border-border flex flex-col gap-4 flex-none bg-app z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight">Shipments</h1>
                        <p className="text-sm text-muted">Manage inbound and outbound freight</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95"
                        >
                            <Plus size={16} /> New Shipment
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
                        <button
                            className={cn(
                                "px-4 py-1.5 rounded-md text-[13px] font-bold transition-colors",
                                activeTab === 'INBOUND' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                            )}
                            onClick={() => setActiveTab('INBOUND')}
                        >
                            Inbound
                        </button>
                        <button
                            className={cn(
                                "px-4 py-1.5 rounded-md text-[13px] font-bold transition-colors",
                                activeTab === 'OUTBOUND' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                            )}
                            onClick={() => setActiveTab('OUTBOUND')}
                        >
                            Outbound
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search by route, carrier, PO..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-8 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-72 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={cn(
                                "h-9 px-3 rounded-lg border transition-colors flex items-center gap-2 text-[13px] font-medium relative",
                                (selectedStatuses.length > 0 || selectedCarrier)
                                    ? "bg-blue-500/10 border-blue-500/50 text-blue-500"
                                    : "border-border bg-surface text-muted hover:text-foreground hover:bg-muted/50"
                            )}
                        >
                            <Filter size={14} /> Filter
                            {(selectedStatuses.length > 0 || selectedCarrier) && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                            )}
                        </button>
                        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border ml-2">
                            <button
                                className={cn("p-1.5 rounded-md transition-colors", viewMode === 'table' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                                onClick={() => setViewMode('table')}
                            >
                                <List size={14} />
                            </button>
                            <button
                                className={cn("p-1.5 rounded-md transition-colors", viewMode === 'board' ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
                                onClick={() => setViewMode('board')}
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'table' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-3 border-b border-border grid grid-cols-[140px_1fr_180px_140px_140px_40px] items-center gap-4 sticky top-0 bg-app/95 backdrop-blur-sm z-10">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Shipment ID</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Route</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Carrier</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">ETA</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Status</span>
                        <span />
                    </div>

                    <div className="pb-6">
                        {filteredShipments.length === 0 ? (
                            <div className="p-12 text-center text-muted text-sm border-b border-border">No shipments found.</div>
                        ) : (
                            filteredShipments.map(shipment => {
                                return (
                                    <div
                                        key={shipment.id}
                                        className="px-6 h-[72px] border-b border-border grid grid-cols-[140px_1fr_180px_140px_140px_40px] items-center gap-4 hover:bg-surface/50 transition-colors cursor-pointer group"
                                        onClick={() => onNavigate?.(`scm-logistics-shipments-detail-${shipment.id}`)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-foreground group-hover:text-blue-500 transition-colors">
                                                {shipment.code}
                                            </span>
                                            <span className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">
                                                {shipment.poId ? 'PO Linked' : 'Direct'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted font-medium truncate max-w-[120px]">
                                                {shipment.originLocationId}
                                            </span>
                                            <ArrowRight size={12} className="text-muted/50 flex-none" />
                                            <span className="text-[13px] text-foreground font-medium truncate max-w-[120px]">
                                                {shipment.destinationLocationId}
                                            </span>
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[13px] text-foreground font-medium">{shipment.carrierId || 'N/A'}</span>
                                            <span className="text-[11px] text-muted">{shipment.trackingNo || 'No tracking'}</span>
                                        </div>

                                        <div className="text-[13px] text-foreground tabular-nums text-right font-medium">
                                            {shipment.etaDate ? format(new Date(shipment.etaDate), 'MMM d, yyyy') : 'TBD'}
                                        </div>

                                        <div className="flex justify-end">
                                            <StatusPill status={shipment.status} />
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

            {/* Board View Placeholder */}
            {viewMode === 'board' && (
                <div className="flex-1 overflow-x-auto p-6 flex gap-6 bg-surface/30">
                    {/* Simplified Kanban columns just to show structure */}
                    {['DRAFT', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING'].map((status) => {
                        const colShipments = filteredShipments.filter(s => s.status === status);
                        const Config = SHIPMENT_STATUS_CONFIG[status as ShipmentStatus];

                        if (!Config) return null;

                        return (
                            <div key={status} className="w-[300px] flex-none flex flex-col gap-3">
                                <div className="flex items-center justify-between pb-2 border-b border-border">
                                    <div className="flex items-center gap-2">
                                        <Config.icon size={14} className={`text-${Config.color}-500`} />
                                        <span className="text-xs font-bold text-foreground uppercase tracking-widest">{Config.label}</span>
                                    </div>
                                    <span className="text-xs font-bold text-muted bg-surface px-2 py-0.5 rounded-full border border-border">
                                        {colShipments.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {colShipments.map(s => (
                                        <div key={s.id} className="bg-card border border-border p-3 rounded-lg shadow-sm hover:border-blue-500/50 transition-colors cursor-pointer"
                                            onClick={() => onNavigate?.(`scm-logistics-shipments-detail-${s.id}`)}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[13px] font-bold text-foreground">{s.code}</span>
                                                <span className="text-[10px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                                                    {s.carrierId || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted drop-shadow-sm mb-2">
                                                <span className="truncate">{s.originLocationId}</span>
                                                <ArrowRight size={10} className="flex-none" />
                                                <span className="truncate text-foreground font-medium">{s.destinationLocationId}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                                                    <Clock size={12} />
                                                    {s.etaDate ? format(new Date(s.etaDate), 'MMM d') : 'TBD'}
                                                </div>
                                                <div className="text-[10px] font-bold text-muted uppercase tracking-wider bg-surface px-2 py-0.5 rounded border border-border">
                                                    {s.lines.length} items
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Form Modal */}
            <ShipmentFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
            />
        </div>
    );
};

export default ShipmentsPage;


