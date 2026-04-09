import React, { useState } from 'react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { X, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { logIssue } from '../../../services/exceptionOrchestrator';
import { ExceptionType, ExceptionCase } from '../../../types/logistics';

interface ExceptionFormModalProps {
    onClose: () => void;
    onCreated: () => void;
    prefill?: { entityType?: ExceptionCase['linkedEntityType']; entityId?: string };
}

const TYPE_OPTIONS: { value: ExceptionType; label: string }[] = [
    { value: 'DAMAGE', label: 'Damage' },
    { value: 'SHORTAGE', label: 'Shortage' },
    { value: 'DELAY', label: 'Delay' },
    { value: 'LOST', label: 'Lost in Transit' },
    { value: 'OVER_RECEIPT', label: 'Over receipt' },
    { value: 'CUSTOMS_HOLD', label: 'Customs Hold' },
    { value: 'DOCS_MISSING', label: 'Documents Missing' },
    { value: 'QUALITY_FAIL', label: 'Quality Failure' },
    { value: 'POD_MISSING', label: 'POD Missing' },
    { value: 'REFUSED_DELIVERY', label: 'Refused Delivery' },
    { value: 'WRONG_ITEM', label: 'Wrong Item' },
    { value: 'SERIAL_LOT_MISSING', label: 'Serial/Lot Missing' },
    { value: 'OTHER', label: 'Other' },
];

const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const ENTITY_TYPES: ExceptionCase['linkedEntityType'][] = ['SHIPMENT', 'TRANSFER', 'DELIVERY', 'GRN'];

const ExceptionFormModal: React.FC<ExceptionFormModalProps> = ({ onClose, onCreated, prefill }) => {
    const { shipments, transfers, deliveries } = useLogisticsStore();
    const [type, setType] = useState<ExceptionType>('DAMAGE');
    const [severity, setSeverity] = useState<typeof SEVERITY_OPTIONS[number]>('MEDIUM');
    const [summary, setSummary] = useState('');
    const [details, setDetails] = useState('');
    const [entityType, setEntityType] = useState<ExceptionCase['linkedEntityType']>(prefill?.entityType || 'SHIPMENT');
    const [entityId, setEntityId] = useState(prefill?.entityId || '');
    const [assignedTo, setAssignedTo] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const entityOptions = entityType === 'SHIPMENT' ? shipments.map(s => ({ id: s.id, label: s.code }))
        : entityType === 'TRANSFER' ? transfers.map(t => ({ id: t.id, label: t.code }))
            : entityType === 'DELIVERY' ? deliveries.map(d => ({ id: d.id, label: d.code }))
                : [];

    const valid = summary.trim() && entityId;

    const handleSave = () => {
        if (!valid) return;
        setIsSaving(true);
        try {
            logIssue({
                type, severity, summary: summary.trim(), details: details.trim(),
                linkedEntityType: entityType, linkedEntityId: entityId,
                assignedTo: assignedTo || undefined,
                dueDate: dueDate || undefined,
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
            <div className="bg-card border border-border rounded-2xl w-[580px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <AlertTriangle size={18} className="text-rose-500" /> Log Issue
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Type *</label>
                            <select value={type} onChange={e => setType(e.target.value as ExceptionType)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none appearance-none">
                                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Severity *</label>
                            <select value={severity} onChange={e => setSeverity(e.target.value as any)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none appearance-none">
                                {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Summary *</label>
                        <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brief issue description..."
                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none" />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Details</label>
                        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Full description..." rows={3}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Linked Entity Type *</label>
                            <select value={entityType} onChange={e => { setEntityType(e.target.value as any); setEntityId(''); }}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none appearance-none">
                                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Linked Entity *</label>
                            <select value={entityId} onChange={e => setEntityId(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none appearance-none">
                                <option value="">Select...</option>
                                {entityOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Assigned To</label>
                            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="e.g. user-1"
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 h-9 rounded-lg text-[13px] font-medium text-muted border border-border hover:bg-surface">Cancel</button>
                    <button disabled={!valid || isSaving} onClick={handleSave}
                        className={cn("px-6 h-9 rounded-lg font-bold text-[13px] flex items-center gap-2 transition-all active:scale-95",
                            valid && !isSaving ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg" : "bg-surface text-muted cursor-not-allowed")}>
                        <Plus size={14} /> Log Issue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExceptionFormModal;


