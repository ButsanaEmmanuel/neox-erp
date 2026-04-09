import React, { useState } from 'react';
import { useScmStore } from '../../../store/scm/useScmStore';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { createDelivery } from '../../../services/deliveryOrchestrator';
import { DeliveryLine } from '../../../types/logistics';
import { v4 as uuidv4 } from 'uuid';

interface DeliveryFormModalProps {
    onClose: () => void;
    onCreated: () => void;
}

const mockProducts = [
    { id: 'prod-1', sku: 'SKU-001', name: 'Alpha Component', uom: 'pcs' },
    { id: 'prod-2', sku: 'SKU-002', name: 'Beta Assembly', uom: 'pcs' },
    { id: 'prod-3', sku: 'SKU-003', name: 'Gamma Modulator', uom: 'pcs' },
    { id: 'prod-4', sku: 'SKU-004', name: 'Delta Widget', uom: 'pcs' },
];

const DeliveryFormModal: React.FC<DeliveryFormModalProps> = ({ onClose, onCreated }) => {
    const { locations } = useScmStore();
    const [customerId, setCustomerId] = useState('');
    const [sourceLocationId, setSourceLocationId] = useState('');
    const [destinationLocationId, setDestinationLocationId] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [lines, setLines] = useState<{ id: string; productIdx: number; qty: number; price: number }[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const addLine = () => setLines([...lines, { id: uuidv4(), productIdx: 0, qty: 1, price: 0 }]);
    const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
    const updateLine = (idx: number, field: string, value: any) => {
        const copy = [...lines];
        (copy[idx] as any)[field] = value;
        setLines(copy);
    };

    const valid = customerId.trim() && sourceLocationId && lines.length > 0 && lines.every(l => l.qty > 0);

    const handleSave = async () => {
        if (!valid) return;
        setIsSaving(true);
        try {
            const deliveryLines: DeliveryLine[] = lines.map(l => {
                const prod = mockProducts[l.productIdx];
                return {
                    id: uuidv4(), itemId: prod.id, sku: prod.sku, description: prod.name,
                    uom: prod.uom, qtyRequested: l.qty, qtyAllocated: 0, qtyPicked: 0,
                    qtyShipped: 0, qtyDelivered: 0, qtyShort: 0,
                    unitPrice: l.price || undefined, currency: l.price ? 'USD' : undefined
                };
            });

            createDelivery({
                customerId: customerId || undefined,
                sourceLocationId,
                destinationLocationId: destinationLocationId || customerId,
                destinationAddress: destinationAddress || undefined,
                lines: deliveryLines,
                attachments: [], pod: undefined,
                createdBy: 'Current User'
            });
            onCreated();
            onClose();
        } catch (e) {
            console.error(e);
        } finally { setIsSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-[620px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Package size={18} className="text-blue-500" /> New Delivery
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Customer / Recipient *</label>
                        <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="e.g. ACME Corp"
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Origin Location *</label>
                            <select value={sourceLocationId} onChange={e => setSourceLocationId(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none">
                                <option value="">Select origin</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Destination Location</label>
                            <select value={destinationLocationId} onChange={e => setDestinationLocationId(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none">
                                <option value="">Customer address</option>
                                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Destination Address</label>
                        <input value={destinationAddress} onChange={e => setDestinationAddress(e.target.value)} placeholder="Full shipping address..."
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>

                    {/* Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Delivery Lines</label>
                            <button onClick={addLine} className="text-[11px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1"><Plus size={12} /> Add Item</button>
                        </div>
                        {lines.length === 0 && <div className="text-center py-6 text-sm text-muted border border-dashed border-border rounded-lg">Click "Add Item" to add delivery lines</div>}
                        <div className="space-y-2">
                            {lines.map((line, idx) => (
                                <div key={line.id} className="flex items-center gap-2 bg-surface/50 border border-border rounded-lg p-2">
                                    <select value={line.productIdx} onChange={e => updateLine(idx, 'productIdx', Number(e.target.value))}
                                        className="flex-1 bg-surface border border-border rounded-md h-8 px-2 text-[12px] text-foreground outline-none appearance-none">
                                        {mockProducts.map((p, i) => <option key={p.id} value={i}>{p.sku} — {p.name}</option>)}
                                    </select>
                                    <input type="number" min={1} value={line.qty} onChange={e => updateLine(idx, 'qty', Math.max(1, +e.target.value))}
                                        className="w-16 bg-surface border border-border rounded-md h-8 px-2 text-[12px] text-foreground text-center outline-none" />
                                    <input type="number" min={0} value={line.price} onChange={e => updateLine(idx, 'price', Math.max(0, +e.target.value))}
                                        className="w-20 bg-surface border border-border rounded-md h-8 px-2 text-[12px] text-foreground text-center outline-none" placeholder="Price" />
                                    <button onClick={() => removeLine(idx)} className="p-1.5 text-muted hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 h-9 rounded-lg text-[13px] font-medium text-muted border border-border hover:bg-surface">Cancel</button>
                    <button disabled={!valid || isSaving} onClick={handleSave}
                        className={cn("px-6 h-9 rounded-lg font-bold text-[13px] flex items-center gap-2 transition-all active:scale-95",
                            valid && !isSaving ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg" : "bg-surface text-muted cursor-not-allowed")}>
                        <Plus size={14} /> Save Draft
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryFormModal;


