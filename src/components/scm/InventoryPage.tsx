import React, { useState, useMemo } from 'react';
import {
    MapPin,
    RotateCcw,
    Search,
    ChevronDown,
    History,
    Filter,
    ArrowUpDown,
    Box,
    ArrowLeftRight
} from 'lucide-react';
import { useScmStore, computeStatus } from '../../store/scm/useScmStore';
import { InventoryRow } from '../../types/scm';
import InventoryCard from './InventoryCard';
import TransferStockModal from './TransferStockModal';
import ReconciliationModal from './ReconciliationModal';
import ReceiveStockModal from './ReceiveStockModal';
import AuditDrawer from './AuditDrawer';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type SortOption = 'stock-asc' | 'stock-desc' | 'name-asc' | 'updated-recent';

const InventoryPage: React.FC = () => {
    // Atomic Selectors for stability
    const items = useScmStore(state => state.inventory);
    const locations = useScmStore(state => state.locations);
    const thresholds = useScmStore(state => state.stockThresholds);
    const products = useScmStore(state => state.products);

    const [viewMode, setViewMode] = useState<'product' | 'location'>('product');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('updated-recent');

    // Initialize filters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialFilter = urlParams.get('filter') as any;
    const initialLocation = urlParams.get('location');

    const mappedFilter = initialFilter === 'stockout' ? 'CRITICAL' :
        initialFilter === 'low' ? 'LOW' :
            initialFilter === 'overstock' ? 'NORMAL' : 'all'; // Note overstock implies normal/healthy here for simplicity given thresholds

    const [statusFilter, setStatusFilter] = useState<'all' | 'NORMAL' | 'LOW' | 'CRITICAL'>(mappedFilter);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocation && initialLocation !== 'all' ? initialLocation : null);

    // If location is provided, default to location view
    useState(() => {
        if (initialLocation && initialLocation !== 'all') {
            setViewMode('location');
        }
    });

    // UI state for modals/drawers
    const [isTransferModalOpen, setTransferModalOpen] = useState(false);
    const [isReconcileModalOpen, setReconcileModalOpen] = useState(false);
    const [isReceiveModalOpen, setReceiveModalOpen] = useState(false);
    const [isAuditDrawerOpen, setAuditDrawerOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryRow | undefined>();

    // Stats
    const { healthyPercent, lowPercent } = useMemo(() => {
        const total = items.length;
        if (total === 0) return { healthyPercent: 0, lowPercent: 0 };
        const healthy = items.filter(i => computeStatus(i.onHand, thresholds) === 'HEALTHY' || computeStatus(i.onHand, thresholds) === 'OPTIMIZED').length;
        const low = items.filter(i => computeStatus(i.onHand, thresholds) === 'LOW' || computeStatus(i.onHand, thresholds) === 'CRITICAL').length;
        return {
            healthyPercent: Math.round((healthy / total) * 100),
            lowPercent: Math.round((low / total) * 100)
        };
    }, [items, thresholds]);

    // Sorting & Filtering
    const processedItems = useMemo(() => {
        let enriched = items.map(item => ({
            ...item,
            product: products.find(p => p.id === item.productId)
        }));

        let filtered = enriched.filter(item => {
            const matchesSearch = item.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.product?.sku.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter !== 'all') {
                const status = computeStatus(item.onHand, thresholds);
                if (status !== statusFilter) return false;
            }

            return true;
        });

        if (viewMode === 'location' && selectedLocationId) {
            filtered = filtered.filter(item => item.locationId === selectedLocationId);
        }

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'stock-asc': return a.onHand - b.onHand;
                case 'stock-desc': return b.onHand - a.onHand;
                case 'name-asc': return (a.product?.name || '').localeCompare(b.product?.name || '');
                case 'updated-recent': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                default: return 0;
            }
        });
    }, [items, products, searchQuery, sortBy, statusFilter, viewMode, selectedLocationId, thresholds]);

    const handleTransfer = (item?: InventoryRow) => {
        setSelectedItem(item);
        setTransferModalOpen(true);
    };

    const handleReconcile = (item?: InventoryRow) => {
        setSelectedItem(item);
        setReconcileModalOpen(true);
    };

    const handleViewHistory = (item?: InventoryRow) => {
        setSelectedItem(item);
        setAuditDrawerOpen(true);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-app">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-border/70">
                        <button
                            onClick={() => setViewMode('product')}
                            className={cn(
                                "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all",
                                viewMode === 'product' ? "bg-white/10 text-primary shadow-sm" : "text-muted hover:text-primary"
                            )}
                        >
                            By Product
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('location');
                                if (!selectedLocationId && locations.length > 0) setSelectedLocationId(locations[0].id);
                            }}
                            className={cn(
                                "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all",
                                viewMode === 'location' ? "bg-white/10 text-primary shadow-sm" : "text-muted hover:text-primary"
                            )}
                        >
                            By Location
                        </button>
                    </div>

                    <div className="relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search inventory..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-64 shadow-inner"
                        />
                    </div>

                    <div className="relative group/filter">
                        <button className={cn(
                            "flex items-center gap-2 px-3 h-9 rounded-lg border bg-surface text-[12px] font-medium transition-all",
                            statusFilter !== 'all' ? "border-blue-500/50 text-blue-400" : "border-border text-secondary hover:text-primary hover:border-border/80"
                        )}>
                            <Filter size={14} />
                            {statusFilter === 'all' ? 'Filter' : statusFilter}
                            <ChevronDown size={14} className="opacity-50" />
                        </button>
                        <div className="absolute left-0 mt-1 w-44 py-1 bg-surface border border-border rounded-lg shadow-xl opacity-0 invisible group-hover/filter:opacity-100 group-hover/filter:visible transition-all z-20">
                            {[
                                { id: 'all', label: 'All Items' },
                                { id: 'NORMAL', label: 'Healthy Stock' },
                                { id: 'LOW', label: 'Low Stock' },
                                { id: 'CRITICAL', label: 'Critical Stock' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setStatusFilter(opt.id as any)}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-[12px] hover:bg-surface transition-colors flex items-center justify-between",
                                        statusFilter === opt.id ? "text-blue-400 font-bold" : "text-secondary"
                                    )}
                                >
                                    {opt.label}
                                    {statusFilter === opt.id && <div className="w-1 h-1 rounded-full bg-blue-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative group/sort">
                        <button className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-surface text-[12px] text-secondary font-medium hover:text-primary hover:border-border/80 transition-all">
                            <ArrowUpDown size={14} />
                            Sort
                            <ChevronDown size={14} />
                        </button>
                        <div className="absolute left-0 mt-1 w-48 py-1 bg-surface border border-border rounded-lg shadow-xl opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-20">
                            {[
                                { id: 'updated-recent', label: 'Recently Updated' },
                                { id: 'name-asc', label: 'Name (A-Z)' },
                                { id: 'stock-asc', label: 'Stock (Low to High)' },
                                { id: 'stock-desc', label: 'Stock (High to Low)' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSortBy(opt.id as SortOption)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-[12px] transition-colors",
                                        sortBy === opt.id ? "text-blue-500 bg-blue-500/5 font-bold" : "text-secondary hover:bg-surface hover:text-primary"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleReconcile()}
                        className="flex items-center gap-2 px-4 h-9 rounded-lg bg-surface border border-border text-secondary hover:text-primary hover:border-border/80 transition-all text-[11px] font-bold uppercase tracking-widest"
                    >
                        <RotateCcw size={14} /> Reconciliation
                    </button>
                    <button
                        onClick={() => setReceiveModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all outline-none"
                    >
                        <Box size={16} />
                        Receive Stock
                    </button>
                    <button
                        onClick={() => setTransferModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface text-foreground rounded-lg text-sm font-bold border border-border hover:bg-muted active:scale-95 transition-all outline-none"
                    >
                        <ArrowLeftRight size={16} />
                        Transfer
                    </button>
                </div>
            </div>

            {/* Content View */}
            <div className="flex-1 overflow-hidden flex">
                {viewMode === 'product' ? (
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                            {processedItems.map(item => (
                                <InventoryCard
                                    key={item.id}
                                    item={item}
                                    product={item.product}
                                    onTransfer={() => handleTransfer(item)}
                                    onReconcile={() => handleReconcile(item)}
                                    onViewHistory={() => handleViewHistory(item)}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Side List for Locations */}
                        <div className="w-80 border-r border-border bg-card/10 overflow-y-auto custom-scrollbar">
                            <div className="p-4 space-y-2">
                                {locations.map(loc => {
                                    const locItems = items.filter(i => i.locationId === loc.id);
                                    const lowCount = locItems.filter(i => computeStatus(i.onHand, thresholds) === 'LOW' || computeStatus(i.onHand, thresholds) === 'CRITICAL').length;

                                    return (
                                        <button
                                            key={loc.id}
                                            onClick={() => setSelectedLocationId(loc.id)}
                                            className={cn(
                                                "w-full text-left p-4 rounded-xl border transition-all group",
                                                selectedLocationId === loc.id
                                                    ? "bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20"
                                                    : "bg-surface border-border hover:border-border/80 hover:bg-surface"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                                    selectedLocationId === loc.id ? "bg-blue-500/20 text-blue-500" : "bg-white/5 text-muted group-hover:text-primary"
                                                )}>
                                                    <MapPin size={16} />
                                                </div>
                                                {lowCount > 0 && (
                                                    <div className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-500">
                                                        {lowCount} Low
                                                    </div>
                                                )}
                                            </div>
                                            <h4 className={cn("text-sm font-bold truncate", selectedLocationId === loc.id ? "text-primary" : "text-secondary")}>
                                                {loc.name}
                                            </h4>
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                                                {locItems.length} SKUs • {loc.type}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Selected Location Products */}
                        <div className="flex-1 overflow-y-auto p-8 bg-black/10 custom-scrollbar">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-primary">
                                        {locations.find(l => l.id === selectedLocationId)?.name}
                                    </h2>
                                    <p className="text-sm text-muted mt-1">
                                        Managing stock at this location
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                                {processedItems.map(item => (
                                    <InventoryCard
                                        key={item.id}
                                        item={item}
                                        product={item.product}
                                        onTransfer={() => handleTransfer(item)}
                                        onReconcile={() => handleReconcile(item)}
                                        onViewHistory={() => handleViewHistory(item)}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer Stats */}
            <div className="p-4 px-8 border-t border-border bg-card/50 backdrop-blur-md flex items-center justify-between text-[11px] text-muted font-bold uppercase tracking-widest z-10">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                        <span>Healthy: {healthyPercent}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                        <span>Low / Critical: {lowPercent}%</span>
                    </div>
                    <div className="h-4 w-px bg-border/50" />
                    <span className="text-muted">{items.length} Total Inventory Entries</span>
                </div>

                <button
                    onClick={() => handleViewHistory()}
                    className="flex items-center gap-2 group hover:text-primary transition-colors py-1 px-3 rounded-md hover:bg-surface border border-transparent hover:border-border"
                >
                    <History size={14} className="group-hover:rotate-[-20deg] transition-transform" />
                    View Audit Log
                    <ChevronDown size={12} className="opacity-50" />
                </button>
            </div>

            {/* Modals & Drawers */}
            <TransferStockModal
                isOpen={isTransferModalOpen}
                onClose={() => {
                    setTransferModalOpen(false);
                    setSelectedItem(undefined);
                }}
                initialItem={selectedItem}
            />

            <ReconciliationModal
                isOpen={isReconcileModalOpen}
                onClose={() => {
                    setReconcileModalOpen(false);
                    setSelectedItem(undefined);
                }}
                initialItem={selectedItem}
            />

            <ReceiveStockModal
                isOpen={isReceiveModalOpen}
                onClose={() => setReceiveModalOpen(false)}
            />

            <AuditDrawer
                isOpen={isAuditDrawerOpen}
                onClose={() => setAuditDrawerOpen(false)}
                filterProductId={selectedItem?.productId}
            />
        </div>
    );
};

export default InventoryPage;


