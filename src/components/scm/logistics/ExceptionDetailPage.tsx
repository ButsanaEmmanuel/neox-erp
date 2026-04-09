import React, { useState, useMemo, useEffect } from 'react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import {
    ArrowLeft, AlertTriangle, Clock, CheckCircle2, ExternalLink,
    FileText, Loader2, User, Calendar, Shield, MessageSquare,
    Eye
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '../../../utils/cn';
import { ExceptionStatus, ExceptionType, ResolutionActionType } from '../../../types/logistics';
import {
    transitionException, getLinkedEntityCode, isBlocking, assignException
} from '../../../services/exceptionOrchestrator';

interface ExceptionDetailPageProps {
    exceptionId: string;
    onBack: () => void;
    onNavigate?: (view: string) => void;
}

const STATUS_CONFIG: Record<ExceptionStatus, { label: string; color: string; icon: any }> = {
    OPEN: { label: 'Open', color: 'rose', icon: AlertTriangle },
    UNDER_REVIEW: { label: 'Under Review', color: 'amber', icon: Clock },
    RESOLVED: { label: 'Resolved', color: 'emerald', icon: CheckCircle2 },
    CLOSED: { label: 'Closed', color: 'slate', icon: CheckCircle2 },
};

const TYPE_LABELS: Record<ExceptionType, string> = {
    DAMAGE: 'Damage', SHORTAGE: 'Shortage', DELAY: 'Delay', LOST: 'Lost in Transit',
    OVER_RECEIPT: 'Over Receipt', CUSTOMS_HOLD: 'Customs Hold', DOCS_MISSING: 'Docs Missing',
    QUALITY_FAIL: 'Quality Failure', POD_MISSING: 'POD Missing', REFUSED_DELIVERY: 'Refused Delivery',
    WRONG_ITEM: 'Wrong Item', SERIAL_LOT_MISSING: 'Serial/Lot Missing', OTHER: 'Other',
};

const SEVERITY_COLORS: Record<string, string> = {
    LOW: 'text-muted bg-slate-500/10 border-slate-500/20',
    MEDIUM: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    HIGH: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    CRITICAL: 'text-red-600 bg-red-600/10 border-red-600/20 font-bold',
};

const RESOLUTION_OPTIONS: { value: ResolutionActionType; label: string; forEntity: string[] }[] = [
    { value: 'RE_SCHEDULE', label: 'Re-schedule ETA', forEntity: ['SHIPMENT'] },
    { value: 'CREATE_REPLACEMENT_SHIPMENT', label: 'Create Replacement Shipment', forEntity: ['SHIPMENT', 'GRN'] },
    { value: 'CANCEL_SHIPMENT', label: 'Cancel Shipment', forEntity: ['SHIPMENT'] },
    { value: 'ACCEPT_WITH_DISCREPANCY', label: 'Accept with Discrepancy', forEntity: ['GRN', 'SHIPMENT', 'TRANSFER'] },
    { value: 'REQUEST_REPLACEMENT', label: 'Request Replacement', forEntity: ['GRN', 'SHIPMENT', 'TRANSFER'] },
    { value: 'RETURN_TO_SUPPLIER', label: 'Return to Supplier', forEntity: ['GRN', 'SHIPMENT', 'TRANSFER'] },
    { value: 'WRITE_OFF', label: 'Write-off (Stock Adjustment)', forEntity: ['GRN', 'SHIPMENT', 'TRANSFER'] },
    { value: 'CAPTURE_POD', label: 'Capture POD', forEntity: ['DELIVERY'] },
    { value: 'RE_DELIVER', label: 'Re-deliver', forEntity: ['DELIVERY'] },
    { value: 'ISSUE_CREDIT', label: 'Issue Credit Note', forEntity: ['DELIVERY', 'SHIPMENT'] },
    { value: 'OTHER', label: 'Other', forEntity: ['SHIPMENT', 'TRANSFER', 'DELIVERY', 'GRN'] },
];

const ExceptionDetailPage: React.FC<ExceptionDetailPageProps> = ({ exceptionId, onBack, onNavigate }) => {
    const { exceptions, fetchExceptions, fetchShipments, fetchTransfers, fetchDeliveries } = useLogisticsStore();
    const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'activity'>('details');
    const [isProcessing, setIsProcessing] = useState(false);
    const [resolutionAction, setResolutionAction] = useState<ResolutionActionType | ''>('');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [assigneeInput, setAssigneeInput] = useState('');

    useEffect(() => { fetchExceptions(); }, [fetchExceptions]);

    const exception = useMemo(() => exceptions.find(e => e.id === exceptionId), [exceptions, exceptionId]);
    if (!exception) return <div className="h-full flex items-center justify-center text-muted">Exception not found.</div>;

    const config = STATUS_CONFIG[exception.status];
    const linkedCode = getLinkedEntityCode(exception.linkedEntityType, exception.linkedEntityId);
    const blocking = isBlocking(exception.type, exception.severity);
    const overdue = exception.dueDate && !['RESOLVED', 'CLOSED'].includes(exception.status) && isPast(new Date(exception.dueDate));

    const relevantResolutions = RESOLUTION_OPTIONS.filter(o =>
        o.forEntity.includes(exception.linkedEntityType)
    );

    const handleTransition = async (next: ExceptionStatus, resolution?: { actionType: ResolutionActionType; notes?: string }) => {
        setIsProcessing(true);
        try {
            transitionException(exception.id, next, resolution, 'Current User');
            await Promise.all([fetchExceptions(), fetchShipments(), fetchTransfers(), fetchDeliveries()]);
        } finally { setIsProcessing(false); }
    };

    const handleAssign = async () => {
        if (assigneeInput.trim() !== (exception.assignedTo || '')) {
            setIsProcessing(true);
            try {
                assignException(exception.id, assigneeInput.trim() || 'Unassigned', 'Current User');
                await fetchExceptions();
            } finally {
                setIsProcessing(false);
            }
        }
        setIsAssigning(false);
    };

    const navigateToEntity = () => {
        const t = exception.linkedEntityType;
        const id = exception.linkedEntityId;
        if (t === 'SHIPMENT' || t === 'SHIPMENT_LINE') onNavigate?.(`scm-logistics-shipments-detail-${id}`);
        else if (t === 'TRANSFER') onNavigate?.(`scm-logistics-transfers-detail-${id}`);
        else if (t === 'DELIVERY') onNavigate?.(`scm-logistics-deliveries-detail-${id}`);
    };

    const sorted = [...exception.auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="h-full flex flex-col bg-app overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between flex-none bg-app z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors text-muted hover:text-foreground">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                            {exception.code}
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1.5",
                                config.color === 'rose' && "bg-rose-500/10 text-rose-500 border-rose-500/20",
                                config.color === 'amber' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                config.color === 'emerald' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                config.color === 'slate' && "bg-slate-500/10 text-muted border-slate-500/20",
                            )}>
                                <config.icon size={12} /> {config.label}
                            </span>
                            <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border", SEVERITY_COLORS[exception.severity])}>
                                {exception.severity}
                            </span>
                            {blocking && <span className="text-[10px] bg-red-600/10 text-red-500 border border-red-600/20 px-2 py-1 rounded-md uppercase tracking-wider font-bold">BLOCKING</span>}
                            {overdue && <span className="text-[10px] bg-rose-600/10 text-rose-500 border border-rose-600/20 px-2 py-1 rounded-md uppercase tracking-wider font-bold">OVERDUE</span>}
                        </h1>
                        <p className="text-sm text-muted mt-0.5">{exception.summary}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {exception.status === 'OPEN' && (
                        <button disabled={isProcessing} onClick={() => handleTransition('UNDER_REVIEW')}
                            className="px-4 h-9 rounded-lg font-bold text-[13px] bg-amber-600 hover:bg-amber-500 text-primary shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Under Review
                        </button>
                    )}
                    {(exception.status === 'OPEN' || exception.status === 'UNDER_REVIEW') && (
                        <button disabled={isProcessing || !resolutionAction}
                            onClick={() => resolutionAction && handleTransition('RESOLVED', { actionType: resolutionAction as ResolutionActionType, notes: resolutionNotes || undefined })}
                            className={cn("px-4 h-9 rounded-lg font-bold text-[13px] shadow-lg active:scale-95 transition-all flex items-center gap-2",
                                resolutionAction ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-surface text-muted cursor-not-allowed")}>
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Resolve
                        </button>
                    )}
                    {exception.status === 'RESOLVED' && (
                        <button disabled={isProcessing} onClick={() => handleTransition('CLOSED')}
                            className="px-4 h-9 rounded-lg font-bold text-[13px] bg-slate-600 hover:bg-slate-500 text-white shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Close
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">
                        {/* Info Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Type</p>
                                <p className="text-[14px] font-bold text-foreground">{TYPE_LABELS[exception.type]}</p>
                            </div>
                            <button onClick={navigateToEntity} className="bg-card border border-border rounded-xl p-4 hover:border-blue-500/30 transition-colors text-left group">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center justify-between">
                                    Linked Entity <ExternalLink size={10} className="text-muted group-hover:text-blue-500" />
                                </p>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{exception.linkedEntityType}</p>
                                <p className="text-[14px] font-bold text-foreground group-hover:text-blue-500 transition-colors">{linkedCode}</p>
                            </button>
                            <div className="bg-card border border-border rounded-xl p-4">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Assigned To</p>
                                {isAssigning ? (
                                    <input
                                        autoFocus
                                        value={assigneeInput}
                                        onChange={e => setAssigneeInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleAssign();
                                            if (e.key === 'Escape') setIsAssigning(false);
                                        }}
                                        onBlur={handleAssign}
                                        className="bg-surface border border-blue-500 rounded h-7 px-2 text-[13px] text-foreground focus:outline-none w-full"
                                        placeholder="Enter name..."
                                    />
                                ) : (
                                    <p
                                        className="text-[14px] font-medium text-foreground flex items-center gap-1.5 cursor-pointer hover:text-blue-500 transition-colors group"
                                        title="Click to assign"
                                        onClick={() => {
                                            setAssigneeInput(exception.assignedTo && exception.assignedTo !== 'Unassigned' ? exception.assignedTo : '');
                                            setIsAssigning(true);
                                        }}
                                    >
                                        <User size={14} className="text-muted group-hover:text-blue-500" />
                                        {exception.assignedTo || 'Unassigned'}
                                    </p>
                                )}
                                {exception.dueDate && (
                                    <p className={cn("text-[11px] mt-1 flex items-center gap-1", overdue ? "text-rose-500 font-bold" : "text-muted")}>
                                        <Calendar size={10} /> Due {format(new Date(exception.dueDate), 'PP')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Resolution Section */}
                        {(exception.status === 'OPEN' || exception.status === 'UNDER_REVIEW') && (
                            <div className="bg-card border border-amber-500/20 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Shield size={16} className="text-amber-500" /> Resolution
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Resolution Action</label>
                                        <select value={resolutionAction} onChange={e => setResolutionAction(e.target.value as any)}
                                            className="w-full bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none appearance-none">
                                            <option value="">Select resolution action...</option>
                                            {relevantResolutions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 block">Resolution Notes</label>
                                        <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Details of the resolution..." rows={3}
                                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Resolved info */}
                        {exception.resolution && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" /> Resolution Applied
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-[13px]">
                                    <div><span className="text-muted text-[11px]">Action</span><p className="font-medium text-foreground">{exception.resolution.actionType}</p></div>
                                    <div><span className="text-muted text-[11px]">Resolved By</span><p className="font-medium text-foreground">{exception.resolution.resolvedBy || '—'}</p></div>
                                </div>
                                {exception.resolution.notes && (
                                    <div className="mt-3 pt-3 border-t border-emerald-500/20">
                                        <span className="text-muted text-[11px]">Notes</span>
                                        <p className="text-[13px] text-foreground mt-0.5">{exception.resolution.notes}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 border-b border-border">
                            {(['details', 'documents', 'activity'] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)}
                                    className={cn("px-4 py-2.5 text-[13px] font-bold capitalize transition-colors border-b-2",
                                        activeTab === tab ? "text-rose-500 border-rose-500" : "text-muted border-transparent hover:text-foreground")}>
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'details' && (
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="text-sm font-bold text-foreground mb-3">Details</h3>
                                <p className="text-[13px] text-foreground whitespace-pre-wrap">{exception.details || 'No details provided.'}</p>
                                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-[12px]">
                                    <div><span className="text-muted">Created</span><p className="text-foreground font-medium">{format(new Date(exception.createdAt), 'PPp')}</p></div>
                                    <div><span className="text-muted">Created By</span><p className="text-foreground font-medium">{exception.createdBy}</p></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
                                <FileText size={24} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No documents attached</p>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="bg-card border border-border rounded-xl p-5">
                                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><MessageSquare size={14} /> Activity</h3>
                                <div className="space-y-3">
                                    {sorted.map(evt => (
                                        <div key={evt.id} className="relative pl-4 border-l-2 border-border">
                                            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-rose-500" />
                                            <p className="text-[11px] font-medium text-foreground leading-tight">{evt.message}</p>
                                            <p className="text-[10px] text-muted mt-0.5">{format(new Date(evt.timestamp), 'PP p')} · {evt.actor}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="h-8" />
                    </div>
                </div>

                {/* Right Rail — Audit */}
                <div className="w-72 border-l border-border bg-surface/20 overflow-y-auto custom-scrollbar flex-none p-4">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5"><Clock size={12} /> Audit Trail</h4>
                    <div className="space-y-3">
                        {sorted.map(evt => (
                            <div key={evt.id} className="relative pl-4 border-l-2 border-border">
                                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-rose-500" />
                                <p className="text-[11px] font-medium text-foreground leading-tight">{evt.message}</p>
                                <p className="text-[10px] text-muted mt-0.5">{format(new Date(evt.timestamp), 'PP p')} · {evt.actor}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExceptionDetailPage;


