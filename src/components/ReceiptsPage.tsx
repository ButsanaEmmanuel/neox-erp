import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Info, Plus, Search, Upload, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { attachReceiptProof } from '../services/finance/proofApi';
import { ReceiptCollectionRecord, ReceivableRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import ComboboxSelect from './ui/ComboboxSelect';

const RECEIPT_STATUS_OPTIONS = ['all', 'pending', 'completed', 'failed', 'cancelled'];
const RECEIPT_METHOD_OPTIONS = ['all', 'bank_transfer', 'mobile_money', 'cash', 'check'];

interface ReceiptsResponse {
    receipts: ReceiptCollectionRecord[];
}

interface CreateReceiptResponse {
    receipt: ReceiptCollectionRecord;
    receivable: ReceivableRecord;
}

interface ReceivableDetailResponse {
    receivable: ReceivableRecord | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);

interface ReceiptsPageProps {
    // Drill-through from reconciliation: auto-open this receipt's drawer.
    focusReceiptId?: string;
    onBack?: () => void;
}

const ReceiptsPage: React.FC<ReceiptsPageProps> = ({ focusReceiptId, onBack }) => {
    const { receiptCollections: contextReceipts, receivables } = useFinance();
    const { user } = useAuth();

    // Append the actor on calls this page makes directly so they don't 403.
    const withActor = (path: string) => {
        if (!user?.id) return path;
        const sep = path.includes('?') ? '&' : '?';
        return `${path}${sep}userId=${encodeURIComponent(user.id)}`;
    };

    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [proofError, setProofError] = useState<string | null>(null);

    const [receipts, setReceipts] = useState<ReceiptCollectionRecord[]>(contextReceipts);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [methodFilter, setMethodFilter] = useState<string>('all');
    const [clientFilter, setClientFilter] = useState('');
    const [dateFromFilter, setDateFromFilter] = useState('');
    const [dateToFilter, setDateToFilter] = useState('');

    const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
    const [selectedParentReceivable, setSelectedParentReceivable] = useState<ReceivableRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createReceivableId, setCreateReceivableId] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createMethod, setCreateMethod] = useState('bank_transfer');
    const [createReceiptDate, setCreateReceiptDate] = useState(isoToday);
    const [createReceiptReference, setCreateReceiptReference] = useState('');
    const [createProofReference, setCreateProofReference] = useState('');
    const [createCurrency, setCreateCurrency] = useState('USD');
    const [createNotes, setCreateNotes] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        setReceipts(contextReceipts);
    }, [contextReceipts]);

    // Default amount to outstanding when picking a receivable.
    useEffect(() => {
        if (!createReceivableId) return;
        const receivable = receivables.find((r) => r.id === createReceivableId);
        if (!receivable) return;
        const outstanding = Number(receivable.outstandingAmount || 0);
        if (!createAmount && outstanding > 0) setCreateAmount(String(outstanding));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createReceivableId]);

    const selectedCreateReceivable = useMemo(
        () => receivables.find((r) => r.id === createReceivableId) || null,
        [receivables, createReceivableId],
    );

    // Receivable selector limited to those still owing — collecting from a
    // fully-paid receivable would be rejected by the backend anyway.
    const receivableOptions = useMemo(() => {
        return receivables
            .filter((r) => Number(r.outstandingAmount || 0) > 0)
            .slice()
            .sort((a, b) => (a.referenceCode || '').localeCompare(b.referenceCode || ''))
            .map((r) => ({
                id: r.id,
                label: r.referenceCode,
                subLabel: `${r.clientName || 'Unknown client'} — outstanding ${formatCurrency(Number(r.outstandingAmount || 0))}`,
            }));
    }, [receivables]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || methodFilter !== 'all' || clientFilter || dateFromFilter || dateToFilter);

    const filteredRows = useMemo(() => {
        const sq = searchQuery.toLowerCase();
        const cq = clientFilter.toLowerCase();
        return receipts.filter((receipt) => {
            if (sq) {
                const hay = `${receipt.receiptReference} ${receipt.receivable?.clientName || ''} ${receipt.receivable?.referenceCode || ''}`.toLowerCase();
                if (!hay.includes(sq)) return false;
            }
            if (statusFilter !== 'all' && receipt.status !== statusFilter) return false;
            if (methodFilter !== 'all' && receipt.method !== methodFilter) return false;
            if (cq && !(receipt.receivable?.clientName || '').toLowerCase().includes(cq)) return false;
            if (dateFromFilter && receipt.receiptDate && receipt.receiptDate.slice(0, 10) < dateFromFilter) return false;
            if (dateToFilter && receipt.receiptDate && receipt.receiptDate.slice(0, 10) > dateToFilter) return false;
            return true;
        });
    }, [receipts, searchQuery, statusFilter, methodFilter, clientFilter, dateFromFilter, dateToFilter]);

    const stats = useMemo(() => ({
        count: filteredRows.length,
        totalCollected: filteredRows
            .filter((r) => r.status === 'completed')
            .reduce((s, r) => s + Number(r.amount || 0), 0),
        pendingCount: filteredRows.filter((r) => r.status === 'pending').length,
    }), [filteredRows]);

    const refreshReceipts = async () => {
        const data = await apiRequest<ReceiptsResponse>(withActor('/api/v1/finance/receipts?take=200'));
        setReceipts(data.receipts || []);
    };

    const selectedReceipt = useMemo(() => receipts.find((r) => r.id === selectedReceiptId) || null, [receipts, selectedReceiptId]);

    const openReceiptDetail = async (receipt: ReceiptCollectionRecord) => {
        setSelectedReceiptId(receipt.id);
        setSelectedParentReceivable(null);
        setDetailError(null);
        setProofFile(null);
        setProofError(null);
        if (!receipt.receivableId) return;
        setLoadingDetail(true);
        try {
            const data = await apiRequest<ReceivableDetailResponse>(withActor(`/api/v1/finance/receivables/${receipt.receivableId}`));
            setSelectedParentReceivable(data.receivable || null);
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : 'Unable to load parent receivable.');
        } finally {
            setLoadingDetail(false);
        }
    };

    // Drill-through from reconciliation: make sure the list holds the target,
    // then auto-open its drawer.
    useEffect(() => {
        if (!focusReceiptId) return;
        void refreshReceipts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusReceiptId]);

    // Auto-open the focused receipt ONCE — afterwards the user can navigate freely.
    const autoOpenedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!focusReceiptId || autoOpenedRef.current === focusReceiptId) return;
        const target = receipts.find((r) => r.id === focusReceiptId);
        if (target) {
            autoOpenedRef.current = focusReceiptId;
            void openReceiptDetail(target);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusReceiptId, receipts]);

    const attachProof = async () => {
        if (!selectedReceipt || !proofFile) return;
        setUploadingProof(true);
        setProofError(null);
        try {
            await attachReceiptProof(selectedReceipt.id, proofFile);
            setProofFile(null);
            await refreshReceipts();
        } catch (err) {
            setProofError(err instanceof Error ? err.message : 'Unable to attach proof.');
        } finally {
            setUploadingProof(false);
        }
    };

    const closeReceiptDetail = () => {
        setSelectedReceiptId(null);
        setSelectedParentReceivable(null);
        setDetailError(null);
    };

    const openCreateModal = () => {
        setCreateReceivableId('');
        setCreateAmount('');
        setCreateMethod('bank_transfer');
        setCreateReceiptDate(isoToday());
        setCreateReceiptReference('');
        setCreateProofReference('');
        setCreateCurrency('USD');
        setCreateNotes('');
        setCreateError(null);
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateError(null);
    };

    const submitCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createReceivableId) {
            setCreateError('Select a receivable to collect against.');
            return;
        }
        const amount = Number(createAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            setCreateError('Amount must be greater than zero.');
            return;
        }
        const outstanding = Number(selectedCreateReceivable?.outstandingAmount || 0);
        if (outstanding > 0 && amount > outstanding) {
            setCreateError(`Amount exceeds outstanding (${formatCurrency(outstanding)}).`);
            return;
        }
        if (!createProofReference.trim()) {
            setCreateError('Proof reference is required (bank ref, transfer confirmation, etc.).');
            return;
        }

        setCreateSubmitting(true);
        setCreateError(null);
        try {
            await apiRequest<CreateReceiptResponse>(withActor('/api/v1/finance/receipts'), {
                method: 'POST',
                body: {
                    receivableId: createReceivableId,
                    amount,
                    method: createMethod,
                    receiptDate: createReceiptDate,
                    receiptReference: createReceiptReference.trim() || undefined,
                    proofReference: createProofReference.trim(),
                    currencyCode: createCurrency || 'USD',
                    notes: createNotes.trim() || null,
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
            await refreshReceipts();
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Unable to record receipt.');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setMethodFilter('all');
        setClientFilter('');
        setDateFromFilter('');
        setDateToFilter('');
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="self-start h-8 px-3 rounded-md border border-border text-xs text-secondary hover:text-primary flex items-center gap-1.5"
                    >
                        <ArrowLeft size={13} /> Retour à la réconciliation
                    </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Receipts (filtered)" value={String(stats.count)} />
                    <StatCard label="Collected (completed)" value={formatCurrency(stats.totalCollected)} accent="emerald" />
                    <StatCard label="Pending" value={String(stats.pendingCount)} accent="amber" />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-primary">Receipt Collections</h3>
                                <p className="text-xs text-secondary mt-1">Incoming receipts settling customer receivables. Proof of receipt is required by the backend on every record.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasActiveFilters && (
                                    <button type="button" onClick={resetFilters} className="text-xs text-secondary hover:text-primary px-3 h-9 border border-border rounded-lg">
                                        Clear filters
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={openCreateModal}
                                    className="h-9 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs font-semibold flex items-center gap-2"
                                >
                                    <Plus size={14} /> Record Receipt
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                            <div className="relative md:col-span-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search reference or client..."
                                    className="bg-surface border border-border rounded-lg h-9 pl-9 pr-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-full placeholder:text-muted"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {RECEIPT_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
                                ))}
                            </select>
                            <select
                                value={methodFilter}
                                onChange={(e) => setMethodFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {RECEIPT_METHOD_OPTIONS.map((m) => (
                                    <option key={m} value={m}>{m === 'all' ? 'All methods' : m.replace('_', ' ')}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={dateFromFilter}
                                onChange={(e) => setDateFromFilter(e.target.value)}
                                title="Receipt date from"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                            <input
                                type="date"
                                value={dateToFilter}
                                onChange={(e) => setDateToFilter(e.target.value)}
                                title="Receipt date to"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                        </div>

                        <input
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            placeholder="Client contains..."
                            className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 placeholder:text-muted w-full md:w-72"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-surface/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Receivable</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Amount</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Method</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredRows.map((receipt) => (
                                    <tr
                                        key={receipt.id}
                                        onClick={() => void openReceiptDetail(receipt)}
                                        className="hover:bg-surface transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{receipt.receiptReference}</td>
                                        <td className="px-6 py-4 text-sm text-secondary">{receipt.receivable?.clientName || '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{receipt.receivable?.referenceCode || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-400 tabular-nums">{formatCurrency(Number(receipt.amount || 0))}</td>
                                        <td className="px-6 py-4 text-xs text-secondary lowercase">{(receipt.method || '').replace('_', ' ')}</td>
                                        <td className="px-6 py-4"><StatusPill status={receipt.status} /></td>
                                        <td className="px-6 py-4 text-xs text-secondary">{receipt.receiptDate ? formatDate(receipt.receiptDate, 'short') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRows.length === 0 && (
                        <div className="p-12 text-center text-muted text-sm">
                            {receipts.length === 0 ? 'No receipts recorded yet — record the first from a receivable.' : 'No receipts match the current filters.'}
                        </div>
                    )}
                </div>
            </div>

            {selectedReceiptId && selectedReceipt && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 flex justify-end"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeReceiptDetail(); }}
                >
                    <div
                        className="w-full max-w-2xl h-full bg-[#0f172a] border-l border-border/80 flex flex-col"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-secondary">Receipt Collection</p>
                                <h3 className="text-lg font-semibold text-primary">{selectedReceipt.receiptReference}</h3>
                            </div>
                            <button type="button" onClick={closeReceiptDetail} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            <div className="flex items-center justify-between">
                                <StatusPill status={selectedReceipt.status} />
                                <p className="text-xs text-muted">
                                    Updated {selectedReceipt.updatedAt ? formatDate(selectedReceipt.updatedAt, 'short') : '-'}
                                </p>
                            </div>

                            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-primary">Receipt</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <Field label="Amount" value={`${formatCurrency(Number(selectedReceipt.amount || 0))} ${selectedReceipt.currencyCode || ''}`} />
                                    <Field label="Method" value={(selectedReceipt.method || '-').replace('_', ' ')} />
                                    <Field label="Receipt date" value={selectedReceipt.receiptDate ? formatDate(selectedReceipt.receiptDate, 'short') : '-'} />
                                    <Field label="Currency" value={selectedReceipt.currencyCode || '-'} />
                                    <Field label="Proof document" value={selectedReceipt.proofDocumentId || '-'} />
                                    <Field label="Received by" value={selectedReceipt.receivedByName || '-'} />
                                </div>
                                {selectedReceipt.notes && (
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Notes</p>
                                        <p className="text-sm text-primary whitespace-pre-wrap">{selectedReceipt.notes}</p>
                                    </div>
                                )}
                                <div className="text-[11px] text-muted">
                                    Recorded {selectedReceipt.createdAt ? formatDate(selectedReceipt.createdAt, 'short') : '-'}
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-primary">Proof of receipt</h4>
                                {selectedReceipt.proofDocumentId ? (
                                    <div className="flex items-center gap-2 text-sm text-emerald-300">
                                        <CheckCircle2 size={16} />
                                        <span>Proof attached</span>
                                        <code className="text-[11px] text-muted bg-slate-900/60 rounded px-1.5 py-0.5">{selectedReceipt.proofDocumentId}</code>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs text-amber-300">No proof attached — this is what reconciliation flags as MISSING_PROOF.</p>
                                        {proofError && (
                                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">{proofError}</div>
                                        )}
                                        <input
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx"
                                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                            className="w-full bg-slate-900/70 border border-border/80 rounded-lg px-3 py-2 text-xs text-primary file:mr-2 file:rounded file:border-0 file:bg-blue-500/20 file:px-2 file:py-1 file:text-blue-200"
                                        />
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] text-muted truncate">
                                                {proofFile ? `Selected: ${proofFile.name}` : 'PDF / image / Office doc, max 15 MB'}
                                            </p>
                                            <button
                                                type="button"
                                                disabled={uploadingProof || !proofFile}
                                                onClick={() => void attachProof()}
                                                className="h-9 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-60 text-xs font-semibold flex items-center gap-1.5"
                                            >
                                                <Upload size={13} /> {uploadingProof ? 'Attaching...' : 'Attach proof'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </section>

                            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Parent Receivable</h4>
                                    {loadingDetail && <span className="text-xs text-secondary">Loading...</span>}
                                </div>
                                {detailError && <p className="text-xs text-rose-400">{detailError}</p>}

                                {!loadingDetail && selectedParentReceivable && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <Field label="Reference" value={selectedParentReceivable.referenceCode || '-'} />
                                            <Field label="Client" value={selectedParentReceivable.clientName || '-'} />
                                            <Field label="Total" value={formatCurrency(Number(selectedParentReceivable.totalAmount || 0))} />
                                            <Field label="Outstanding" value={formatCurrency(Number(selectedParentReceivable.outstandingAmount || 0))} />
                                            <Field label="Collected" value={formatCurrency(Number(selectedParentReceivable.collectedAmount || 0))} />
                                            <Field label="Due date" value={selectedParentReceivable.dueDate ? formatDate(selectedParentReceivable.dueDate, 'short') : '-'} />
                                            <Field label="Status" value={selectedParentReceivable.status || '-'} />
                                            <Field label="Collection" value={selectedParentReceivable.collectionStatus || '-'} />
                                        </div>

                                        {selectedParentReceivable.isOverdue && (
                                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">
                                                ⚠ This receivable is currently overdue.
                                            </div>
                                        )}

                                        {(selectedParentReceivable.financeEntry?.activities || []).length > 0 && (
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Recent activity</p>
                                                <div className="space-y-2">
                                                    {(selectedParentReceivable.financeEntry?.activities || []).slice(0, 5).map((activity) => (
                                                        <div key={activity.id} className="rounded-lg border border-border bg-slate-900/40 px-3 py-2">
                                                            <div className="flex items-center justify-between text-[11px] text-muted">
                                                                <span>{activity.actorDisplayName || 'System'} - {activity.eventSource}</span>
                                                                <span>{new Date(activity.createdAt).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-xs text-primary mt-1">{activity.message}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {!loadingDetail && !selectedParentReceivable && !detailError && (
                                    <p className="text-xs text-muted">No parent receivable data available.</p>
                                )}
                            </section>

                            <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex gap-3">
                                <Info size={16} className="text-blue-300 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-blue-100 space-y-2">
                                    <p>
                                        This receipt is immutable. Adjustments and additional evidence live on the parent receivable.
                                    </p>
                                    <p className="text-blue-300 flex items-center gap-1.5">
                                        <ExternalLink size={12} /> Open the <strong>Receivables</strong> page and search for{' '}
                                        <code className="bg-blue-500/20 rounded px-1.5 py-0.5">{selectedParentReceivable?.referenceCode || selectedReceipt.receivableId}</code>.
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
                >
                    <form
                        onSubmit={submitCreate}
                        className="w-full max-w-2xl bg-[#0f172a] border border-border/80 rounded-xl flex flex-col max-h-[90vh]"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-secondary">New Receipt</p>
                                <h3 className="text-lg font-semibold text-primary">Record Receipt</h3>
                            </div>
                            <button type="button" onClick={closeCreateModal} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {createError && (
                                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">{createError}</div>
                            )}

                            <ComboboxSelect
                                label="Parent Receivable (with outstanding balance)"
                                required
                                options={receivableOptions}
                                value={createReceivableId}
                                onChange={setCreateReceivableId}
                                placeholder="Search receivable by reference or client..."
                                emptyMessage="No receivables with outstanding balance."
                            />

                            {selectedCreateReceivable && (
                                <div className="rounded-lg border border-border bg-slate-900/40 px-3 py-2 text-xs text-secondary flex items-center justify-between">
                                    <span>Outstanding on {selectedCreateReceivable.referenceCode}</span>
                                    <span className="font-semibold text-amber-300 tabular-nums">
                                        {formatCurrency(Number(selectedCreateReceivable.outstandingAmount || 0))}
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField label="Amount" required>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        value={createAmount}
                                        onChange={(e) => setCreateAmount(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Method" required>
                                    <select
                                        value={createMethod}
                                        onChange={(e) => setCreateMethod(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    >
                                        {RECEIPT_METHOD_OPTIONS.filter((m) => m !== 'all').map((m) => (
                                            <option key={m} value={m}>{m.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Receipt date" required>
                                    <input
                                        type="date"
                                        required
                                        value={createReceiptDate}
                                        onChange={(e) => setCreateReceiptDate(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Currency">
                                    <input
                                        value={createCurrency}
                                        onChange={(e) => setCreateCurrency(e.target.value.toUpperCase().slice(0, 3))}
                                        maxLength={3}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full uppercase"
                                    />
                                </FormField>
                                <FormField label="Receipt reference">
                                    <input
                                        value={createReceiptReference}
                                        onChange={(e) => setCreateReceiptReference(e.target.value)}
                                        placeholder="Auto-generated if blank"
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Proof reference" required>
                                    <input
                                        required
                                        value={createProofReference}
                                        onChange={(e) => setCreateProofReference(e.target.value)}
                                        placeholder="Bank ref / wire confirmation"
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                            </div>

                            <p className="text-[11px] text-muted">
                                Proof reference is required by the backend for every receipt. A synthetic evidence document is generated from it and attached to the parent finance entry.
                            </p>

                            <FormField label="Notes">
                                <textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    placeholder="Optional context for the receipt"
                                    className="min-h-[72px] bg-slate-900/70 border border-border/80 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
                                />
                            </FormField>
                        </div>

                        <div className="px-6 py-4 border-t border-border/80 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeCreateModal}
                                className="h-9 px-4 rounded-lg border border-border text-secondary hover:text-primary text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createSubmitting || !createReceivableId}
                                className="h-9 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-60 text-xs font-semibold"
                            >
                                {createSubmitting ? 'Recording...' : 'Record Receipt'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
        <p className="text-sm text-primary mt-1">{value}</p>
    </div>
);

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="w-full">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {label} {required && <span className="text-red-400">*</span>}
        </label>
        {children}
    </div>
);

const StatCard: React.FC<{ label: string; value: string; accent?: 'emerald' | 'amber' }> = ({ label, value, accent }) => (
    <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        {accent && (
            <div
                className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
        )}
        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
    </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const tone = status === 'completed' ? 'success'
        : status === 'failed' || status === 'cancelled' ? 'danger'
            : 'warning';
    const styles = tone === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : tone === 'danger' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
            {status}
        </span>
    );
};

export default ReceiptsPage;
