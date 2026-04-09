import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLogisticsStore } from '../../../store/scm/useLogisticsStore';
import { useScmStore } from '../../../store/scm/useScmStore';
import {
    Search, Package, AlertTriangle, CheckCircle2, QrCode, ClipboardList,
    ArrowRight, Clock, FileText, X, Truck, ArrowDownToLine,
    Loader2, RotateCcw, BadgeCheck
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '../../../utils/cn';
import {
    getReadyToReceiveShipments,
    getReadyToReceiveTransfers,
    getGRNsForTarget,
    postShipmentGRN,
    postTransferGRN,
    ReceivingLineDraft
} from '../../../services/receivingOrchestrator';

// ── Types ────────────────────────────────────────────────────────────
type TargetTab = 'SHIPMENTS' | 'TRANSFERS';

interface ReceivingTarget {
    type: 'SHIPMENT' | 'TRANSFER';
    id: string;
    code: string;
    status: string;
    origin: string;
    destination: string;
    eta?: string;
    neededBy?: string;
    lineCount: number;
    partyName?: string;
}

interface LineDraft {
    sourceLineId: string;
    itemId: string;
    sku: string;
    description: string;
    uom: string;
    expected: number;       // qtyOrdered or qtyDispatched
    alreadyReceived: number;
    alreadyDamaged: number;
    alreadyShort: number;
    remaining: number;
    receiveNow: number;
    damaged: number;
    short: number;
    notes: string;
}

// ── Component ────────────────────────────────────────────────────────

interface ReceivingWorkspaceProps {
    onNavigate?: (view: string) => void;
}

const ReceivingWorkspace: React.FC<ReceivingWorkspaceProps> = ({ onNavigate: _onNavigate }) => {
    const { shipments, transfers, grns, fetchShipments, fetchTransfers, fetchExceptions } = useLogisticsStore();
    const { locations } = useScmStore();

    const [activeTab, setActiveTab] = useState<TargetTab>('SHIPMENTS');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTarget, setSelectedTarget] = useState<ReceivingTarget | null>(null);
    const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const getLocationName = useCallback((id: string) =>
        locations.find(l => l.id === id)?.name || id, [locations]);

    // Re-fetch on mount
    useEffect(() => {
        fetchShipments();
        fetchTransfers();
        fetchExceptions();
    }, [fetchShipments, fetchTransfers, fetchExceptions]);

    // ── Build candidates ─────────────────────────────────────────────
    const shipmentCandidates: ReceivingTarget[] = useMemo(() =>
        getReadyToReceiveShipments().map(s => ({
            type: 'SHIPMENT' as const,
            id: s.id,
            code: s.code,
            status: s.status,
            origin: s.originLocationId,
            destination: s.destinationLocationId,
            eta: s.etaDate,
            lineCount: s.lines.length,
            partyName: s.carrierId
        })), [shipments]);

    const transferCandidates: ReceivingTarget[] = useMemo(() =>
        getReadyToReceiveTransfers().map(t => ({
            type: 'TRANSFER' as const,
            id: t.id,
            code: t.code,
            status: t.status,
            origin: t.sourceLocationId,
            destination: t.destLocationId,
            eta: t.etaDate,
            neededBy: t.neededDate,
            lineCount: t.lines.length,
            partyName: t.carrierId
        })), [transfers]);

    const candidates = activeTab === 'SHIPMENTS' ? shipmentCandidates : transferCandidates;

    const filteredCandidates = useMemo(() => {
        if (!searchQuery) return candidates;
        const q = searchQuery.toLowerCase();
        return candidates.filter(c =>
            c.code.toLowerCase().includes(q) ||
            c.origin.toLowerCase().includes(q) ||
            c.destination.toLowerCase().includes(q)
        );
    }, [candidates, searchQuery]);

    // ── Select target → init drafts ──────────────────────────────────
    const handleSelectTarget = useCallback((target: ReceivingTarget) => {
        setSelectedTarget(target);
        setSuccessMessage(null);

        if (target.type === 'SHIPMENT') {
            const shp = shipments.find(s => s.id === target.id);
            if (!shp) return;
            setLineDrafts(shp.lines.map(line => {
                const remaining = line.qtyOrdered - (line.qtyReceived + line.qtyDamaged + line.qtyShort);
                return {
                    sourceLineId: line.id,
                    itemId: line.itemId,
                    sku: line.sku,
                    description: line.description,
                    uom: line.uom,
                    expected: line.qtyOrdered,
                    alreadyReceived: line.qtyReceived,
                    alreadyDamaged: line.qtyDamaged,
                    alreadyShort: line.qtyShort,
                    remaining: Math.max(0, remaining),
                    receiveNow: Math.max(0, remaining),
                    damaged: 0,
                    short: 0,
                    notes: ''
                };
            }));
        } else {
            const trf = transfers.find(t => t.id === target.id);
            if (!trf) return;
            setLineDrafts(trf.lines.map(line => {
                const base = line.qtyDispatched > 0 ? line.qtyDispatched : line.qtyRequested;
                const remaining = base - (line.qtyReceived + line.qtyDamaged + line.qtyShort);
                return {
                    sourceLineId: line.id,
                    itemId: line.itemId,
                    sku: line.sku,
                    description: line.description,
                    uom: line.uom,
                    expected: base,
                    alreadyReceived: line.qtyReceived,
                    alreadyDamaged: line.qtyDamaged,
                    alreadyShort: line.qtyShort,
                    remaining: Math.max(0, remaining),
                    receiveNow: Math.max(0, remaining),
                    damaged: 0,
                    short: 0,
                    notes: ''
                };
            }));
        }
    }, [shipments, transfers]);

    // ── Qty change handler ───────────────────────────────────────────
    const handleQtyChange = (lineId: string, field: 'receiveNow' | 'damaged' | 'short', value: string) => {
        const num = parseInt(value, 10);
        setLineDrafts(prev => prev.map(d => {
            if (d.sourceLineId !== lineId) return d;

            const newVal = isNaN(num) ? 0 : Math.max(0, num);
            const updated = { ...d, [field]: newVal };

            if (field === 'damaged' || field === 'short') {
                const otherField = field === 'damaged' ? 'short' : 'damaged';
                updated.receiveNow = Math.max(0, d.remaining - updated[field] - updated[otherField]);

                if (updated[field] + updated[otherField] > d.remaining) {
                    updated[field] = d.remaining - updated[otherField];
                }
            } else {
                if (updated.receiveNow + updated.damaged + updated.short > d.remaining) {
                    updated.receiveNow = d.remaining - updated.damaged - updated.short;
                }
            }

            return updated;
        }));
    };

    const handleNotesChange = (lineId: string, value: string) => {
        setLineDrafts(prev => prev.map(d =>
            d.sourceLineId === lineId ? { ...d, notes: value } : d
        ));
    };

    // ── Validation ───────────────────────────────────────────────────
    const hasAnyQuantity = lineDrafts.some(d => d.receiveNow > 0 || d.damaged > 0 || d.short > 0);

    // ── Post GRN ─────────────────────────────────────────────────────
    const handlePostGRN = async () => {
        if (!selectedTarget || !hasAnyQuantity) return;
        setIsPosting(true);

        try {
            const draftLines: ReceivingLineDraft[] = lineDrafts.map(d => ({
                sourceLineId: d.sourceLineId,
                itemId: d.itemId,
                sku: d.sku,
                description: d.description,
                uom: d.uom,
                qtyReceived: d.receiveNow,
                qtyDamaged: d.damaged,
                qtyShort: d.short,
                notes: d.notes || undefined
            }));

            let result;
            if (selectedTarget.type === 'SHIPMENT') {
                result = postShipmentGRN(selectedTarget.id, draftLines, 'Current User');
            } else {
                result = postTransferGRN(selectedTarget.id, draftLines, 'Current User');
            }

            // Re-fetch stores to reflect updates
            await Promise.all([fetchShipments(), fetchTransfers(), fetchExceptions()]);

            const excMsg = result.exceptions.length > 0
                ? ` — ${result.exceptions.length} exception(s) created`
                : '';
            setSuccessMessage(`✅ ${result.grn.grnNo} posted successfully${excMsg}`);
            setSelectedTarget(null);
            setLineDrafts([]);
        } catch (e) {
            console.error('Failed to post GRN', e);
            setSuccessMessage(`❌ Failed to post GRN`);
        } finally {
            setIsPosting(false);
        }
    };

    // ── GRN history for selected target ──────────────────────────────
    const targetGRNs = useMemo(() => {
        if (!selectedTarget) return [];
        return getGRNsForTarget(selectedTarget.type, selectedTarget.id);
    }, [selectedTarget, grns]);

    // ── Helpers ──────────────────────────────────────────────────────
    const isLate = (target: ReceivingTarget) => {
        const dateStr = target.eta || target.neededBy;
        if (!dateStr) return false;
        return isPast(new Date(dateStr));
    };

    const statusLabel = (target: ReceivingTarget) => {
        if (target.status === 'RECEIVING') return 'Receiving';
        if (target.status === 'ARRIVED') return 'Ready';
        if (target.status === 'IN_TRANSIT') return 'In Transit';
        return target.status;
    };

    const statusColor = (target: ReceivingTarget) => {
        if (target.status === 'RECEIVING') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        if (target.status === 'ARRIVED') return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
        if (target.status === 'IN_TRANSIT') return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        return 'text-muted bg-surface border-border';
    };

    // ── Render ───────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-app">
            {/* Header */}
            <div className="p-6 border-b border-border flex flex-col gap-4 flex-none bg-app z-10">
                <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <ClipboardList size={20} className="text-blue-500" /> Receiving Workspace
                    </h1>
                    <p className="text-sm text-muted mt-1">Process inbound shipments and internal transfers — generate GRNs</p>
                </div>
                {successMessage && (
                    <div className={cn(
                        "px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 border",
                        successMessage.startsWith('✅')
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                        {successMessage}
                        <button onClick={() => setSuccessMessage(null)} className="ml-auto">
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* ── Left Pane ─────────────────────────────────────── */}
                <div className="w-80 border-r border-border bg-surface/30 flex flex-col h-full flex-none">
                    {/* Search */}
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Scan or search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-background border border-border rounded-lg h-9 pl-9 pr-10 text-[13px] text-foreground focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 w-full transition-all"
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground">
                                <QrCode size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Segmented Tabs */}
                    <div className="px-4 pt-3 pb-2">
                        <div className="flex bg-background rounded-lg p-1 border border-border">
                            {(['SHIPMENTS', 'TRANSFERS'] as TargetTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setSelectedTarget(null); setLineDrafts([]); }}
                                    className={cn(
                                        "flex-1 text-[11px] font-bold uppercase tracking-wider py-2 rounded-md transition-all flex items-center justify-center gap-1.5",
                                        activeTab === tab
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-muted hover:text-foreground"
                                    )}
                                >
                                    {tab === 'SHIPMENTS' ? <Truck size={12} /> : <ArrowDownToLine size={12} />}
                                    {tab === 'SHIPMENTS' ? 'Inbound' : 'Transfers'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Entity list */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 custom-scrollbar">
                        <div className="px-2 pb-1 flex justify-between items-center">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Ready to Receive</span>
                            <span className="text-[10px] font-bold text-foreground bg-border px-1.5 py-0.5 rounded">{filteredCandidates.length}</span>
                        </div>

                        {filteredCandidates.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted flex flex-col items-center gap-2">
                                <Package size={24} className="opacity-30" />
                                <span>No pending {activeTab === 'SHIPMENTS' ? 'shipments' : 'transfers'}</span>
                            </div>
                        ) : (
                            filteredCandidates.map(target => (
                                <button
                                    key={target.id}
                                    onClick={() => handleSelectTarget(target)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden group",
                                        selectedTarget?.id === target.id
                                            ? "bg-blue-500/10 border-blue-500 shadow-sm"
                                            : "bg-card border-border hover:border-blue-500/50"
                                    )}
                                >
                                    {selectedTarget?.id === target.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                    )}
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[13px] font-bold text-foreground">{target.code}</span>
                                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border", statusColor(target))}>
                                            {statusLabel(target)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium w-full">
                                        <span className="truncate flex-1">{getLocationName(target.origin)}</span>
                                        <ArrowRight size={10} className="flex-none" />
                                        <span className="truncate flex-1 text-foreground font-semibold">{getLocationName(target.destination)}</span>
                                    </div>
                                    <div className="mt-2 text-[10px] text-muted font-bold flex items-center justify-between pt-2 border-t border-border/50">
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {target.eta ? format(new Date(target.eta), 'PP') : target.neededBy ? format(new Date(target.neededBy), 'PP') : 'N/A'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {isLate(target) && (
                                                <span className="text-rose-500 flex items-center gap-0.5">
                                                    <AlertTriangle size={10} /> Late
                                                </span>
                                            )}
                                            <span className="text-muted">{target.lineCount} items</span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Main Panel ────────────────────────────────────── */}
                <div className="flex-1 bg-app overflow-y-auto">
                    {!selectedTarget ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted">
                            <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                                <QrCode size={24} />
                            </div>
                            <p className="text-sm font-medium">Select a {activeTab === 'SHIPMENTS' ? 'shipment' : 'transfer'} to begin processing</p>
                            <p className="text-xs text-muted/60 mt-1">Or scan a barcode to auto-select</p>
                        </div>
                    ) : (
                        <div className="flex h-full">
                            {/* Main content */}
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                                    {/* Processing Header */}
                                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg border flex items-center justify-center",
                                                    selectedTarget.type === 'SHIPMENT'
                                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                                                        : "bg-violet-500/10 border-violet-500/20 text-violet-500"
                                                )}>
                                                    {selectedTarget.type === 'SHIPMENT' ? <Truck size={20} /> : <ArrowDownToLine size={20} />}
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-bold text-foreground">{selectedTarget.code}</h2>
                                                    <p className="text-sm text-muted flex items-center gap-1">
                                                        {getLocationName(selectedTarget.origin)}
                                                        <ArrowRight size={12} />
                                                        <span className="text-foreground font-medium">{getLocationName(selectedTarget.destination)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={cn("text-xs font-bold px-2.5 py-1 rounded-md border", statusColor(selectedTarget))}>
                                                {statusLabel(selectedTarget)}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">
                                                    {selectedTarget.type === 'SHIPMENT' ? 'ETA' : 'Needed By'}
                                                </p>
                                                <p className="text-[13px] font-medium text-foreground">
                                                    {(selectedTarget.eta || selectedTarget.neededBy) ? format(new Date(selectedTarget.eta || selectedTarget.neededBy!), 'PP') : 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Carrier</p>
                                                <p className="text-[13px] font-medium text-foreground">{selectedTarget.partyName || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Lines</p>
                                                <p className="text-[13px] font-medium text-foreground">{selectedTarget.lineCount} items</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lines Table */}
                                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-border bg-surface/50 flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-foreground">Record Quantities</h3>
                                            <button
                                                onClick={() => handleSelectTarget(selectedTarget)}
                                                className="text-xs text-muted hover:text-foreground flex items-center gap-1 transition-colors"
                                            >
                                                <RotateCcw size={12} /> Reset
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-border bg-background">
                                                        <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest min-w-[180px]">Item</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right w-[80px]">Expected</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right w-[80px]">Prev Rcvd</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-blue-500 uppercase tracking-widest text-right w-[80px]">Remaining</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest text-center w-[100px]">Receive</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center w-[90px]">Damaged</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center w-[90px]">Short</th>
                                                        <th className="px-3 py-3 text-[10px] font-bold text-muted uppercase tracking-widest min-w-[140px]">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {lineDrafts.map(draft => (
                                                        <tr key={draft.sourceLineId} className="border-b border-border last:border-0 hover:bg-surface/30">
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[13px] font-bold text-foreground">{draft.description || draft.sku}</span>
                                                                    <span className="text-[11px] text-muted">
                                                                        {draft.sku} · {draft.uom}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <span className="text-[13px] font-medium text-foreground">{draft.expected}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <span className={cn("text-[13px] font-medium", draft.alreadyReceived > 0 ? "text-emerald-500" : "text-muted")}>
                                                                    {draft.alreadyReceived}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <span className={cn(
                                                                    "text-[13px] font-bold",
                                                                    draft.remaining > 0 ? "text-blue-500" : "text-emerald-500"
                                                                )}>
                                                                    {draft.remaining}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={draft.remaining}
                                                                    value={draft.receiveNow}
                                                                    onChange={e => handleQtyChange(draft.sourceLineId, 'receiveNow', e.target.value)}
                                                                    disabled={draft.remaining === 0}
                                                                    className="w-full bg-surface border border-border rounded h-8 px-2 text-[13px] text-foreground text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all disabled:opacity-40"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={draft.damaged}
                                                                    onChange={e => handleQtyChange(draft.sourceLineId, 'damaged', e.target.value)}
                                                                    disabled={draft.remaining === 0}
                                                                    className="w-full bg-surface border border-border rounded h-8 px-2 text-[13px] text-foreground text-center focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all disabled:opacity-40"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={draft.short}
                                                                    onChange={e => handleQtyChange(draft.sourceLineId, 'short', e.target.value)}
                                                                    disabled={draft.remaining === 0}
                                                                    className="w-full bg-surface border border-border rounded h-8 px-2 text-[13px] text-foreground text-center focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all disabled:opacity-40"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Note..."
                                                                    value={draft.notes}
                                                                    onChange={e => handleNotesChange(draft.sourceLineId, e.target.value)}
                                                                    className="w-full bg-surface border border-border rounded h-8 px-2 text-[13px] text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Action Bar */}
                                        <div className="p-4 bg-surface/30 border-t border-border flex items-center justify-between sticky bottom-0">
                                            <div className="flex items-center gap-2 text-[11px] font-medium">
                                                {lineDrafts.some(d => d.damaged > 0 || d.short > 0) && (
                                                    <span className="text-amber-500 flex items-center gap-1">
                                                        <AlertTriangle size={14} /> Discrepancies will create exception records
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => { setSelectedTarget(null); setLineDrafts([]); }}
                                                    className="px-4 h-9 rounded-lg text-[13px] font-medium text-muted hover:text-foreground border border-border hover:bg-surface transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handlePostGRN}
                                                    disabled={isPosting || !hasAnyQuantity}
                                                    className={cn(
                                                        "px-6 h-9 rounded-lg font-bold text-[13px] transition-all shadow-lg active:scale-95 flex items-center gap-2",
                                                        hasAnyQuantity
                                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                                                            : "bg-surface text-muted cursor-not-allowed shadow-none"
                                                    )}
                                                >
                                                    {isPosting ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                                                    Post GRN
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-10" />
                                </div>
                            </div>

                            {/* ── Right Rail ───────────────────────────── */}
                            <div className="w-72 border-l border-border bg-surface/20 flex flex-col h-full flex-none overflow-y-auto custom-scrollbar">
                                {/* GRN History */}
                                <div className="p-4 border-b border-border">
                                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <FileText size={12} /> GRN History
                                    </h4>
                                    {targetGRNs.length === 0 ? (
                                        <p className="text-xs text-muted/60 italic">No GRNs posted yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {targetGRNs.map(grn => (
                                                <div key={grn.id} className="bg-card border border-border rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[12px] font-bold text-foreground">{grn.grnNo}</span>
                                                        <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                                                            <CheckCircle2 size={10} /> Posted
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-muted">{format(new Date(grn.date), 'PPp')}</p>
                                                    <p className="text-[10px] text-muted mt-0.5">{grn.lines.length} line(s) · by {grn.receivedBy}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Audit Preview */}
                                <div className="p-4 flex-1">
                                    <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <Clock size={12} /> Audit Trail
                                    </h4>
                                    <AuditPreview targetType={selectedTarget.type} targetId={selectedTarget.id} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Audit Preview sub-component ──────────────────────────────────────
const AuditPreview: React.FC<{ targetType: 'SHIPMENT' | 'TRANSFER'; targetId: string }> = ({ targetType, targetId }) => {
    const { shipments, transfers } = useLogisticsStore();

    const events = useMemo(() => {
        if (targetType === 'SHIPMENT') {
            const shp = shipments.find(s => s.id === targetId);
            return shp?.auditLog || [];
        } else {
            const trf = transfers.find(t => t.id === targetId);
            return trf?.auditLog || [];
        }
    }, [targetType, targetId, shipments, transfers]);

    const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (sorted.length === 0) return <p className="text-xs text-muted/60 italic">No audit events</p>;

    return (
        <div className="space-y-3">
            {sorted.slice(0, 10).map(evt => (
                <div key={evt.id} className="relative pl-4 border-l-2 border-border">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500" />
                    <p className="text-[11px] font-medium text-foreground leading-tight">{evt.message}</p>
                    <p className="text-[10px] text-muted mt-0.5">{format(new Date(evt.timestamp), 'PP p')} · {evt.actor}</p>
                </div>
            ))}
        </div>
    );
};

export default ReceivingWorkspace;


