import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FileText, LayoutGrid, List, Receipt, Search, Wallet, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { CustomerInvoiceRecord, ReceiptCollectionRecord, ReceivableRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';

const RECEIVABLE_STATUS_OPTIONS = ['all', 'open', 'partial', 'paid', 'cancelled'];

// Aging buckets — standard accounting:
//   current: dueDate not yet reached (or no dueDate)
//   1-30:    0  < daysOverdue <= 30
//   31-60:   31 <= daysOverdue <= 60
//   61-90:   61 <= daysOverdue <= 90
//   90+:     daysOverdue > 90
type AgedBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';
const AGED_BUCKET_OPTIONS: Array<'all' | AgedBucket> = ['all', 'current', '1-30', '31-60', '61-90', '90+'];
const AGED_BUCKET_ORDER: AgedBucket[] = ['current', '1-30', '31-60', '61-90', '90+'];
const AGED_BUCKET_LABELS: Record<AgedBucket, string> = {
    'current': 'Current',
    '1-30': '1-30 days',
    '31-60': '31-60 days',
    '61-90': '61-90 days',
    '90+': '90+ days',
};

interface ReceivableDetailResponse {
    receivable: ReceivableRecord | null;
}

function daysBetween(a: Date, b: Date): number {
    const MS = 24 * 60 * 60 * 1000;
    return Math.floor((a.getTime() - b.getTime()) / MS);
}

/**
 * Classify a receivable into an aging bucket based on its due date vs today.
 * Only receivables with outstandingAmount > 0 are aged; fully-paid ones
 * return null (excluded from the aging report).
 */
function getAgedBucket(receivable: ReceivableRecord, today: Date): AgedBucket | null {
    const outstanding = Number(receivable.outstandingAmount || 0);
    if (outstanding <= 0) return null;
    if (!receivable.dueDate) return 'current';

    const due = new Date(receivable.dueDate);
    if (Number.isNaN(due.getTime())) return 'current';
    const daysOverdue = daysBetween(today, due);

    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return '1-30';
    if (daysOverdue <= 60) return '31-60';
    if (daysOverdue <= 90) return '61-90';
    return '90+';
}

const ReceivablesPage: React.FC = () => {
    const { receivables: contextReceivables, customerInvoices, receiptCollections } = useFinance();
    const { user } = useAuth();

    // Finance routes run assertPermission against ?userId=. Append the actor so
    // the detail fetch doesn't 403 ("Permission denied") even for admins.
    const withActor = (path: string) => {
        if (!user?.id) return path;
        const sep = path.includes('?') ? '&' : '?';
        return `${path}${sep}userId=${encodeURIComponent(user.id)}`;
    };

    const [receivables, setReceivables] = useState<ReceivableRecord[]>(contextReceivables);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [clientFilter, setClientFilter] = useState('');
    const [agedBucketFilter, setAgedBucketFilter] = useState<'all' | AgedBucket>('all');
    const [dueFromFilter, setDueFromFilter] = useState('');
    const [dueToFilter, setDueToFilter] = useState('');

    const [viewMode, setViewMode] = useState<'list' | 'aging'>('list');

    const [selectedReceivableId, setSelectedReceivableId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<ReceivableRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    useEffect(() => {
        setReceivables(contextReceivables);
    }, [contextReceivables]);

    // "Today" memoized once per render cycle — re-recomputed when receivables
    // change so a freshly-poll'd list reflects fresh aging.
    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, [receivables]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || clientFilter || agedBucketFilter !== 'all' || dueFromFilter || dueToFilter);

    const filteredRows = useMemo(() => {
        const sq = searchQuery.toLowerCase();
        const cq = clientFilter.toLowerCase();
        return receivables.filter((receivable) => {
            if (sq) {
                const hay = `${receivable.referenceCode} ${receivable.clientName || ''} ${receivable.financeEntry?.title || ''}`.toLowerCase();
                if (!hay.includes(sq)) return false;
            }
            if (statusFilter !== 'all' && receivable.status !== statusFilter) return false;
            if (cq && !(receivable.clientName || '').toLowerCase().includes(cq)) return false;
            if (agedBucketFilter !== 'all') {
                const bucket = getAgedBucket(receivable, today);
                if (bucket !== agedBucketFilter) return false;
            }
            if (dueFromFilter && receivable.dueDate && receivable.dueDate.slice(0, 10) < dueFromFilter) return false;
            if (dueToFilter && receivable.dueDate && receivable.dueDate.slice(0, 10) > dueToFilter) return false;
            return true;
        });
    }, [receivables, searchQuery, statusFilter, clientFilter, agedBucketFilter, dueFromFilter, dueToFilter, today]);

    const stats = useMemo(() => ({
        totalReceivable: filteredRows.reduce((s, r) => s + Number(r.totalAmount || 0), 0),
        totalOutstanding: filteredRows.reduce((s, r) => s + Number(r.outstandingAmount || 0), 0),
        overdueCount: filteredRows.filter((r) => {
            const bucket = getAgedBucket(r, today);
            return bucket && bucket !== 'current';
        }).length,
    }), [filteredRows, today]);

    // Aging pivot — group filtered rows by clientName, sum outstanding per bucket.
    const agingPivot = useMemo(() => {
        const byClient = new Map<string, Record<AgedBucket, number> & { total: number }>();
        for (const receivable of filteredRows) {
            const bucket = getAgedBucket(receivable, today);
            if (!bucket) continue;
            const client = receivable.clientName || '(unnamed)';
            const outstanding = Number(receivable.outstandingAmount || 0);
            if (!byClient.has(client)) {
                byClient.set(client, { 'current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 });
            }
            const row = byClient.get(client)!;
            row[bucket] += outstanding;
            row.total += outstanding;
        }
        const rows = Array.from(byClient.entries())
            .map(([client, sums]) => ({ client, ...sums }))
            .sort((a, b) => b.total - a.total);
        const totals: Record<AgedBucket, number> & { total: number } = { 'current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 };
        for (const r of rows) {
            for (const b of AGED_BUCKET_ORDER) totals[b] += r[b];
            totals.total += r.total;
        }
        return { rows, totals };
    }, [filteredRows, today]);

    // Invoices and receipts linked to the currently-open receivable —
    // sourced from FinanceContext (no extra fetch needed).
    const linkedInvoices = useMemo<CustomerInvoiceRecord[]>(() => {
        if (!selectedReceivableId) return [];
        return customerInvoices.filter((inv) => inv.receivableId === selectedReceivableId);
    }, [customerInvoices, selectedReceivableId]);

    const linkedReceipts = useMemo<ReceiptCollectionRecord[]>(() => {
        if (!selectedReceivableId) return [];
        return receiptCollections.filter((rec) => rec.receivableId === selectedReceivableId);
    }, [receiptCollections, selectedReceivableId]);

    const openReceivableDetail = async (receivable: ReceivableRecord) => {
        setSelectedReceivableId(receivable.id);
        setSelectedDetail(null);
        setDetailError(null);
        setLoadingDetail(true);
        try {
            const data = await apiRequest<ReceivableDetailResponse>(withActor(`/api/v1/finance/receivables/${receivable.id}`));
            setSelectedDetail(data.receivable || null);
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : 'Unable to load receivable detail.');
        } finally {
            setLoadingDetail(false);
        }
    };

    const closeReceivableDetail = () => {
        setSelectedReceivableId(null);
        setSelectedDetail(null);
        setDetailError(null);
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setClientFilter('');
        setAgedBucketFilter('all');
        setDueFromFilter('');
        setDueToFilter('');
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Receivables" value={formatCurrency(stats.totalReceivable)} accent="emerald" />
                    <StatCard label="Outstanding" value={formatCurrency(stats.totalOutstanding)} accent="blue" />
                    <StatCard label="Overdue Items" value={String(stats.overdueCount)} accent="rose" />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-primary">Receivables Control</h3>
                                <p className="text-xs text-secondary mt-1">
                                    Expected inflows. Receivables are derived from invoices — they can&apos;t be created here.
                                    Switch to <strong>Aging</strong> view for a cash-collection pivot per client.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasActiveFilters && (
                                    <button type="button" onClick={resetFilters} className="text-xs text-secondary hover:text-primary px-3 h-9 border border-border rounded-lg">
                                        Clear filters
                                    </button>
                                )}
                                <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={`h-9 px-3 text-xs font-semibold flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-300' : 'text-secondary hover:text-primary'}`}
                                    >
                                        <List size={13} /> List
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('aging')}
                                        className={`h-9 px-3 text-xs font-semibold flex items-center gap-1.5 border-l border-border ${viewMode === 'aging' ? 'bg-blue-500/20 text-blue-300' : 'text-secondary hover:text-primary'}`}
                                    >
                                        <LayoutGrid size={13} /> Aging
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                            <div className="relative md:col-span-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search reference, client, or entry title..."
                                    className="bg-surface border border-border rounded-lg h-9 pl-9 pr-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-full placeholder:text-muted"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {RECEIVABLE_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
                                ))}
                            </select>
                            <select
                                value={agedBucketFilter}
                                onChange={(e) => setAgedBucketFilter(e.target.value as 'all' | AgedBucket)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                                title="Aging bucket"
                            >
                                {AGED_BUCKET_OPTIONS.map((b) => (
                                    <option key={b} value={b}>{b === 'all' ? 'All buckets' : AGED_BUCKET_LABELS[b]}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={dueFromFilter}
                                onChange={(e) => setDueFromFilter(e.target.value)}
                                title="Due date from"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                            <input
                                type="date"
                                value={dueToFilter}
                                onChange={(e) => setDueToFilter(e.target.value)}
                                title="Due date to"
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

                    {viewMode === 'list' && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-border bg-surface/50">
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Outstanding</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Aging</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {filteredRows.map((receivable) => {
                                            const bucket = getAgedBucket(receivable, today);
                                            return (
                                                <tr
                                                    key={receivable.id}
                                                    onClick={() => void openReceivableDetail(receivable)}
                                                    className="hover:bg-surface transition-colors cursor-pointer"
                                                >
                                                    <td className="px-6 py-4 text-sm font-semibold text-primary">{receivable.referenceCode}</td>
                                                    <td className="px-6 py-4 text-sm text-secondary">{receivable.clientName || '-'}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-400 tabular-nums">{formatCurrency(Number(receivable.totalAmount || 0))}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-semibold text-primary tabular-nums">{formatCurrency(Number(receivable.outstandingAmount || 0))}</td>
                                                    <td className="px-6 py-4"><BucketPill bucket={bucket} /></td>
                                                    <td className="px-6 py-4">
                                                        <StatusPill receivable={receivable} />
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-secondary">{receivable.dueDate ? formatDate(receivable.dueDate, 'short') : '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {filteredRows.length === 0 && (
                                <div className="p-12 text-center text-muted text-sm">
                                    {receivables.length === 0 ? 'No receivables on record.' : 'No receivables match the current filters.'}
                                </div>
                            )}
                        </>
                    )}

                    {viewMode === 'aging' && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-border bg-surface/50">
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                                            {AGED_BUCKET_ORDER.map((b) => (
                                                <th key={b} className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">
                                                    {AGED_BUCKET_LABELS[b]}
                                                </th>
                                            ))}
                                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {agingPivot.rows.map((row) => (
                                            <tr key={row.client} className="hover:bg-surface transition-colors">
                                                <td className="px-6 py-4 text-sm font-semibold text-primary">{row.client}</td>
                                                {AGED_BUCKET_ORDER.map((b) => (
                                                    <td key={b} className="px-6 py-4 text-right text-sm tabular-nums">
                                                        <BucketAmount bucket={b} amount={row[b]} />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-right text-sm font-bold text-primary tabular-nums">{formatCurrency(row.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {agingPivot.rows.length > 0 && (
                                        <tfoot className="bg-surface/30 border-t-2 border-border">
                                            <tr>
                                                <td className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-secondary">Totals</td>
                                                {AGED_BUCKET_ORDER.map((b) => (
                                                    <td key={b} className="px-6 py-4 text-right text-sm font-bold tabular-nums">
                                                        <BucketAmount bucket={b} amount={agingPivot.totals[b]} />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-right text-base font-bold text-primary tabular-nums">{formatCurrency(agingPivot.totals.total)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                            {agingPivot.rows.length === 0 && (
                                <div className="p-12 text-center text-muted text-sm">
                                    {filteredRows.length === 0
                                        ? 'No receivables match the current filters.'
                                        : 'No outstanding balances to age — all matching receivables are fully collected.'}
                                </div>
                            )}
                            {agingPivot.rows.length > 0 && (
                                <div className="px-6 py-3 border-t border-border bg-surface/20 text-[11px] text-muted">
                                    Aging is calculated from the receivable&apos;s due date as of today. Fully-collected receivables are excluded.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {selectedReceivableId && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 flex justify-end"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeReceivableDetail(); }}
                >
                    <div
                        className="w-full max-w-2xl h-full bg-[#0f172a] border-l border-border/80 flex flex-col"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-secondary">Receivable</p>
                                <h3 className="text-lg font-semibold text-primary">{selectedDetail?.referenceCode || selectedReceivableId}</h3>
                            </div>
                            <button type="button" onClick={closeReceivableDetail} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {loadingDetail && <p className="text-sm text-secondary">Loading details...</p>}
                            {detailError && <p className="text-sm text-rose-400">{detailError}</p>}

                            {!loadingDetail && selectedDetail && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <StatusPill receivable={selectedDetail} />
                                            <BucketPill bucket={getAgedBucket(selectedDetail, today)} />
                                        </div>
                                        <p className="text-xs text-muted">
                                            Updated {selectedDetail.updatedAt ? formatDate(selectedDetail.updatedAt, 'short') : '-'}
                                        </p>
                                    </div>

                                    <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                        <h4 className="text-sm font-semibold text-primary">Receivable</h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <Field label="Client" value={selectedDetail.clientName || '-'} />
                                            <Field label="Due date" value={selectedDetail.dueDate ? formatDate(selectedDetail.dueDate, 'short') : '-'} />
                                            <Field label="Total" value={formatCurrency(Number(selectedDetail.totalAmount || 0))} />
                                            <Field label="Outstanding" value={formatCurrency(Number(selectedDetail.outstandingAmount || 0))} />
                                            <Field label="Collected" value={formatCurrency(Number(selectedDetail.collectedAmount || 0))} />
                                            <Field label="Collection" value={selectedDetail.collectionStatus || '-'} />
                                        </div>
                                        {selectedDetail.isOverdue && (
                                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">
                                                ⚠ This receivable is currently overdue.
                                            </div>
                                        )}
                                        {selectedDetail.notes && (
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Notes</p>
                                                <p className="text-sm text-primary whitespace-pre-wrap">{selectedDetail.notes}</p>
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-secondary" />
                                            <h4 className="text-sm font-semibold text-primary">Source Invoices ({linkedInvoices.length})</h4>
                                        </div>
                                        {linkedInvoices.length === 0 && <p className="text-xs text-muted">No invoices linked yet.</p>}
                                        {linkedInvoices.map((inv) => (
                                            <div key={inv.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/40">
                                                <div className="flex flex-col">
                                                    <span className="text-primary font-semibold">{inv.invoiceNumber}</span>
                                                    <span className="text-secondary">{inv.status} — issued {formatDate(inv.issueDate, 'short')}</span>
                                                </div>
                                                <span className="text-emerald-300 tabular-nums font-semibold">{formatCurrency(Number(inv.totalAmount || 0))}</span>
                                            </div>
                                        ))}
                                    </section>

                                    <section className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Receipt size={14} className="text-secondary" />
                                            <h4 className="text-sm font-semibold text-primary">Collected Receipts ({linkedReceipts.length})</h4>
                                        </div>
                                        {linkedReceipts.length === 0 && <p className="text-xs text-muted">No receipts collected yet.</p>}
                                        {linkedReceipts.map((rec) => (
                                            <div key={rec.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/40">
                                                <div className="flex flex-col">
                                                    <span className="text-primary font-semibold">{rec.receiptReference}</span>
                                                    <span className="text-secondary">{(rec.method || '').replace('_', ' ')} — {formatDate(rec.receiptDate, 'short')}</span>
                                                </div>
                                                <span className="text-emerald-300 tabular-nums font-semibold">{formatCurrency(Number(rec.amount || 0))}</span>
                                            </div>
                                        ))}
                                    </section>

                                    {(selectedDetail.financeEntry?.evidenceDocuments || []).length > 0 && (
                                        <section className="rounded-xl border border-border/80 bg-card p-4 space-y-2">
                                            <h4 className="text-sm font-semibold text-primary">Evidence ({(selectedDetail.financeEntry?.evidenceDocuments || []).length})</h4>
                                            {(selectedDetail.financeEntry?.evidenceDocuments || []).slice(0, 8).map((doc) => (
                                                <a
                                                    key={doc.id}
                                                    href={`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/finance/evidence/${doc.id}/download`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/50 text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    <span>{doc.documentType} — {doc.originalFileName}</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            ))}
                                        </section>
                                    )}

                                    {(selectedDetail.financeEntry?.activities || []).length > 0 && (
                                        <section className="rounded-xl border border-border/80 bg-card p-4">
                                            <h4 className="text-sm font-semibold text-primary mb-3">Recent Activity</h4>
                                            <div className="space-y-2">
                                                {(selectedDetail.financeEntry?.activities || []).slice(0, 8).map((activity) => (
                                                    <div key={activity.id} className="rounded-lg border border-border bg-slate-900/40 px-3 py-2">
                                                        <div className="flex items-center justify-between text-[11px] text-muted">
                                                            <span>{activity.actorDisplayName || 'System'} - {activity.eventSource}</span>
                                                            <span>{new Date(activity.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-xs text-primary mt-1">{activity.message}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
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

const StatCard: React.FC<{ label: string; value: string; accent: 'emerald' | 'blue' | 'rose' }> = ({ label, value, accent }) => (
    <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : accent === 'blue' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {accent === 'rose' ? <AlertTriangle size={18} /> : <Wallet size={18} />}
            </div>
        </div>
        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
    </div>
);

const StatusPill: React.FC<{ receivable: ReceivableRecord }> = ({ receivable }) => {
    const status = receivable.isOverdue ? 'overdue' : (receivable.status || '').toLowerCase();
    const tone = status === 'overdue' ? 'danger'
        : status === 'paid' ? 'success'
            : status === 'cancelled' ? 'danger'
                : 'info';
    const styles = tone === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : tone === 'danger' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
            {status || 'open'}
        </span>
    );
};

const BucketPill: React.FC<{ bucket: AgedBucket | null }> = ({ bucket }) => {
    if (!bucket) {
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-slate-500/10 text-slate-400 border-slate-500/20">Cleared</span>;
    }
    const styles = bucket === 'current' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : bucket === '1-30' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : bucket === '31-60' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
            {AGED_BUCKET_LABELS[bucket]}
        </span>
    );
};

const BucketAmount: React.FC<{ bucket: AgedBucket; amount: number }> = ({ bucket, amount }) => {
    if (amount <= 0) return <span className="text-muted">-</span>;
    const tone = bucket === 'current' ? 'text-emerald-300'
        : bucket === '1-30' ? 'text-amber-300'
            : bucket === '31-60' ? 'text-orange-300'
                : 'text-rose-300';
    return <span className={`font-semibold ${tone}`}>{formatCurrency(amount)}</span>;
};

export default ReceivablesPage;
