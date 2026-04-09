import React, { useState } from 'react';
import { X, Box, MapPin, Package, AlertCircle } from 'lucide-react';
import { useScmStore } from '../../store/scm/useScmStore';

interface ReceiveStockModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({ isOpen, onClose }) => {
    const { products, locations, receiveStock } = useScmStore();

    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [qty, setQty] = useState(1);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (!productId || !locationId || qty <= 0) {
                throw new Error('Please fill in all required fields.');
            }

            await receiveStock({
                productId,
                locationId,
                qty,
                note,
                actor: 'System User' // Default for mock
            });

            onClose();
            // Reset form
            setProductId('');
            setLocationId('');
            setQty(1);
            setNote('');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-app border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                            <Box size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Receive Stock</h3>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Inventory Inflow</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                    >
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

                    {/* Product Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Package size={14} />
                            Product
                        </label>
                        <select
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/50 transition-all cursor-pointer"
                        >
                            <option value="">Select a product...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                        </select>
                    </div>

                    {/* Location Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={14} />
                            Location
                        </label>
                        <select
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/50 transition-all cursor-pointer"
                        >
                            <option value="">Select a location...</option>
                            {locations.map(l => (
                                <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity & Note */}
                    <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Quantity to Receive
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                                className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/50 transition-all font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                Optional Note
                            </label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add any details about this receipt..."
                                className="w-full bg-surface border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/50 transition-all h-24 resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-11 rounded-xl border border-border bg-surface text-sm font-bold text-foreground hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-2 h-11 px-8 rounded-xl bg-brand text-brand-foreground text-sm font-bold shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? 'Receiving...' : 'Confirm Receipt'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReceiveStockModal;


