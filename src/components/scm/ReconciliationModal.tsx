import React, { useState, useEffect } from 'react';
import { X, RotateCcw, MapPin, Package, AlertCircle, Calculator, ArrowRightLeft } from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { InventoryRow } from '../../types/scm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialItem?: InventoryRow;
}

const REASONS = [
    'Cycle count',
    'Damage',
    'Loss/Shrinkage',
    'Found stock',
    'Return to vendor',
    'Expired'
];

const ReconciliationModal: React.FC<ReconciliationModalProps> = ({ isOpen, onClose, initialItem }) => {
    const { inventory: items, locations, reconcileStock, products } = useScmStore();

    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [countedQty, setCountedQty] = useState<number>(0);
    const [reason, setReason] = useState(REASONS[0]);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialItem) {
            setProductId(initialItem.productId);
            setLocationId(initialItem.locationId);
            setCountedQty(initialItem.onHand);
        }
    }, [initialItem]);

    if (!isOpen) return null;

    const availableProducts = Array.from(new Set(items.map(i => i.productId))).map(id => {
        const product = products.find(p => p.id === id);
        return { id, name: product?.name || 'Unknown Product', sku: product?.sku };
    });

    const currentItem = items.find(i => i.productId === productId && i.locationId === locationId);
    const currentQty = currentItem?.onHand || 0;
    const delta = countedQty - currentQty;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!productId || !locationId) {
            setError('Please select a product and location');
            return;
        }

        if (countedQty < 0) {
            setError('Counted quantity cannot be negative');
            return;
        }

        setIsSubmitting(true);
        try {
            await reconcileStock({
                productId,
                locationId,
                countedQty,
                reason,
                note,
                actor: 'Current User'
            });
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border flex items-center justify-between bg-card/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <RotateCcw size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-primary leading-tight">Reconciliation</h3>
                            <p className="text-[11px] text-muted font-bold uppercase tracking-widest mt-0.5">Adjust stock to physical count</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-500 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Product</label>
                                <div className="relative">
                                    <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <select
                                        value={productId}
                                        onChange={(e) => setProductId(e.target.value)}
                                        disabled={!!initialItem}
                                        className="w-full bg-card border border-border rounded-lg h-10 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50"
                                    >
                                        <option value="">Select product</option>
                                        {availableProducts.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Location</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <select
                                        value={locationId}
                                        onChange={(e) => setLocationId(e.target.value)}
                                        disabled={!!initialItem}
                                        className="w-full bg-card border border-border rounded-lg h-10 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50"
                                    >
                                        <option value="">Select location</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-surface border border-border grid grid-cols-3 gap-4">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">Current</span>
                                <span className="text-lg font-bold text-secondary tabular-nums">{currentQty}</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <ArrowRightLeft size={16} className="text-muted" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">Delta</span>
                                <span className={cn(
                                    "text-lg font-bold tabular-nums",
                                    delta > 0 ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted"
                                )}>
                                    {delta > 0 ? `+${delta}` : delta}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Counted Quantity</label>
                            <div className="relative">
                                <Calculator size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    type="number"
                                    value={countedQty}
                                    onChange={(e) => setCountedQty(Number(e.target.value))}
                                    className="w-full bg-card border border-border rounded-lg h-10 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Reason</label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full bg-card border border-border rounded-lg h-10 px-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 appearance-none"
                            >
                                {REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Notes</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Additional details..."
                                rows={2}
                                className="w-full bg-card border border-border rounded-xl p-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 h-11 rounded-xl border border-border text-secondary font-bold text-[13px] hover:bg-surface transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] px-4 h-11 rounded-xl bg-amber-600 hover:bg-amber-500 text-primary font-bold text-[13px] shadow-lg shadow-amber-900/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Updating...' : 'Confirm Reconciliation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReconciliationModal;


