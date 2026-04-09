import React from 'react';
import {
    Package,
    MapPin,
    MoreVertical,
    ArrowRightLeft,
    RotateCcw,
    History,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    TrendingUp
} from 'lucide-react';
import { InventoryRow, InventoryStatus, ScmProduct } from '../../types/scm';
import { useScmStore, computeStatus } from '../../store/scm/useScmStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InventoryCardProps {
    item: InventoryRow;
    product?: ScmProduct;
    onTransfer: (item: InventoryRow) => void;
    onReconcile: (item: InventoryRow) => void;
    onViewHistory: (item: InventoryRow) => void;
}

const STATUS_CONFIG: Record<InventoryStatus, { label: string, color: string, icon: any }> = {
    'CRITICAL': { label: 'Critical', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', icon: AlertCircle },
    'LOW': { label: 'Low Stock', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
    'HEALTHY': { label: 'Healthy', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    'OPTIMIZED': { label: 'Optimized', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: TrendingUp },
    'NEUTRAL': { label: 'Unknown', color: 'text-muted bg-slate-500/10 border-slate-500/20', icon: Package }
};

const InventoryCard: React.FC<InventoryCardProps> = ({ item, product, onTransfer, onReconcile, onViewHistory }) => {
    const thresholds = useScmStore(state => state.stockThresholds);
    const locations = useScmStore(state => state.locations);
    const status = computeStatus(item.onHand, thresholds);
    const { label, color, icon: StatusIcon } = STATUS_CONFIG[status];

    const locationName = locations.find(l => l.id === item.locationId)?.name || 'Unknown Location';
    const availableQty = item.onHand - item.reserved;

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden group hover:border-border/80 transition-all shadow-sm hover:shadow-md">
            <div className="p-4 border-b border-border">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-muted group-hover:text-primary transition-colors">
                            <Package size={18} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-primary truncate">{product?.name || 'Unknown Product'}</h4>
                            <p className="text-[10px] text-muted uppercase font-bold tracking-tight">{product?.sku || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="relative group/menu">
                        <button className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-surface transition-all">
                            <MoreVertical size={16} />
                        </button>
                        <div className="absolute right-0 mt-1 w-48 py-1 bg-surface border border-border rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20">
                            <button
                                onClick={() => onTransfer(item)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-surface hover:text-primary transition-colors"
                            >
                                <ArrowRightLeft size={14} /> Transfer stock...
                            </button>
                            <button
                                onClick={() => onReconcile(item)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-surface hover:text-primary transition-colors"
                            >
                                <RotateCcw size={14} /> Reconcile...
                            </button>
                            <div className="h-px bg-border my-1" />
                            <button
                                onClick={() => onViewHistory(item)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-secondary hover:bg-surface hover:text-primary transition-colors"
                            >
                                <History size={14} /> View history
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Stock on Hand</span>
                        <div className="flex items-baseline gap-2">
                            <span className={cn("text-2xl font-bold tabular-nums",
                                status === 'CRITICAL' ? "text-rose-500" :
                                    status === 'LOW' ? "text-amber-500" : "text-primary"
                            )}>
                                {item.onHand.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted font-medium">units</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border",
                            color
                        )}>
                            <StatusIcon size={12} />
                            {label}
                        </div>
                        <span className="text-[11px] text-secondary font-medium flex items-center gap-1.5 uppercase tracking-tighter">
                            <MapPin size={10} className="text-muted" /> {locationName}
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-4 py-2.5 bg-surface flex items-center justify-between">
                <div className="flex gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Reserved</span>
                        <span className="text-[11px] text-secondary font-semibold tabular-nums">{item.reserved.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Available</span>
                        <span className="text-[11px] text-primary font-bold tabular-nums">{availableQty.toLocaleString()}</span>
                    </div>
                </div>

                <div className="text-[9px] text-muted font-medium italic">
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                </div>
            </div>
        </div>
    );
};

export default InventoryCard;


