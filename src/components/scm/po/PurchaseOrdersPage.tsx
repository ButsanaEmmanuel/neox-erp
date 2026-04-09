import React, { useEffect, useState } from 'react';
import { Plus, LayoutGrid, List as ListIcon, Search, Filter, ArrowUpDown } from 'lucide-react';
import { usePoStore } from '../../../store/scm/usePoStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { POListView } from './POListView';
import { POBoardView } from './POBoardView';
import { POStatus, PO_STATUS_LABELS } from '../../../types/po';

interface PurchaseOrdersPageProps {
    onNavigate?: (view: string) => void;
}

const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({ onNavigate }) => {
    const { purchaseOrders, fetchPOs, isLoading } = usePoStore();
    const { fetchSuppliers, initialized: scmInitialized } = useScmStore();
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = (urlParams.get('status')?.toUpperCase() || 'ALL') as POStatus | 'ALL';

    const [statusFilter, setStatusFilter] = useState<POStatus | 'ALL'>(initialStatus);
    const [sortBy, setSortBy] = useState<'dateDesc' | 'dateAsc' | 'totalDesc' | 'totalAsc'>('dateDesc');

    useEffect(() => {
        fetchPOs();
        if (!scmInitialized) {
            fetchSuppliers();
        }
    }, [fetchPOs, fetchSuppliers, scmInitialized]);

    const filteredPOs = purchaseOrders
        .filter(po => {
            const matchesSearch = po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                po.supplierId.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'dateDesc': return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
                case 'dateAsc': return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
                case 'totalDesc': return b.grandTotal - a.grandTotal;
                case 'totalAsc': return a.grandTotal - b.grandTotal;
                default: return 0;
            }
        });

    return (
        <div className="flex flex-col h-full bg-app text-secondary">
            {/* Header */}
            <div className="flex-none p-6 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-primary mb-1">Purchase Orders</h1>
                    <p className="text-sm text-muted">Manage procurement, approvals, and receiving.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-surface p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#21262d] text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                        >
                            <ListIcon size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-[#21262d] text-primary shadow-sm' : 'text-muted hover:text-secondary'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => onNavigate?.('scm-purchase-orders-new')}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={16} /> New PO
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex-none px-6 py-3 border-b border-border flex items-center gap-4 bg-app/50 backdrop-blur-sm z-10 sticky top-0 flex-wrap">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        placeholder="Search POs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-surface border border-border/80 rounded-lg h-8 pl-9 pr-4 text-[13px] text-primary focus:outline-none w-64 focus:border-blue-500/50 transition-colors placeholder:text-muted"
                    />
                </div>

                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as POStatus | 'ALL')}
                        className="appearance-none flex items-center pr-8 pl-9 h-8 rounded-lg border border-border/80 bg-surface text-[13px] font-medium text-secondary hover:text-primary hover:border-input transition-colors focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        {Object.entries(PO_STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                </div>

                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="appearance-none flex items-center pr-8 pl-9 h-8 rounded-lg border border-border/80 bg-surface text-[13px] font-medium text-secondary hover:text-primary hover:border-input transition-colors focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        <option value="dateDesc">Newest First</option>
                        <option value="dateAsc">Oldest First</option>
                        <option value="totalDesc">Amount: High to Low</option>
                        <option value="totalAsc">Amount: Low to High</option>
                    </select>
                    <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden min-h-0">
                {viewMode === 'list' ? (
                    <POListView
                        purchaseOrders={filteredPOs}
                        isLoading={isLoading}
                        onNavigate={onNavigate}
                    />
                ) : (
                    <POBoardView
                        purchaseOrders={filteredPOs}
                        isLoading={isLoading}
                        onNavigate={onNavigate}
                    />
                )}
            </div>
        </div>
    );
};

export default PurchaseOrdersPage;



