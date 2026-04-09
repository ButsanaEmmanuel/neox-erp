import React from 'react';
import { ScmProduct } from '../../types/scm';
import { useScmStore } from '../../store/scm/useScmStore';
import { cn } from '../../utils/cn';
import {
    MoreHorizontal,
    Box,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    AlertTriangle,
    AlertCircle
} from 'lucide-react';

interface ProductsTableProps {
    products: (ScmProduct & { stockLevel: number })[];
    selectedProductId: string | null;
    onSelectProduct: (id: string) => void;
    getSupplierName: (id: string) => string;
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
}

export const PRODUCT_GRID_TEMPLATE = "minmax(250px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 48px";

const ProductsTable: React.FC<ProductsTableProps> = ({
    products,
    selectedProductId,
    onSelectProduct,
    getSupplierName,
    sortConfig,
    onSort
}) => {
    const stockThresholds = useScmStore(state => state.stockThresholds);

    return (
        <div className="flex flex-col h-full min-w-[1000px]">
            {/* Table Header */}
            <div
                className="px-6 py-3 border-b border-border bg-app sticky top-0 z-10 grid items-center gap-4 shadow-sm"
                style={{ gridTemplateColumns: PRODUCT_GRID_TEMPLATE }}
            >
                <SortableHeader label="Product Name" sortKey="name" currentSort={sortConfig} onSort={onSort} />
                <SortableHeader label="SKU" sortKey="sku" currentSort={sortConfig} onSort={onSort} />
                <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} onSort={onSort} />
                <SortableHeader label="Stock" sortKey="stockLevel" currentSort={sortConfig} onSort={onSort} align="right" />
                <SortableHeader label="Cost" sortKey="costPerUnit" currentSort={sortConfig} onSort={onSort} align="right" className="pr-4" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest select-none truncate">Supplier</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest select-none">Status</span>
                <span />
            </div>

            {/* Table Body */}
            <div className="flex-1 pb-10">
                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <p className="text-sm">No products found</p>
                    </div>
                ) : (
                    products.map(p => (
                        <div
                            key={p.id}
                            onClick={() => onSelectProduct(p.id)}
                            className={cn(
                                "px-6 border-b border-border/40 grid items-center gap-4 transition-all cursor-pointer group h-[64px]",
                                selectedProductId === p.id ? "bg-brand/5" : "hover:bg-surface/50"
                            )}
                            style={{ gridTemplateColumns: PRODUCT_GRID_TEMPLATE }}
                        >
                            {/* Product Name & Icon */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold shrink-0">
                                    <Box size={14} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13.5px] font-medium text-foreground truncate group-hover:text-primary transition-colors" title={p.name}>
                                        {p.name}
                                    </span>
                                    {p.tags && p.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                                            {p.tags.slice(0, 2).map(tag => (
                                                <span key={tag} className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight px-1.5 py-0.5 bg-muted/50 rounded-md whitespace-nowrap">
                                                    {tag}
                                                </span>
                                            ))}
                                            {p.tags.length > 2 && (
                                                <span className="text-[9px] font-bold text-muted-foreground">+ {p.tags.length - 2}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SKU */}
                            <div className="text-[13px] text-muted-foreground font-mono truncate" title={p.sku}>
                                {p.sku}
                            </div>

                            {/* Category */}
                            <div className="text-[13px] text-foreground truncate">
                                {p.category}
                            </div>

                            {/* Stock Level */}
                            <div className="flex flex-col gap-0.5 items-end justify-center">
                                <span className={cn(
                                    "font-mono font-medium tabular-nums",
                                    p.stockLevel <= stockThresholds.criticalThreshold ? "text-rose-500 font-bold" :
                                        p.stockLevel <= stockThresholds.lowThreshold ? "text-amber-500 font-bold" :
                                            "text-foreground"
                                )}>
                                    {p.stockLevel}
                                </span>
                                {(p.stockLevel <= stockThresholds.lowThreshold) && (
                                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1">
                                        {p.stockLevel <= stockThresholds.criticalThreshold ? (
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-rose-500 flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded-sm border border-rose-500/20">
                                                <AlertCircle size={10} /> Critical
                                            </span>
                                        ) : (
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded-sm border border-amber-500/20">
                                                <AlertTriangle size={10} /> Low
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Cost */}
                            <div className="text-right font-mono text-sm text-foreground pr-4">
                                ${p.costPerUnit.toFixed(2)}
                            </div>

                            {/* Supplier */}
                            <div className="text-[13px] text-muted-foreground truncate" title={getSupplierName(p.preferredSupplierId)}>
                                {getSupplierName(p.preferredSupplierId)}
                            </div>

                            {/* Status */}
                            <div>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                    p.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        "bg-surface text-muted-foreground border-border/40"
                                )}>
                                    {p.status}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end">
                                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface rounded-md transition-all text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSort: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    align?: 'left' | 'right' | 'center';
    className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
    label,
    sortKey,
    currentSort,
    onSort,
    align = 'left',
    className
}) => {
    const isActive = currentSort?.key === sortKey;

    return (
        <div
            className={cn(
                "flex items-center gap-1 cursor-pointer group select-none",
                align === 'right' && "justify-end",
                align === 'center' && "justify-center",
                className
            )}
            onClick={() => onSort(sortKey)}
        >
            {align === 'right' && (
                <div className="text-muted-foreground/50 group-hover:text-muted-foreground w-3 flex justify-center">
                    {isActive ? (
                        currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                        <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            )}
            <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
                {label}
            </span>
            {align !== 'right' && (
                <div className="text-muted-foreground/50 group-hover:text-muted-foreground w-3 flex justify-center">
                    {isActive ? (
                        currentSort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                        <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            )}
        </div>
    );
}

export default ProductsTable;


