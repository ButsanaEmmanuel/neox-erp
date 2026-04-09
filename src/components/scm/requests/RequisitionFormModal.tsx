import React, { useState, useEffect } from 'react';
import { useScmStore } from '../../../store/scm/useScmStore';
import { useRequisitionsStore } from '../../../store/scm/useRequisitionsStore';
import { RequisitionType, RequisitionPriority } from '../../../types/requisition';
import { v4 as uuidv4 } from 'uuid';
import {
    X, Plus, Trash2, Package, AlertCircle, FileText
} from 'lucide-react';
import { cn } from '../../../utils/cn';

interface RequisitionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editId?: string; // If editing an existing DRAFT
}

export const RequisitionFormModal: React.FC<RequisitionFormModalProps> = ({ isOpen, onClose, editId }) => {
    const { requisitions, createRequisition, updateRequisition } = useRequisitionsStore();
    const { locations, products, fetchProducts } = useScmStore();

    const [type, setType] = useState<RequisitionType>('STOCK');
    const [priority, setPriority] = useState<RequisitionPriority>('NORMAL');
    const [department, setDepartment] = useState('');
    const [locationId, setLocationId] = useState('');
    const [neededBy, setNeededBy] = useState('');
    const [justification, setJustification] = useState('');

    // Lines
    const [lines, setLines] = useState<any[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchProducts();

            if (editId) {
                const req = requisitions.find(r => r.id === editId);
                if (req) {
                    setType(req.type);
                    setPriority(req.priority);
                    setDepartment(req.department || '');
                    setLocationId(req.requestedForLocationId);
                    setNeededBy(req.neededBy || '');
                    setJustification(req.justification || '');
                    setLines([...req.lines]);
                }
            } else {
                // Reset defaults
                setType('STOCK');
                setPriority('NORMAL');
                setDepartment('');
                setLocationId('');
                setNeededBy('');
                setJustification('');
                setLines([{ id: uuidv4(), productId: '', qtyRequested: 1 }]);
            }
            setErrorMsg('');
        }
    }, [isOpen, editId, requisitions, fetchProducts]);

    if (!isOpen) return null;

    const addLine = () => {
        setLines(prev => [...prev, { id: uuidv4(), productId: '', qtyRequested: 1 }]);
    };

    const removeLine = (id: string) => {
        if (lines.length === 1) return;
        setLines(prev => prev.filter(l => l.id !== id));
    };

    const updateLine = (id: string, field: string, value: any) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;

            const updated = { ...l, [field]: value };

            // If product ID changed, auto-fill details
            if (field === 'productId' && value) {
                const p = products.find(prod => prod.id === value);
                if (p) {
                    updated.sku = p.sku;
                    updated.description = p.name;
                    updated.uom = 'ea';
                    updated.estimatedCost = p.costPerUnit;
                    updated.currency = 'USD';
                } else {
                    updated.sku = '';
                    updated.description = '';
                    updated.uom = '';
                    updated.estimatedCost = 0;
                    updated.currency = '';
                }
            }

            return updated;
        }));
    };

    const validate = () => {
        if (!locationId) return 'Requested For Location is required.';
        if (lines.length === 0) return 'At least one line is required.';

        for (const [i, line] of lines.entries()) {
            if (type === 'STOCK') {
                if (!line.productId) return `Line ${i + 1}: Product is required for Stock requests.`;
            } else {
                if (!line.serviceName) return `Line ${i + 1}: Service name is required.`;
            }

            if (!line.qtyRequested || line.qtyRequested <= 0) return `Line ${i + 1}: Quantity must be greater than 0.`;
        }

        return null;
    };

    const handleSave = (submit: boolean) => {
        const err = validate();
        if (err) { setErrorMsg(err); return; }

        if (submit && !justification.trim()) {
            setErrorMsg('Justification is required to submit a request.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const payload = {
                type,
                requestedBy: 'Current User', // Mock
                department,
                requestedForLocationId: locationId,
                neededBy: neededBy || undefined,
                priority,
                justification,
                lines: lines.map(l => ({
                    ...l,
                    qtyApproved: 0,
                    qtyAllocated: 0,
                    qtyFulfilled: 0
                }))
            };

            let reqId = editId;
            if (editId) {
                updateRequisition(editId, payload);
            } else {
                reqId = createRequisition(payload);
            }

            if (submit && reqId) {
                const { submitRequisition } = useRequisitionsStore.getState();
                submitRequisition(reqId, justification, 'Current User');
            }

            onClose();
        } catch (e: any) {
            setErrorMsg(e.message || 'Failed to save requisition.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-app border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border bg-card">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {editId ? 'Edit Requisition Draft' : 'Create Internal Requisition'}
                        </h2>
                        <p className="text-[13px] text-muted mt-1">Request stock or services from internal departments or procurement.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-app">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-3 text-rose-500 text-[13px] font-medium">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Requisition Type <span className="text-rose-500">*</span></label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setType('STOCK')}
                                    className={cn("flex-1 h-9 rounded-lg border text-[13px] font-bold flex items-center justify-center gap-2 transition-all",
                                        type === 'STOCK' ? "bg-blue-600/10 border-blue-600/30 text-blue-500" : "bg-card border-border text-muted hover:border-blue-500/30")}>
                                    <Package size={14} /> Stock
                                </button>
                                <button type="button" onClick={() => setType('SERVICE')}
                                    className={cn("flex-1 h-9 rounded-lg border text-[13px] font-bold flex items-center justify-center gap-2 transition-all",
                                        type === 'SERVICE' ? "bg-indigo-600/10 border-indigo-600/30 text-indigo-500" : "bg-card border-border text-muted hover:border-indigo-500/30")}>
                                    <FileText size={14} /> Service
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Priority <span className="text-rose-500">*</span></label>
                            <select value={priority} onChange={e => setPriority(e.target.value as RequisitionPriority)}
                                className="w-full h-9 bg-card border border-border rounded-lg px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none">
                                <option value="LOW">Low</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent (Immediate Action)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Department</label>
                            <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering, Maintenance..."
                                className="w-full h-9 bg-card border border-border rounded-lg px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Needed By</label>
                            <input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)}
                                className="w-full h-9 bg-card border border-border rounded-lg px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>

                        <div className="col-span-2">
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Deliver / Consume At Location <span className="text-rose-500">*</span></label>
                            <select value={locationId} onChange={e => setLocationId(e.target.value)}
                                className="w-full h-9 bg-card border border-border rounded-lg px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none">
                                <option value="">Select a location...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Justification <span className="text-rose-500">*</span> <span className="text-muted text-[10px] ml-1 lowercase font-normal">(Required for submission)</span></label>
                            <textarea value={justification} onChange={e => setJustification(e.target.value)}
                                placeholder="Explain why these items/services are needed..." rows={3}
                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none" />
                        </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-[14px] font-bold text-foreground">Requested Items / Services</h3>
                    </div>

                    <div className="border border-border rounded-xl bg-card overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-surface/50 border-b border-border">
                                <tr>
                                    {type === 'STOCK' ? (
                                        <th className="px-4 py-2 text-[10px] font-bold text-muted uppercase tracking-wider w-[60%]">Product / SKU</th>
                                    ) : (
                                        <th className="px-4 py-2 text-[10px] font-bold text-muted uppercase tracking-wider w-[40%]">Service Name</th>
                                    )}
                                    {type === 'SERVICE' && (
                                        <th className="px-4 py-2 text-[10px] font-bold text-muted uppercase tracking-wider w-[20%]">Est. Cost</th>
                                    )}
                                    <th className="px-4 py-2 text-[10px] font-bold text-muted uppercase tracking-wider w-32">Qty</th>
                                    {type === 'STOCK' && (
                                        <th className="px-4 py-2 text-[10px] font-bold text-muted uppercase tracking-wider w-20">UoM</th>
                                    )}
                                    <th className="px-4 py-2 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {lines.map((line) => (
                                    <tr key={line.id} className="group">
                                        <td className="p-2">
                                            {type === 'STOCK' ? (
                                                <select value={line.productId} onChange={e => updateLine(line.id, 'productId', e.target.value)}
                                                    className="w-full h-8 bg-surface border border-border rounded-md px-2 text-[13px] text-foreground focus:border-blue-500 outline-none appearance-none">
                                                    <option value="">Select product...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                                                </select>
                                            ) : (
                                                <input value={line.serviceName || ''} onChange={e => updateLine(line.id, 'serviceName', e.target.value)} placeholder="Plumbing repair..."
                                                    className="w-full h-8 bg-surface border border-border rounded-md px-2 text-[13px] text-foreground focus:border-blue-500 outline-none" />
                                            )}
                                        </td>
                                        {type === 'SERVICE' && (
                                            <td className="p-2">
                                                <input type="number" min="0" step="0.01" value={line.estimatedCost || ''} onChange={e => updateLine(line.id, 'estimatedCost', parseFloat(e.target.value))} placeholder="150.00"
                                                    className="w-full h-8 bg-surface border border-border rounded-md px-2 text-[13px] text-foreground focus:border-blue-500 outline-none" />
                                            </td>
                                        )}
                                        <td className="p-2">
                                            <input type="number" min="1" value={line.qtyRequested} onChange={e => updateLine(line.id, 'qtyRequested', parseInt(e.target.value, 10))}
                                                className="w-full h-8 bg-surface border border-border rounded-md px-2 text-[13px] text-foreground focus:border-blue-500 outline-none" />
                                        </td>
                                        {type === 'STOCK' && (
                                            <td className="p-2">
                                                <div className="h-8 bg-surface border border-border rounded-md px-2 text-[13px] text-muted flex items-center">
                                                    {line.uom || '—'}
                                                </div>
                                            </td>
                                        )}
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                                                className="p-1.5 rounded text-muted hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-2 border-t border-border bg-surface/50">
                            <button onClick={addLine} className="h-8 px-3 rounded text-[12px] font-bold text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center gap-1.5">
                                <Plus size={14} /> Add Line
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-card flex justify-end gap-3">
                    <button onClick={onClose} disabled={isSubmitting} className="h-9 px-4 rounded-lg text-[13px] font-bold text-muted hover:text-foreground hover:bg-surface border border-transparent hover:border-border transition-all disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={() => handleSave(false)} disabled={isSubmitting} className="h-9 px-4 rounded-lg text-[13px] font-bold text-foreground bg-surface border border-border hover:border-blue-500/50 shadow-sm transition-all disabled:opacity-50">
                        Save Draft
                    </button>
                    <button onClick={() => handleSave(true)} disabled={isSubmitting} className="h-9 px-6 rounded-lg text-[13px] font-bold text-primary bg-blue-600 hover:bg-blue-500 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2">
                        Submit Request
                    </button>
                </div>
            </div>
        </div>
    );
};


