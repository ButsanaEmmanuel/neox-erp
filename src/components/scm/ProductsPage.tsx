import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Popover, Transition, Portal } from '@headlessui/react';
import {
    Plus,
    Search,
    Filter,
    Box,
    Settings
} from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { ScmProduct } from '../../types/scm';
import { cn } from '../../utils/cn';
import ProductDrawer from './ProductDrawer';
import CreateProductModal from './CreateProductModal';
import ProductsTable from './ProductsTable';

interface ProductsPageProps {
    onNavigate?: (view: string) => void;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ onNavigate }) => {
    // Atomic selectors for actions to ensure stable identities
    const fetchProducts = useScmStore(state => state.fetchProducts);
    const fetchSuppliers = useScmStore(state => state.fetchSuppliers);
    const fetchCategories = useScmStore(state => state.fetchCategories);
    const setCreateProductModalOpen = useScmStore(state => state.setCreateProductModalOpen);
    const setSelectedProductId = useScmStore(state => state.setSelectedProductId);

    // Data subscriptions
    const products = useScmStore(state => state.products);
    const inventory = useScmStore(state => state.inventory);
    const suppliers = useScmStore(state => state.suppliers);
    const categories = useScmStore(state => state.categories);
    const selectedProductId = useScmStore(state => state.selectedProductId);
    const getProductStockTotals = useScmStore(state => state.getProductStockTotals);

    // Derive products with stock locally to ensure stable array reference
    const productsWithStock = useMemo(() => {
        return products.map(p => {
            const totals = getProductStockTotals(p.id);
            return { ...p, stockLevel: totals.onHand };
        });
    }, [products, inventory, getProductStockTotals]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ScmProduct; direction: 'asc' | 'desc' } | null>(null);

    // Initial fetch - Dependencies are now stable actions
    useEffect(() => {
        fetchProducts();
        fetchSuppliers();
        fetchCategories();
    }, [fetchProducts, fetchSuppliers, fetchCategories]);

    // Categories for filter
    const uniqueCategories = useMemo(() => {
        return categories.map(c => c.name).sort();
    }, [categories]);

    // Sorting logic
    const handleSort = useCallback((key: string) => {
        setSortConfig(prev => {
            let direction: 'asc' | 'desc' = 'asc';
            if (prev && prev.key === key && prev.direction === 'asc') {
                direction = 'desc';
            }
            return { key: key as keyof ScmProduct, direction };
        });
    }, []);

    const sortedProducts = useMemo(() => {
        let sortableProducts = [...productsWithStock];
        if (sortConfig) {
            sortableProducts.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof typeof a];
                const bValue = b[sortConfig.key as keyof typeof b];

                if (aValue === undefined || bValue === undefined) return 0;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableProducts;
    }, [productsWithStock, sortConfig]);

    // Filtering logic
    const filteredProducts = useMemo(() => {
        return sortedProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [sortedProducts, searchQuery, statusFilter, categoryFilter]);

    const getSupplierName = useCallback((id: string) => {
        return suppliers.find(s => s.id === id)?.name || 'Unknown Supplier';
    }, [suppliers]);

    return (
        <div className="flex h-full relative overflow-hidden animate-in fade-in duration-500">
            <div className="flex-1 flex flex-col min-w-0 bg-app">
                {/* Header Actions */}
                <div className="p-6 pb-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search products, SKUs, tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-foreground focus:outline-none focus:border-brand/50 transition-colors w-72 placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Status Filter */}
                            <Popover className="relative filter-group">
                                {({ open }) => (
                                    <div
                                        className="relative"
                                        onMouseEnter={({ currentTarget }) => {
                                            if (!open) currentTarget.querySelector('button')?.click();
                                        }}
                                    >
                                        <Popover.Button
                                            className={cn(
                                                "flex items-center gap-2 h-9 px-3 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-surface transition-all text-xs font-bold uppercase tracking-widest outline-none",
                                                statusFilter !== 'all' ? "border-brand/50 bg-surface text-foreground" : "border-border",
                                                open && "border-brand/50 bg-surface/80 text-foreground ring-4 ring-brand/10"
                                            )}
                                        >
                                            <Filter size={14} />
                                            {statusFilter === 'all' ? 'Status' : statusFilter}
                                        </Popover.Button>

                                        <Portal>
                                            <Transition
                                                as={React.Fragment}
                                                enter="transition ease-out duration-100"
                                                enterFrom="transform opacity-0 scale-95"
                                                enterTo="transform opacity-100 scale-100"
                                                leave="transition ease-in duration-75"
                                                leaveFrom="transform opacity-100 scale-100"
                                                leaveTo="transform opacity-0 scale-95"
                                            >
                                                <Popover.Panel className="z-[101] w-36 bg-surface border border-input rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden outline-none backdrop-blur-xl">
                                                    <div className="flex flex-col p-1">
                                                        {['all', 'active', 'inactive'].map(status => (
                                                            <Popover.Button
                                                                key={status}
                                                                as="button"
                                                                onClick={() => {
                                                                    setStatusFilter(status as any);
                                                                }}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
                                                                    statusFilter === status
                                                                        ? "text-emerald-400 bg-emerald-500/10"
                                                                        : "text-secondary hover:bg-surface hover:text-primary"
                                                                )}
                                                            >
                                                                {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                                                            </Popover.Button>
                                                        ))}
                                                    </div>
                                                </Popover.Panel>
                                            </Transition>
                                        </Portal>
                                    </div>
                                )}
                            </Popover>

                            {/* Category Filter */}
                            <Popover className="relative filter-group">
                                {({ open }) => (
                                    <div
                                        className="relative"
                                        onMouseEnter={({ currentTarget }) => {
                                            if (!open) currentTarget.querySelector('button')?.click();
                                        }}
                                    >
                                        <Popover.Button
                                            className={cn(
                                                "flex items-center gap-2 h-9 px-3 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-surface transition-all text-xs font-bold uppercase tracking-widest outline-none",
                                                categoryFilter !== 'all' ? "border-brand/50 bg-surface text-foreground" : "border-border",
                                                open && "border-brand/50 bg-surface/80 text-foreground ring-4 ring-brand/10"
                                            )}
                                        >
                                            <Box size={14} />
                                            {categoryFilter === 'all' ? 'Category' : categoryFilter}
                                        </Popover.Button>

                                        <Portal>
                                            <Transition
                                                as={React.Fragment}
                                                enter="transition ease-out duration-100"
                                                enterFrom="transform opacity-0 scale-95"
                                                enterTo="transform opacity-100 scale-100"
                                                leave="transition ease-in duration-75"
                                                leaveFrom="transform opacity-100 scale-100"
                                                leaveTo="transform opacity-0 scale-95"
                                            >
                                                <Popover.Panel className="z-[101] w-56 bg-surface border border-input rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col outline-none backdrop-blur-xl">
                                                    <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col p-1">
                                                        <Popover.Button
                                                            as="button"
                                                            onClick={() => {
                                                                setCategoryFilter('all');
                                                            }}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
                                                                categoryFilter === 'all'
                                                                    ? "text-emerald-400 bg-emerald-500/10"
                                                                    : "text-secondary hover:bg-surface hover:text-primary"
                                                            )}
                                                        >
                                                            All Categories
                                                        </Popover.Button>
                                                        <div className="h-px bg-white/5 my-1 mx-2" />
                                                        {uniqueCategories.map(category => (
                                                            <Popover.Button
                                                                key={category}
                                                                as="button"
                                                                onClick={() => {
                                                                    setCategoryFilter(category);
                                                                }}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
                                                                    categoryFilter === category
                                                                        ? "text-emerald-400 bg-emerald-500/10"
                                                                        : "text-secondary hover:bg-surface hover:text-primary"
                                                                )}
                                                            >
                                                                {category}
                                                            </Popover.Button>
                                                        ))}
                                                    </div>
                                                </Popover.Panel>
                                            </Transition>
                                        </Portal>
                                    </div>
                                )}
                            </Popover>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onNavigate?.('scm-config')}
                            className="flex items-center gap-2 bg-surface hover:bg-muted text-foreground border border-border px-3 h-9 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all"
                        >
                            <Settings size={14} /> Manage Categories
                        </button>
                        <button
                            onClick={() => setCreateProductModalOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            <Plus size={16} /> New Product
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto bg-app">
                    <ProductsTable
                        products={filteredProducts}
                        selectedProductId={selectedProductId}
                        onSelectProduct={setSelectedProductId}
                        getSupplierName={getSupplierName}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                    />
                </div>

                <CreateProductModal />
            </div>

            {/* Product Detail Components */}
            {selectedProductId && <ProductDrawer key={selectedProductId} />}
        </div>
    );
};

export default ProductsPage;


