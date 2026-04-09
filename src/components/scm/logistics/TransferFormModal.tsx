import React, { useState } from 'react';
import { X, Plus, Trash2, MapPin, Search, AlertTriangle, Clock, Package, CheckCircle2 } from 'lucide-react';
import { useScmStore } from '../../../store/scm/useScmStore';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { Transfer, TransferLine } from '../../../types/logistics';
import { v4 as uuidv4 } from 'uuid';
// import { format } from 'date-fns';

interface TransferFormModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TransferFormModal: React.FC<TransferFormModalProps> = ({ isOpen, onClose }) => {
    const { products, locations } = useScmStore();
    const { saveTransfer } = useLogisticsStore();

    const [sourceLocationId, setSourceLocationId] = useState('');
    const [destLocationId, setDestLocationId] = useState('');
    const [neededDate, setNeededDate] = useState('');
    const [lines, setLines] = useState<Partial<TransferLine>[]>([{ id: uuidv4() }]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;


    const handleAddLine = () => {
        setLines([...lines, { id: uuidv4() }]);
    };

    const handleRemoveLine = (id: string) => {
        if (lines.length > 1) {
            setLines(lines.filter(l => l.id !== id));
        }
    };

    const handleLineChange = (id: string, field: keyof TransferLine, value: any) => {
        setLines(lines.map(line => {
            if (line.id === id) {
                if (field === 'itemId') {
                    const product = products.find(p => p.id === value);
                    return {
                        ...line,
                        itemId: value,
                        sku: product?.sku || '',
                        description: product?.name || '',
                        uom: (product as any)?.uom || 'pcs'
                    };
                }
                return { ...line, [field]: value };
            }
            return line;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!sourceLocationId || !destLocationId) {
            setError('Please select both source and destination locations.');
            return;
        }

        if (sourceLocationId === destLocationId) {
            setError('Source and Destination locations cannot be the same.');
            return;
        }

        if (!neededDate) {
            setError('Please select a needed by date.');
            return;
        }

        const validLines = lines.filter(l => l.itemId && l.qtyRequested && l.qtyRequested > 0);
        if (validLines.length === 0) {
            setError('Please add at least one item with a valid quantity.');
            return;
        }

        try {
            setIsSubmitting(true);
            const newTransfer: Transfer = {
                id: uuidv4(),
                code: `TRF-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
                sourceLocationId,
                destLocationId,
                requestedBy: 'Current User',
                requestedAt: new Date().toISOString(),
                neededDate: new Date(neededDate).toISOString(),
                status: 'REQUESTED',
                notes: notes || undefined,
                tags: [],
                lines: validLines.map(l => ({
                    id: l.id!,
                    itemId: l.itemId!,
                    sku: l.sku!,
                    description: l.description!,
                    uom: l.uom!,
                    qtyRequested: Number(l.qtyRequested),
                    qtyPicked: 0,
                    qtyDispatched: 0,
                    qtyReceived: 0,
                    qtyDamaged: 0,
                    qtyShort: 0
                })),
                attachments: [],
                auditLog: [{
                    id: uuidv4(),
                    action: 'CREATED',
                    message: 'Transfer Requested',
                    actor: 'Current User',
                    timestamp: new Date().toISOString()
                }],
                exceptionIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await saveTransfer(newTransfer);
            onClose();
        } catch (err) {
            setError('Failed to create transfer request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-4xl bg-app border border-border shadow-2xl rounded-xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border bg-surface/50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">New Internal Transfer</h2>
                        <p className="text-sm text-muted">Request stock movement between facilities</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg text-muted hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3 text-rose-500">
                            <AlertTriangle size={16} className="text-rose-500" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form id="transfer-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* Core Details */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4 p-5 rounded-xl border border-border bg-surface/30">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <MapPin size={16} className="text-blue-500" /> Routing Details
                                </h3>

                                <div className="space-y-4 mt-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Source Location</label>
                                        <select
                                            value={sourceLocationId}
                                            onChange={(e) => setSourceLocationId(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50"
                                            required
                                        >
                                            <option value="">Select Origin...</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Destination Location</label>
                                        <select
                                            value={destLocationId}
                                            onChange={(e) => setDestLocationId(e.target.value)}
                                            className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50"
                                            required
                                        >
                                            <option value="">Select Destination...</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 p-5 rounded-xl border border-border bg-surface/30">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Clock size={16} className="text-purple-500" /> Scheduling & Notes
                                </h3>

                                <div className="space-y-4 mt-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Needed By Date</label>
                                        <input
                                            type="date"
                                            value={neededDate}
                                            onChange={(e) => setNeededDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Request Notes (Optional)</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Add any special instructions..."
                                            className="w-full bg-surface border border-border rounded-lg p-3 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 min-h-[80px] resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items line builder */}
                        <div className="border border-border rounded-xl bg-surface/30 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Package size={16} className="text-amber-500" /> Items to Transfer
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleAddLine}
                                    className="flex items-center gap-2 text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors"
                                >
                                    <Plus size={14} /> Add Item
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-[1fr_120px_100px_40px] items-center gap-4 px-3 mb-2">
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Product</span>
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest text-right">Quantity</span>
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">UOM</span>
                                    <span />
                                </div>

                                {lines.map((line) => (
                                    <div key={line.id} className="grid grid-cols-[1fr_120px_100px_40px] items-center gap-4 bg-card border border-border rounded-lg p-2">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                            <select
                                                value={line.itemId || ''}
                                                onChange={(e) => handleLineChange(line.id!, 'itemId', e.target.value)}
                                                className="w-full bg-surface border-none rounded-md h-9 pl-9 pr-3 text-[13px] text-foreground focus:ring-1 focus:ring-blue-500/50 appearance-none"
                                                required
                                            >
                                                <option value="">Select Product...</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <input
                                            type="number"
                                            value={line.qtyRequested || ''}
                                            onChange={(e) => handleLineChange(line.id!, 'qtyRequested', Number(e.target.value))}
                                            placeholder="0"
                                            min="1"
                                            className="w-full bg-surface border-none rounded-md h-9 px-3 text-[13px] text-foreground text-right focus:ring-1 focus:ring-blue-500/50"
                                            required
                                        />

                                        <div className="h-9 px-3 bg-surface/50 rounded-md border border-border/50 flex items-center text-[13px] text-muted font-medium">
                                            {line.uom || '---'}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLine(line.id!)}
                                            disabled={lines.length === 1}
                                            className="h-9 w-9 flex items-center justify-center rounded-md text-muted hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-border bg-surface/50 flex items-center justify-end gap-3 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium text-foreground bg-surface border border-border hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        form="transfer-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 rounded-lg text-[13px] font-bold text-primary bg-blue-600 hover:bg-blue-500 shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <Clock size={16} className="animate-spin" />
                        ) : (
                            <CheckCircle2 size={16} />
                        )}
                        {isSubmitting ? 'Creating...' : 'Create Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};


