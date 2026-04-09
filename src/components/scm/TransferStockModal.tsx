import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, MapPin, Package, AlertCircle } from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';
import { InventoryRow } from '../../types/scm';

interface TransferStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialItem?: InventoryRow;
}

const TransferStockModal: React.FC<TransferStockModalProps> = ({ isOpen, onClose, initialItem }) => {
    const { inventory: items, locations, transferStock, products } = useScmStore();

    const [productId, setProductId] = useState('');
    const [fromLocationId, setFromLocationId] = useState('');
    const [toLocationId, setToLocationId] = useState('');
    const [quantity, setQuantity] = useState<number>(0);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialItem) {
            setProductId(initialItem.productId);
            setFromLocationId(initialItem.locationId);
        }
    }, [initialItem]);

    if (!isOpen) return null;

    const availableProducts = Array.from(new Set(items.map(i => i.productId))).map(id => {
        const product = products.find(p => p.id === id);
        return { id, name: product?.name || 'Unknown Product', sku: product?.sku };
    });

    const selectedProductItem = items.find(i => i.productId === productId && i.locationId === fromLocationId);
    const maxQty = selectedProductItem ? selectedProductItem.onHand : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!productId || !fromLocationId || !toLocationId) {
            setError('Please fill in all required fields');
            return;
        }

        if (fromLocationId === toLocationId) {
            setError('Source and destination locations must be different');
            return;
        }

        if (quantity <= 0) {
            setError('Quantity must be greater than zero');
            return;
        }

        if (quantity > maxQty) {
            setError(`Insufficient stock. Available: ${maxQty}`);
            return;
        }

        setIsSubmitting(true);
        try {
            await transferStock({
                productId,
                fromLocationId,
                toLocationId,
                qty: quantity,
                note,
                actor: 'Current User' // Placeholder
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
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-primary leading-tight">Transfer Stock</h3>
                            <p className="text-[11px] text-muted font-bold uppercase tracking-widest mt-0.5">Move inventory between locations</p>
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
                                    <option value="">Select a product</option>
                                    {availableProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">From Location</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <select
                                        value={fromLocationId}
                                        onChange={(e) => setFromLocationId(e.target.value)}
                                        disabled={!!initialItem}
                                        className="w-full bg-card border border-border rounded-lg h-10 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50"
                                    >
                                        <option value="">Select source</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">To Location</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <select
                                        value={toLocationId}
                                        onChange={(e) => setToLocationId(e.target.value)}
                                        className="w-full bg-card border border-border rounded-lg h-10 pl-9 pr-4 text-sm text-primary focus:outline-none focus:border-blue-500/50 appearance-none"
                                    >
                                        <option value="">Select target</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-end ml-1">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Quantity</label>
                                {maxQty > 0 && (
                                    <span className="text-[10px] text-muted font-bold uppercase">Available: {maxQty}</span>
                                )}
                            </div>
                            <input
                                type="number"
                                value={quantity || ''}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                placeholder="0"
                                className="w-full bg-card border border-border rounded-lg h-10 px-4 text-sm text-primary focus:outline-none focus:border-blue-500/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Optional Note</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Reason for transfer..."
                                rows={3}
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
                            className="flex-[2] px-4 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[13px] shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isSubmitting ? 'Processing...' : 'Execute Transfer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransferStockModal;


