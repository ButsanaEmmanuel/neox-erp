import React, { useState } from 'react';
import {
    ArrowLeft, MapPin, Calendar, Package,
    MoreHorizontal, Truck, FileText,
    AlertTriangle, Plus, Download, CheckCircle2, History, Hash,
    ChevronRight
} from 'lucide-react';
import { useLogisticsStore, canTransitionTransfer } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import { TransferStatus } from '../../../types/logistics';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';
import { StatusPill } from './StatusPill';

interface TransferDetailPageProps {
    transferId: string;
    onBack: () => void;
    onNavigate?: (view: string) => void;
}

export const TransferDetailPage: React.FC<TransferDetailPageProps> = ({
    transferId,
    onBack
}) => {
    const { transitionTransferStatus } = useLogisticsStore();
    const { transfers, fetchTransfers } = useLogisticsStore();
    const { locations } = useScmStore();
    const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'exceptions'>('details');

    React.useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);

    const transfer = transfers.find(t => t.id === transferId);

    if (!transfer) {
        return (
            <div className="flex flex-col h-full bg-app items-center justify-center">
                <p className="text-muted">Transfer not found</p>
                <button onClick={onBack} className="mt-4 text-blue-500 hover:underline">Go back</button>
            </div>
        );
    }

    const handleTransition = async (newStatus: TransferStatus) => {
        try {
            await transitionTransferStatus(transfer.id, newStatus);
        } catch (error) {
            console.error("Failed to transition transfer", error);
        }
    };

    const getLocationName = (id: string) => {
        return locations.find(l => l.id === id)?.name || id;
    };

    const totalItems = transfer.lines.length;
    const totalQty = transfer.lines.reduce((acc, line) => acc + line.qtyRequested, 0);

    return (
        <div className="flex flex-col h-full bg-app overflow-hidden">
            {/* Header */}
            <div className="flex-none p-6 border-b border-border bg-app z-10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-foreground transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-foreground">{transfer.code}</h1>
                                <StatusPill status={transfer.status} type="transfer" />
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[13px] text-muted font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Hash size={14} className="text-blue-500" />
                                    <span>From {getLocationName(transfer.sourceLocationId)} to {getLocationName(transfer.destLocationId)}</span>
                                </div>
                                <span>•</span>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-purple-500" />
                                    <span>Initiated {format(new Date(transfer.createdAt), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {canTransitionTransfer(transfer, 'APPROVED') && (
                            <button
                                onClick={() => handleTransition('APPROVED')}
                                className="px-4 h-9 rounded-lg font-bold text-[13px] transition-all flex items-center gap-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                            >
                                <CheckCircle2 size={16} /> Approve
                            </button>
                        )}
                        {canTransitionTransfer(transfer, 'PICKING') && (
                            <button
                                onClick={() => handleTransition('PICKING')}
                                className="px-4 h-9 rounded-lg font-bold text-[13px] transition-all flex items-center gap-2 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
                            >
                                <Package size={16} /> Start Picking
                            </button>
                        )}
                        {canTransitionTransfer(transfer, 'DISPATCHED') && transfer.status === 'PACKED' && (
                            <button
                                onClick={() => handleTransition('DISPATCHED')}
                                className="px-4 h-9 rounded-lg font-bold text-[13px] transition-all flex items-center gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                            >
                                <Truck size={16} /> Dispatch
                            </button>
                        )}

                        {canTransitionTransfer(transfer, 'RECEIVED') && (
                            <button
                                onClick={() => alert("Implementation placeholder: Open Receiving Modal")}
                                className="px-4 h-9 rounded-lg font-bold text-[13px] transition-all flex items-center gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            >
                                <CheckCircle2 size={16} /> Receive Items
                            </button>
                        )}

                        <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors">
                            <MoreHorizontal size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <div className="flex items-center gap-3 mb-2 text-muted">
                            <MapPin size={16} className="text-amber-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Source</span>
                        </div>
                        <p className="text-[13px] font-medium text-foreground">{getLocationName(transfer.sourceLocationId)}</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <div className="flex items-center gap-3 mb-2 text-muted">
                            <MapPin size={16} className="text-emerald-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Destination</span>
                        </div>
                        <p className="text-[13px] font-medium text-foreground">{getLocationName(transfer.destLocationId)}</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <div className="flex items-center gap-3 mb-2 text-muted">
                            <Package size={16} className="text-purple-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Volume</span>
                        </div>
                        <p className="text-[13px] font-medium text-foreground">{totalItems} lines ({totalQty} items)</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-surface/30">
                        <div className="flex items-center gap-3 mb-2 text-muted">
                            <Calendar size={16} className="text-blue-500" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Needed By</span>
                        </div>
                        <p className="text-[13px] font-medium text-foreground">
                            {transfer.neededDate ? format(new Date(transfer.neededDate), 'MMM d, yyyy') : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-border">
                    {[
                        { id: 'details', label: 'Transfer Details' },
                        { id: 'documents', label: 'Documents', badge: transfer.attachments.length },
                        { id: 'exceptions', label: 'Exceptions', badge: transfer.exceptionIds.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "pb-3 text-[13px] font-bold transition-all border-b-2",
                                activeTab === tab.id
                                    ? "border-blue-500 text-blue-500"
                                    : "border-transparent text-muted hover:text-foreground"
                            )}
                        >
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className={cn(
                                    "ml-2 px-1.5 py-0.5 rounded-full text-[10px]",
                                    activeTab === tab.id ? "bg-blue-500/20" : "bg-surface"
                                )}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex min-h-0 bg-app">
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'details' && (
                        <div className="border border-border rounded-xl bg-surface/30 overflow-hidden">
                            <div className="px-4 py-3 border-b border-border bg-surface/50 font-bold text-sm text-foreground flex items-center justify-between">
                                Items
                            </div>
                            <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-4 py-3 bg-card border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                                <span>Item</span>
                                <span className="text-right">Req.</span>
                                <span className="text-right">Picked</span>
                                <span className="text-right">Rcvd.</span>
                            </div>
                            <div className="divide-y divide-border">
                                {transfer.lines.map(line => (
                                    <div key={line.id} className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-4 py-3 text-[13px] items-center hover:bg-surface/50 transition-colors">
                                        <div className="flex flex-col text-left">
                                            <span className="font-bold text-foreground">{line.description}</span>
                                            <span className="text-[11px] text-muted font-medium">{line.itemId}</span>
                                        </div>
                                        <span className="text-right tabular-nums">{line.qtyRequested}</span>
                                        <span className="text-right tabular-nums">{line.qtyPicked || 0}</span>
                                        <span className="text-right tabular-nums font-bold text-emerald-500">
                                            {line.qtyReceived || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <FileText size={16} className="text-blue-500" /> Attached Documents
                                </h3>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[12px] font-bold transition-all">
                                    <Plus size={14} /> Upload Document
                                </button>
                            </div>

                            {transfer.attachments.length === 0 ? (
                                <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-surface/10">
                                    <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mb-4 text-muted">
                                        <FileText size={24} />
                                    </div>
                                    <h4 className="text-sm font-bold text-foreground">No documents attached</h4>
                                    <p className="text-xs text-muted mt-1 max-w-[240px]">Upload shipping manifests, quality certificates, or delivery receipts.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {transfer.attachments.map(att => (
                                        <div key={att.id} className="p-4 rounded-xl border border-border bg-card hover:border-blue-500/50 transition-all group cursor-pointer shadow-sm">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-blue-500">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-foreground truncate max-w-[150px]">{att.filename}</p>
                                                        <p className="text-[10px] text-muted uppercase font-bold mt-0.5">{att.type}</p>
                                                    </div>
                                                </div>
                                                <button className="p-1.5 text-muted hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'exceptions' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-rose-500" /> Exception Cases
                                </h3>
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[12px] font-bold transition-all">
                                    <Plus size={14} /> Report Exception
                                </button>
                            </div>

                            {transfer.exceptionIds.length === 0 ? (
                                <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-surface/10">
                                    <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mb-4 text-emerald-500">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <h4 className="text-sm font-bold text-foreground">No active exceptions</h4>
                                    <p className="text-xs text-muted mt-1 max-w-[240px]">There are no reported delays or discrepancies for this transfer.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {transfer.exceptionIds.map(excId => (
                                        <div key={excId} className="p-4 rounded-xl border border-border bg-card hover:border-rose-500/50 transition-all group cursor-pointer shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                                    <AlertTriangle size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-bold text-foreground">Case #{excId.toUpperCase()}</p>
                                                    <p className="text-[11px] text-muted">Awaiting resolution by Logistics Manager</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider">High Severity</span>
                                                <ChevronRight size={14} className="text-muted group-hover:text-foreground transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Audit Trail Sidebar Placeholder */}
                <div className="w-[320px] flex-none border-l border-border bg-surface/10 flex flex-col h-full">
                    <div className="p-4 border-b border-border">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <History size={16} className="text-muted" /> Audit Trail
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-border">
                            {transfer.auditLog.map((log) => (
                                <div key={log.id} className="relative">
                                    <div className="absolute -left-5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-app" />
                                    <div className="text-[13px] font-bold text-foreground capitalize">
                                        {log.action.replace(/_/g, ' ').toLowerCase()}
                                    </div>
                                    <p className="text-[11px] text-muted mt-1">{log.message}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] font-medium text-foreground bg-surface px-1.5 py-0.5 rounded">
                                            {log.actor}
                                        </span>
                                        <span className="text-[10px] text-muted">
                                            {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


