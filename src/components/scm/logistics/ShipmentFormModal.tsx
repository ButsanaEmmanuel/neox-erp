import React, { useState } from 'react';
import { X, Plus, Trash2, Box, MapPin, Truck, Calendar } from 'lucide-react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { Shipment, LogisticsFlowType, ShipmentLine } from '../../../types/logistics';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';

interface ShipmentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    shipment?: Shipment; // if editing
}

export const ShipmentFormModal: React.FC<ShipmentFormModalProps> = ({ isOpen, onClose, shipment }) => {
    const { saveShipment } = useLogisticsStore();
    const { products } = useScmStore();

    const [flowType, setFlowType] = useState<LogisticsFlowType>(shipment?.flowType || 'INBOUND');
    const [origin, setOrigin] = useState(shipment?.originLocationId || '');
    const [destination, setDestination] = useState(shipment?.destinationLocationId || '');
    const [carrier, setCarrier] = useState(shipment?.carrierId || '');
    const [etaDate, setEtaDate] = useState(shipment?.etaDate || '');
    const [shipDate, setShipDate] = useState(shipment?.shipDate || '');
    const [lines, setLines] = useState<ShipmentLine[]>(shipment?.lines || []);
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleAddLine = () => {
        if (products.length === 0) return;
        const prod = products[0];
        setLines([...lines, {
            id: uuidv4(),
            itemId: prod.id,
            sku: prod.sku,
            description: prod.name,
            qtyOrdered: 1,
            qtyShipped: 0,
            qtyReceived: 0,
            qtyDamaged: 0,
            qtyShort: 0,
            uom: 'pcs',
            unitPrice: prod.costPerUnit || 0,
            currency: 'USD',
            receivingBatches: []
        }]);
    };

    const handleUpdateLine = (id: string, field: keyof ShipmentLine, value: any) => {
        setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
        // Update product info if itemId changed
        if (field === 'itemId') {
            const prod = products.find(p => p.id === value);
            if (prod) {
                setLines(prev => prev.map(l => l.id === id ? { ...l, sku: prod.sku, description: prod.name } : l));
            }
        }
    };

    const handleRemoveLine = (id: string) => {
        setLines(lines.filter(l => l.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);

        if (!origin || !destination || lines.length === 0) {
            return;
        }

        const newShipment: Shipment = {
            id: shipment?.id || uuidv4(),
            code: shipment?.code || `SHP-${Math.floor(Math.random() * 100000)}`,
            flowType,
            status: shipment?.status || 'DRAFT',
            originLocationId: origin,
            destinationLocationId: destination,
            carrierId: carrier,
            etaDate: etaDate || undefined,
            shipDate: shipDate || undefined,
            lines,
            attachments: shipment?.attachments || [],
            auditLog: shipment?.auditLog || [{
                id: uuidv4(),
                action: 'CREATED',
                message: 'Shipment record created',
                actor: 'current-user',
                timestamp: new Date().toISOString()
            }],
            exceptionIds: shipment?.exceptionIds || [],
            tags: shipment?.tags || [],
            createdAt: shipment?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: shipment?.createdBy || 'current-user'
        };

        if (!shipment) {
            newShipment.auditLog.push({
                id: uuidv4(),
                action: 'STATUS_CHANGED_DRAFT',
                message: 'Status set to Draft',
                actor: 'current-user',
                timestamp: new Date().toISOString()
            });
        }

        await saveShipment(newShipment);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-app border border-border shadow-2xl rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh] relative z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border bg-surface/50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-foreground">
                        {shipment ? 'Edit Shipment' : 'Create New Shipment'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-muted hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form id="shipment-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
                        {/* Flow Selection */}
                        <div className="flex flex-col gap-3">
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Flow Type</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setFlowType('INBOUND')}
                                    className={`p-4 rounded-xl border flex flex-col gap-2 transition-all text-left ${flowType === 'INBOUND' ? 'border-blue-500 bg-blue-500/10 shadow-sm' : 'border-border bg-surface hover:border-muted text-muted'}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${flowType === 'INBOUND' ? 'bg-blue-500 text-white' : 'bg-background border border-border'}`}>
                                        <Box size={16} />
                                    </div>
                                    <div className="font-bold text-foreground">Inbound</div>
                                    <div className="text-xs">Receiving goods from suppliers</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFlowType('OUTBOUND')}
                                    className={`p-4 rounded-xl border flex flex-col gap-2 transition-all text-left ${flowType === 'OUTBOUND' ? 'border-purple-500 bg-purple-500/10 shadow-sm' : 'border-border bg-surface hover:border-muted text-muted'}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${flowType === 'OUTBOUND' ? 'bg-purple-500 text-white' : 'bg-background border border-border'}`}>
                                        <Truck size={16} />
                                    </div>
                                    <div className="font-bold text-foreground">Outbound</div>
                                    <div className="text-xs">Shipping goods to customers</div>
                                </button>
                            </div>
                        </div>

                        {/* Origins & Destinations */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin size={12} /> Origin <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    value={origin}
                                    onChange={e => { setOrigin(e.target.value); if (submitted) setSubmitted(false); }}
                                    placeholder={flowType === 'INBOUND' ? "Supplier Location" : "Warehouse Alpha"}
                                    className={cn("bg-surface border rounded-lg h-10 px-3 text-[13px] text-foreground focus:ring-1 transition-all",
                                        submitted && !origin ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : "border-border focus:border-blue-500 focus:ring-blue-500"
                                    )}
                                />
                                {submitted && !origin && <span className="text-[11px] text-rose-500 font-medium">Origin is required</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin size={12} /> Destination <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    value={destination}
                                    onChange={e => { setDestination(e.target.value); if (submitted) setSubmitted(false); }}
                                    placeholder={flowType === 'INBOUND' ? "Warehouse Alpha" : "Customer Address"}
                                    className={cn("bg-surface border rounded-lg h-10 px-3 text-[13px] text-foreground focus:ring-1 transition-all",
                                        submitted && !destination ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : "border-border focus:border-blue-500 focus:ring-blue-500"
                                    )}
                                />
                                {submitted && !destination && <span className="text-[11px] text-rose-500 font-medium">Destination is required</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Carrier</label>
                                <input
                                    value={carrier}
                                    onChange={e => setCarrier(e.target.value)}
                                    placeholder="e.g. FedEx, DHL"
                                    className="bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <Calendar size={12} /> Ship Date
                                </label>
                                <input
                                    type="date"
                                    value={shipDate.split('T')[0]}
                                    onChange={e => setShipDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                                    <Calendar size={12} /> ETA
                                </label>
                                <input
                                    type="date"
                                    value={etaDate.split('T')[0]}
                                    onChange={e => setEtaDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="bg-surface border border-border rounded-lg h-10 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Line Items */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between pb-2 border-b border-border">
                                <label className="text-[11px] font-bold text-muted uppercase tracking-widest">
                                    Shipment Lines <span className="text-rose-500">*</span>
                                </label>
                                <button type="button" onClick={() => { handleAddLine(); if (submitted) setSubmitted(false); }} className="text-[11px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1">
                                    <Plus size={12} /> Add Item
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {lines.map(line => (
                                    <div key={line.id} className="flex items-center gap-3 bg-view border border-border p-2 rounded-lg group">
                                        <select
                                            value={line.itemId}
                                            onChange={(e) => handleUpdateLine(line.id, 'itemId', e.target.value)}
                                            className="flex-1 bg-surface border border-border rounded-md h-8 text-[12px] px-2 text-foreground"
                                        >
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            value={line.qtyOrdered}
                                            onChange={(e) => handleUpdateLine(line.id, 'qtyOrdered', parseInt(e.target.value) || 0)}
                                            className="w-24 bg-surface border border-border rounded-md h-8 text-[12px] px-2 text-foreground"
                                            placeholder="Qty"
                                            min="1"
                                        />
                                        <input
                                            value={line.uom}
                                            onChange={(e) => handleUpdateLine(line.id, 'uom', e.target.value)}
                                            className="w-16 bg-surface border border-border rounded-md h-8 text-[12px] px-2 text-center text-foreground uppercase"
                                            placeholder="UOM"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLine(line.id)}
                                            className="w-8 h-8 rounded flex items-center justify-center text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {lines.length === 0 && (
                                    <div className={cn("p-4 text-center border-2 border-dashed rounded-lg text-sm", submitted ? "border-rose-500/50 text-rose-500 bg-rose-500/5" : "border-border text-muted")}>
                                        No items added. <button type="button" onClick={() => { handleAddLine(); if (submitted) setSubmitted(false); }} className={cn("underline underline-offset-2", submitted ? "text-rose-500 font-bold" : "text-blue-500")}>Add your first item</button>
                                        {submitted && <div className="text-[11px] mt-2 font-medium">At least one item is required to create a shipment.</div>}
                                    </div>
                                )}
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-border bg-surface/50 rounded-b-2xl flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="shipment-form"
                        className="px-4 py-2 rounded-lg text-sm font-bold text-primary bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Save Shipment
                    </button>
                </div>
            </div>
        </div>
    );
};


