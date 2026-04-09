import React, { useState, useEffect } from 'react';
import { useScmStore } from '../../../store/scm/useScmStore';
import { useRequisitionsStore } from '../../../store/scm/useRequisitionsStore';
import { RequisitionStatus, FulfillmentRoute } from '../../../types/requisition';
import { orchestrateFulfillmentRoute, createPOForRequisition, createTransferForRequisition } from '../../../services/requisitionOrchestrator';
import { format } from 'date-fns';
import {
    ArrowLeft, Edit3, Trash2,
    Package, FileText, MapPin, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { usePermissions } from '../../../hooks/usePermissions';

interface RequisitionDetailPageProps {
    requisitionId: string;
    onBack: () => void;
    onEditDraft: (id: string) => void;
    onNavigateToPO: (id: string) => void;
    onNavigateToTransfer: (id: string) => void;
}

export const RequisitionDetailPage: React.FC<RequisitionDetailPageProps> = ({ requisitionId, onBack, onEditDraft, onNavigateToPO, onNavigateToTransfer }) => {
    const { requisitions, deleteRequisition, approveRequisition, rejectRequisition, markFulfilled, closeRequisition } = useRequisitionsStore();
    const { locations, suppliers, fetchSuppliers } = useScmStore();
    const { hasPermission } = usePermissions();
    const userName = 'Current User';
    const canApproveRequisition = hasPermission('scm', 'requisition', 'approve');

    const req = requisitions.find((r: any) => r.id === requisitionId);

    const [isProcessing, setIsProcessing] = useState(false);
    const [supplierId, setSupplierId] = useState('');
    const [showSourceModal, setShowSourceModal] = useState(req?.status === 'SOURCING');

    useEffect(() => {
        fetchSuppliers();
        // If status is SOURCING but modal is not showing, show it
        if (req?.status === 'SOURCING') setShowSourceModal(true);
    }, [fetchSuppliers, req?.status]);

    if (!req) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <p className="text-muted mb-4">Requisition not found.</p>
                <button onClick={onBack} className="text-blue-500 hover:underline">Go Back</button>
            </div>
        );
    }

    const locationName = locations.find(l => l.id === req.requestedForLocationId)?.name || req.requestedForLocationId;

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this draft?')) {
            deleteRequisition(req.id);
            onBack();
        }
    };

    const handleAction = async (action: 'approve' | 'reject' | 'fulfill' | 'close') => {
        setIsProcessing(true);
        try {
            if (action === 'approve') approveRequisition(req.id, userName);
            if (action === 'reject') {
                const reason = prompt('Reason for rejection:');
                if (reason) rejectRequisition(req.id, reason, userName);
            }
            if (action === 'fulfill') {
                const lineFulfillments = req.lines.map((l: any) => ({ lineId: l.id, qty: l.qtyApproved - l.qtyFulfilled }));
                markFulfilled(req.id, lineFulfillments, userName);
            }
            if (action === 'close') closeRequisition(req.id, userName);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRoute = async (route: FulfillmentRoute) => {
        setIsProcessing(true);
        try {
            await orchestrateFulfillmentRoute(req.id, route, userName);

            if (route === 'FROM_STOCK') {
                // Stock allocation happens in orchestrator
            } else if (route === 'PROCUREMENT_PO') {
                setShowSourceModal(true); // Must select supplier
            } else if (route === 'TRANSFER') {
                // For demo, just pick the first main warehouse
                const mainWh = locations.find(l => l.type === 'warehouse') || locations[0];
                if (mainWh) {
                    await createTransferForRequisition(req.id, mainWh.id, userName);
                }
            }
        } finally {
            if (route !== 'PROCUREMENT_PO') setIsProcessing(false);
        }
    };

    const handleCreatePO = async () => {
        if (!supplierId) return;
        setIsProcessing(true);
        try {
            await createPOForRequisition(req.id, supplierId, userName);
            setShowSourceModal(false);
        } finally {
            setIsProcessing(false);
        }
    };


    const hasApprovedQty = req.lines.some((line: any) => (line.qtyApproved ?? 0) > 0);

    const canCreatePO =
        req.status === 'SOURCING' &&
        !!supplierId &&
        hasApprovedQty &&
        !isProcessing;

    const renderProgress = () => {
        if (req.status === 'REJECTED' || req.status === 'CANCELLED') {
            return (
                <div className="flex items-center gap-2 text-rose-500 px-4 py-3 bg-rose-500/10 rounded-lg">
                    <XCircle size={18} />
                    <span className="font-bold text-[13px]">Requisition {req.status}</span>
                </div>
            );
        }

        const stages = [
            { id: 'DRAFT', label: 'Draft' },
            { id: 'SUBMITTED', label: 'Review' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'SOURCING', label: 'Sourcing' },
            { id: 'FULFILLING', label: 'Fulfilling' },
            { id: 'CLOSED', label: 'Closed' }
        ];

        let activeIdx = 0;
        if (['SUBMITTED'].includes(req.status)) activeIdx = 1;
        if (['APPROVED'].includes(req.status)) activeIdx = 2;
        if (['PO_CREATED', 'TRANSFER_CREATED'].includes(req.status)) activeIdx = 3;
        if (['FULFILLING', 'FULFILLED'].includes(req.status)) activeIdx = 4;
        if (['CLOSED'].includes(req.status)) activeIdx = 5;

        return (
            <div className="flex items-center w-full max-w-2xl mt-6">
                {stages.map((stage, idx) => (
                    <React.Fragment key={stage.id}>
                        <div className="flex flex-col items-center gap-2 relative z-10">
                            <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                                idx < activeIdx ? "bg-blue-500 border-blue-500 text-primary" :
                                    idx === activeIdx ? "bg-surface border-blue-500 text-blue-500 ring-4 ring-blue-500/20" :
                                        "bg-surface border-border text-muted"
                            )}>
                                {idx < activeIdx ? <CheckCircle2 size={12} /> : idx + 1}
                            </div>
                            <span className={cn(
                                "text-[11px] font-medium absolute top-8 whitespace-nowrap",
                                idx <= activeIdx ? "text-foreground" : "text-muted"
                            )}>{stage.label}</span>
                        </div>
                        {idx < stages.length - 1 && (
                            <div className={cn(
                                "flex-1 h-0.5 -mt-6 mx-2 transition-colors",
                                idx < activeIdx ? "bg-blue-500" : "bg-border"
                            )} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-app">
            <div className="p-6 border-b border-border bg-card flex-none">
                <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-foreground text-[13px] font-medium mb-4 transition-colors">
                    <ArrowLeft size={16} /> Back to Requisitions
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-foreground">{req.code}</h1>
                            <span className={cn("px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider",
                                req.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                    req.status === 'DRAFT' ? "bg-slate-500/10 text-muted border-slate-500/20" :
                                        req.status === 'SUBMITTED' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                            "bg-surface text-foreground border-border"
                            )}>
                                {req.status.replace('_', ' ')}
                            </span>
                        </div>
                        <p className="text-sm text-muted">Requested by <span className="text-foreground font-medium">{req.requestedBy}</span> on {format(new Date(req.requestedAt), 'MMM d, yyyy')}</p>
                    </div>

                    <div className="flex gap-2">
                        {req.status === 'DRAFT' && (
                            <>
                                <button onClick={() => handleDelete()} className="p-2 text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => onEditDraft(req.id)} className="h-9 px-4 bg-surface border border-border rounded-lg text-foreground text-[13px] font-bold hover:border-blue-500/50 transition-all flex items-center gap-2">
                                    <Edit3 size={16} /> Edit Draft
                                </button>
                            </>
                        )}
                        {req.status === 'SUBMITTED' && canApproveRequisition && (
                            <>
                                <button onClick={() => handleAction('reject')} disabled={isProcessing} className="h-9 px-4 bg-surface border border-rose-500/30 text-rose-500 rounded-lg text-[13px] font-bold hover:bg-rose-500/10 transition-all">
                                    Reject
                                </button>
                                <button onClick={() => handleAction('approve')} disabled={isProcessing} className="h-9 px-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rounded-lg text-[13px] font-bold transition-all active:scale-95">
                                    Approve
                                </button>
                            </>
                        )}
                        {req.status === 'APPROVED' && (
                            <>
                                <button onClick={() => handleRoute('FROM_STOCK')} disabled={isProcessing} className="h-9 px-4 bg-surface border border-border text-foreground hover:border-blue-500/50 rounded-lg text-[13px] font-bold transition-all">
                                    Fulfill from Stock
                                </button>
                                <button onClick={() => handleRoute('TRANSFER')} disabled={isProcessing} className="h-9 px-4 bg-surface border border-border text-foreground hover:border-blue-500/50 rounded-lg text-[13px] font-bold transition-all">
                                    Create Transfer
                                </button>
                                <button onClick={() => handleRoute('PROCUREMENT_PO')} disabled={isProcessing} className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-lg text-[13px] font-bold transition-all active:scale-95">
                                    Create PO
                                </button>
                            </>
                        )}
                        {['PO_CREATED', 'TRANSFER_CREATED', 'FULFILLING'].includes(req.status) && (
                            <button onClick={() => handleAction('fulfill')} disabled={isProcessing} className="h-9 px-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg rounded-lg text-[13px] font-bold transition-all active:scale-95">
                                Mark Complete (Fulfilled)
                            </button>
                        )}
                        {req.status === 'FULFILLED' && (
                            <button onClick={() => handleAction('close')} disabled={isProcessing} className="h-9 px-6 bg-slate-700 hover:bg-slate-600 text-white shadow-lg rounded-lg text-[13px] font-bold transition-all active:scale-95">
                                Close Requisition
                            </button>
                        )}
                    </div>
                </div>
                {renderProgress()}
            </div>

            <div className="flex-1 overflow-auto bg-app custom-scrollbar p-6">
                <div className="max-w-5xl mx-auto grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-6">
                        {showSourceModal && (
                            <div className="p-4 bg-surface border border-blue-500/30 rounded-xl mb-6 flex flex-col gap-3">
                                <h3 className="text-[13px] font-bold text-foreground">Select Supplier for PO</h3>
                                <div className="flex gap-2">
                                    <select
                                        value={supplierId}
                                        onChange={(e) => {
                                            console.log('Supplier selected:', e.target.value);
                                            setSupplierId(e.target.value);
                                        }}
                                        className="flex-1 h-9 bg-card border border-border rounded-lg px-3 text-[13px] text-foreground focus:border-blue-500 outline-none appearance-none"
                                    >
                                        <option value="">Select a supplier...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <button
                                        onClick={handleCreatePO}
                                        disabled={!canCreatePO}
                                        className="h-9 px-4 bg-blue-600 text-white rounded-lg text-[13px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
                                    >
                                        Confirm PO Creation
                                    </button>
                                    <button
                                        onClick={() => setShowSourceModal(false)}
                                        className="h-9 px-4 bg-surface text-foreground border border-border rounded-lg text-[13px] font-bold hover:bg-surface/80 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-border bg-surface/50 flex justify-between items-center">
                                <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
                                    Line Items
                                </h3>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-surface/30 border-b border-border">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Item</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Requested</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Approved</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Allocated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {req.lines.map((line: any) => (
                                        <tr key={line.id} className="hover:bg-surface/20 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-medium text-foreground">{line.description || line.serviceName}</span>
                                                    {line.sku && <span className="text-[11px] text-muted">{line.sku}</span>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="text-[13px] text-foreground">{line.qtyRequested} <span className="text-muted text-[11px]">{line.uom}</span></span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="text-[13px] font-medium text-blue-500">{line.qtyApproved}</span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[13px] text-foreground">{line.qtyAllocated + line.qtyFulfilled}</span>
                                                    {line.qtyAllocated + line.qtyFulfilled < line.qtyApproved && ['APPROVED', 'SOURCING'].includes(req.status) && (
                                                        <span className="text-[10px] text-amber-500 font-medium">Pending Allocation</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {(req.linkedPOId || req.linkedTransferId) && (
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="text-[14px] font-bold text-foreground mb-4">Linked Documents</h3>
                                <div className="flex gap-4">
                                    {req.linkedPOId && (
                                        <button onClick={() => onNavigateToPO(req.linkedPOId!)} className="flex items-center gap-3 p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors text-indigo-500 font-medium text-[13px]">
                                            <FileText size={16} /> Purchase Order
                                            <ArrowRight size={14} className="ml-2" />
                                        </button>
                                    )}
                                    {req.linkedTransferId && (
                                        <button onClick={() => onNavigateToTransfer(req.linkedTransferId!)} className="flex items-center gap-3 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 transition-colors text-violet-500 font-medium text-[13px]">
                                            <Package size={16} /> Internal Transfer
                                            <ArrowRight size={14} className="ml-2" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-xl p-5">
                            <h3 className="text-[14px] font-bold text-foreground mb-4">Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Type & Priority</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-foreground bg-surface px-2 py-1 rounded">{req.type}</span>
                                        <span className={cn("text-[13px] px-2 py-1 rounded font-medium",
                                            req.priority === 'URGENT' ? "bg-rose-500/10 text-rose-500" :
                                                req.priority === 'HIGH' ? "bg-amber-500/10 text-amber-500" :
                                                    "bg-surface text-foreground"
                                        )}>{req.priority}</span>
                                    </div>
                                </div>
                                <div className="h-px bg-border" />
                                <div>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Deliver To</p>
                                    <p className="text-[13px] text-foreground flex items-center gap-1.5"><MapPin size={14} className="text-muted" /> {locationName}</p>
                                </div>
                                <div className="h-px bg-border" />
                                <div>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Justification</p>
                                    <p className="text-[13px] text-foreground/80 leading-relaxed">{req.justification || 'No justification provided.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-96">
                            <div className="px-5 py-4 border-b border-border bg-surface/50">
                                <h3 className="text-[14px] font-bold text-foreground">Audit Summary</h3>
                            </div>
                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 relative">
                                <div className="absolute left-6 top-6 bottom-6 w-px bg-border z-0" />
                                <div className="space-y-4 relative z-10">
                                    {req.auditLog.map((log: any) => (
                                        <div key={log.id} className="flex gap-3 relative">
                                            <div className="w-4 h-4 rounded-full bg-surface border border-border flex-none shrink-0 mt-0.5 relative z-10" />
                                            <div className="flex flex-col pb-2">
                                                <span className="text-[13px] font-medium text-foreground">{log.action.replace('_', ' ')}</span>
                                                <span className="text-[12px] text-foreground/80 mt-0.5">{log.message}</span>
                                                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted font-medium">
                                                    <span>{log.actor}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


