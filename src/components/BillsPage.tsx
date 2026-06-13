import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Info, Plus, Search, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { useActorPath } from '../lib/useActorPath';
import { PayableRecord, VendorBillRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import ComboboxSelect from './ui/ComboboxSelect';

const BILL_STATUS_OPTIONS = ['all', 'received', 'approved', 'paid', 'cancelled'];

interface VendorBillsResponse {
    bills: VendorBillRecord[];
}

interface CreateBillResponse {
    bill: VendorBillRecord;
}

interface PayableDetailResponse {
    payable: PayableRecord | null;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoPlusDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const BillsPage: React.FC = () => {
    const { vendorBills: contextBills, payables } = useFinance();
    const { user } = useAuth();
    const withActor = useActorPath();

    const [bills, setBills] = useState<VendorBillRecord[]>(contextBills);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [vendorFilter, setVendorFilter] = useState('');
    const [issueFromFilter, setIssueFromFilter] = useState('');
    const [issueToFilter, setIssueToFilter] = useState('');

    const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
    const [selectedParentPayable, setSelectedParentPayable] = useState<PayableRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createPayableId, setCreatePayableId] = useState('');
    const [createBillNumber, setCreateBillNumber] = useState('');
    const [createIssueDate, setCreateIssueDate] = useState(isoToday);
    const [createDueDate, setCreateDueDate] = useState(() => isoPlusDays(14));
    const [createSubtotal, setCreateSubtotal] = useState('');
    const [createTax, setCreateTax] = useState('0');
    const [createTotal, setCreateTotal] = useState('');
    const [createCurrency, setCreateCurrency] = useState('USD');
    const [createNotes, setCreateNotes] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        setBills(contextBills);
    }, [contextBills]);

    // Default amounts from selected payable so the user doesn't retype the obvious case.
    useEffect(() => {
        if (!createPayableId) return;
        const payable = payables.find((p) => p.id === createPayableId);
        if (!payable) return;
        const amount = Number(payable.totalAmount || 0);
        if (!createSubtotal) setCreateSubtotal(String(amount));
        if (!createTotal) setCreateTotal(String(amount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createPayableId]);

    // Keep total in sync with subtotal+tax until the user overrides it explicitly via the input.
    useEffect(() => {
        const subtotal = Number(createSubtotal || 0);
        const tax = Number(createTax || 0);
        if (Number.isFinite(subtotal) && Number.isFinite(tax)) {
            setCreateTotal(String(Number((subtotal + tax).toFixed(2))));
        }
    }, [createSubtotal, createTax]);

    const payableOptions = useMemo(() => {
        return payables
            .slice()
            .sort((a, b) => (a.referenceCode || '').localeCompare(b.referenceCode || ''))
            .map((p) => ({
                id: p.id,
                label: p.referenceCode,
                subLabel: `${p.vendorName || 'Unknown vendor'} — ${formatCurrency(Number(p.totalAmount || 0))} outstanding ${formatCurrency(Number(p.outstandingAmount || 0))}`,
            }));
    }, [payables]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || vendorFilter || issueFromFilter || issueToFilter);

    const filteredRows = useMemo(() => {
        const sq = searchQuery.toLowerCase();
        const vq = vendorFilter.toLowerCase();
        return bills.filter((bill) => {
            if (sq) {
                const hay = `${bill.billNumber} ${bill.payable?.vendorName || ''} ${bill.payable?.referenceCode || ''}`.toLowerCase();
                if (!hay.includes(sq)) return false;
            }
            if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
            if (vq && !(bill.payable?.vendorName || '').toLowerCase().includes(vq)) return false;
            if (issueFromFilter && bill.issueDate && bill.issueDate.slice(0, 10) < issueFromFilter) return false;
            if (issueToFilter && bill.issueDate && bill.issueDate.slice(0, 10) > issueToFilter) return false;
            return true;
        });
    }, [bills, searchQuery, statusFilter, vendorFilter, issueFromFilter, issueToFilter]);

    const totals = useMemo(() => ({
        count: filteredRows.length,
        totalAmount: filteredRows.reduce((s, b) => s + Number(b.totalAmount || 0), 0),
        unpaidCount: filteredRows.filter((b) => b.status !== 'paid' && b.status !== 'cancelled').length,
    }), [filteredRows]);

    const refreshBills = async () => {
        const data = await apiRequest<VendorBillsResponse>(withActor('/api/v1/finance/bills?take=200'));
        setBills(data.bills || []);
    };

    const selectedBill = useMemo(() => bills.find((b) => b.id === selectedBillId) || null, [bills, selectedBillId]);

    const openBillDetail = async (bill: VendorBillRecord) => {
        setSelectedBillId(bill.id);
        setSelectedParentPayable(null);
        setDetailError(null);
        if (!bill.payableId) return;
        setLoadingDetail(true);
        try {
            const data = await apiRequest<PayableDetailResponse>(withActor(`/api/v1/finance/payables/${bill.payableId}`));
            setSelectedParentPayable(data.payable || null);
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : 'Unable to load parent payable.');
        } finally {
            setLoadingDetail(false);
        }
    };

    const closeBillDetail = () => {
        setSelectedBillId(null);
        setSelectedParentPayable(null);
        setDetailError(null);
    };

    const openCreateModal = () => {
        setCreatePayableId('');
        setCreateBillNumber('');
        setCreateIssueDate(isoToday());
        setCreateDueDate(isoPlusDays(14));
        setCreateSubtotal('');
        setCreateTax('0');
        setCreateTotal('');
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
        if (!createPayableId) {
            setCreateError('Select a parent payable to bill.');
            return;
        }
        const subtotal = Number(createSubtotal || 0);
        const tax = Number(createTax || 0);
        const total = Number(createTotal || 0);
        if (!Number.isFinite(subtotal) || subtotal <= 0) {
            setCreateError('Subtotal must be greater than zero.');
            return;
        }
        if (!Number.isFinite(total) || total <= 0) {
            setCreateError('Total must be greater than zero.');
            return;
        }

        setCreateSubmitting(true);
        setCreateError(null);
        try {
            await apiRequest<CreateBillResponse>(withActor('/api/v1/finance/bills'), {
                method: 'POST',
                body: {
                    payableId: createPayableId,
                    billNumber: createBillNumber.trim() || undefined,
                    issueDate: createIssueDate,
                    dueDate: createDueDate,
                    subtotalAmount: subtotal,
                    taxAmount: tax,
                    totalAmount: total,
                    currencyCode: createCurrency || 'USD',
                    notes: createNotes.trim() || null,
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
            await refreshBills();
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Unable to create bill.');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setVendorFilter('');
        setIssueFromFilter('');
        setIssueToFilter('');
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Bills (filtered)" value={String(totals.count)} />
                    <StatCard label="Total amount" value={formatCurrency(totals.totalAmount)} />
                    <StatCard label="Unpaid bills" value={String(totals.unpaidCount)} />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-primary">Vendor Bills</h3>
                                <p className="text-xs text-secondary mt-1">Supplier-side bills justifying outstanding payables. Approvals and evidence live on the parent payable.</p>
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
                                    <Plus size={14} /> New Bill
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search bill # or vendor..."
                                    className="bg-surface border border-border rounded-lg h-9 pl-9 pr-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-full placeholder:text-muted"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {BILL_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
                                ))}
                            </select>
                            <input
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                placeholder="Vendor contains..."
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 placeholder:text-muted"
                            />
                            <input
                                type="date"
                                value={issueFromFilter}
                                onChange={(e) => setIssueFromFilter(e.target.value)}
                                title="Issue date from"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                            <input
                                type="date"
                                value={issueToFilter}
                                onChange={(e) => setIssueToFilter(e.target.value)}
                                title="Issue date to"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-surface/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Bill #</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Vendor</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Payable</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Subtotal</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Tax</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Issue</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredRows.map((bill) => (
                                    <tr
                                        key={bill.id}
                                        onClick={() => void openBillDetail(bill)}
                                        className="hover:bg-surface transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{bill.billNumber}</td>
                                        <td className="px-6 py-4 text-sm text-secondary">{bill.payable?.vendorName || '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{bill.payable?.referenceCode || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm text-secondary tabular-nums">{formatCurrency(Number(bill.subtotalAmount || 0))}</td>
                                        <td className="px-6 py-4 text-right text-xs text-secondary tabular-nums">{formatCurrency(Number(bill.taxAmount || 0))}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-rose-300 tabular-nums">{formatCurrency(Number(bill.totalAmount || 0))}</td>
                                        <td className="px-6 py-4"><StatusPill status={bill.status} /></td>
                                        <td className="px-6 py-4 text-xs text-secondary">{bill.issueDate ? formatDate(bill.issueDate, 'short') : '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{bill.dueDate ? formatDate(bill.dueDate, 'short') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRows.length === 0 && (
                        <div className="p-12 text-center text-muted text-sm">
                            {bills.length === 0 ? 'No bills recorded yet — create the first one from a payable.' : 'No bills match the current filters.'}
                        </div>
                    )}
                </div>
            </div>

            {selectedBillId && selectedBill && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 flex justify-end"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeBillDetail(); }}
                >
                    <div
                        className="w-full max-w-2xl h-full bg-[#0f172a] border-l border-border/80 flex flex-col"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-secondary">Vendor Bill</p>
                                <h3 className="text-lg font-semibold text-primary">{selectedBill.billNumber}</h3>
                            </div>
                            <button type="button" onClick={closeBillDetail} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            <div className="flex items-center justify-between">
                                <StatusPill status={selectedBill.status} />
                                <p className="text-xs text-muted">
                                    Updated {selectedBill.updatedAt ? formatDate(selectedBill.updatedAt, 'short') : '-'}
                                </p>
                            </div>

                            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-primary">Bill</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <Field label="Issue date" value={selectedBill.issueDate ? formatDate(selectedBill.issueDate, 'short') : '-'} />
                                    <Field label="Due date" value={selectedBill.dueDate ? formatDate(selectedBill.dueDate, 'short') : '-'} />
                                    <Field label="Subtotal" value={`${formatCurrency(Number(selectedBill.subtotalAmount || 0))} ${selectedBill.currencyCode || ''}`} />
                                    <Field label="Tax" value={`${formatCurrency(Number(selectedBill.taxAmount || 0))} ${selectedBill.currencyCode || ''}`} />
                                    <Field label="Total" value={`${formatCurrency(Number(selectedBill.totalAmount || 0))} ${selectedBill.currencyCode || ''}`} />
                                    <Field label="Currency" value={selectedBill.currencyCode || '-'} />
                                </div>
                                {selectedBill.notes && (
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Notes</p>
                                        <p className="text-sm text-primary whitespace-pre-wrap">{selectedBill.notes}</p>
                                    </div>
                                )}
                                <div className="text-[11px] text-muted">
                                    Created by {selectedBill.createdByName || 'unknown'}{selectedBill.createdAt ? ` on ${formatDate(selectedBill.createdAt, 'short')}` : ''}
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-primary">Parent Payable</h4>
                                    {loadingDetail && <span className="text-xs text-secondary">Loading...</span>}
                                </div>
                                {detailError && <p className="text-xs text-rose-400">{detailError}</p>}

                                {!loadingDetail && selectedParentPayable && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <Field label="Reference" value={selectedParentPayable.referenceCode || '-'} />
                                            <Field label="Vendor" value={selectedParentPayable.vendorName || '-'} />
                                            <Field label="Total" value={formatCurrency(Number(selectedParentPayable.totalAmount || 0))} />
                                            <Field label="Outstanding" value={formatCurrency(Number(selectedParentPayable.outstandingAmount || 0))} />
                                            <Field label="Paid" value={formatCurrency(Number(selectedParentPayable.paidAmount || 0))} />
                                            <Field label="Due date" value={selectedParentPayable.dueDate ? formatDate(selectedParentPayable.dueDate, 'short') : '-'} />
                                            <Field label="Approval" value={selectedParentPayable.financeEntry?.approvalStatus || '-'} />
                                            <Field label="Evidence" value={selectedParentPayable.financeEntry?.evidenceStatus || '-'} />
                                        </div>

                                        {(selectedParentPayable.financeEntry?.sourceLinks || []).filter((l) => l.sourceModule === 'scm').length > 0 && (
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wider text-muted mb-2">SCM source links</p>
                                                <div className="space-y-2">
                                                    {(selectedParentPayable.financeEntry?.sourceLinks || []).filter((l) => l.sourceModule === 'scm').map((link) => (
                                                        <div key={link.id} className="flex items-center justify-between text-xs border border-border rounded-lg px-3 py-2 bg-slate-900/40">
                                                            <span className="text-primary">{link.sourceEntity}:{link.sourceEntityId}</span>
                                                            <span className="text-secondary">{link.sourceEvent}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(selectedParentPayable.financeEntry?.activities || []).length > 0 && (
                                            <div>
                                                <p className="text-[11px] uppercase tracking-wider text-muted mb-2">Recent activity</p>
                                                <div className="space-y-2">
                                                    {(selectedParentPayable.financeEntry?.activities || []).slice(0, 5).map((activity) => (
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

                                {!loadingDetail && !selectedParentPayable && !detailError && (
                                    <p className="text-xs text-muted">No parent payable data available.</p>
                                )}
                            </section>

                            <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex gap-3">
                                <Info size={16} className="text-blue-300 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-blue-100 space-y-2">
                                    <p>
                                        Approvals, evidence uploads, and payment recording for this bill happen on the parent payable.
                                    </p>
                                    <p className="text-blue-300 flex items-center gap-1.5">
                                        <ExternalLink size={12} /> Open the <strong>Payables</strong> page and search for{' '}
                                        <code className="bg-blue-500/20 rounded px-1.5 py-0.5">{selectedParentPayable?.referenceCode || selectedBill.payableId}</code>.
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
                                <p className="text-xs uppercase tracking-wider text-secondary">New Vendor Bill</p>
                                <h3 className="text-lg font-semibold text-primary">Create Bill</h3>
                            </div>
                            <button type="button" onClick={closeCreateModal} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {createError && (
                                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">{createError}</div>
                            )}

                            <ComboboxSelect
                                label="Parent Payable"
                                required
                                options={payableOptions}
                                value={createPayableId}
                                onChange={setCreatePayableId}
                                placeholder="Search payable by reference or vendor..."
                                emptyMessage="No payables match — create a payable first via the PM workflow."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField label="Bill number">
                                    <input
                                        value={createBillNumber}
                                        onChange={(e) => setCreateBillNumber(e.target.value)}
                                        placeholder="Auto-generated if blank"
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
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
                                <FormField label="Issue date" required>
                                    <input
                                        type="date"
                                        required
                                        value={createIssueDate}
                                        onChange={(e) => setCreateIssueDate(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Due date" required>
                                    <input
                                        type="date"
                                        required
                                        value={createDueDate}
                                        onChange={(e) => setCreateDueDate(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Subtotal" required>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={createSubtotal}
                                        onChange={(e) => setCreateSubtotal(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Tax">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={createTax}
                                        onChange={(e) => setCreateTax(e.target.value)}
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                            </div>

                            <FormField label="Total" required>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={createTotal}
                                    onChange={(e) => setCreateTotal(e.target.value)}
                                    className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-blue-500/40 w-full"
                                />
                                <p className="text-[11px] text-muted mt-1">Auto-computed as Subtotal + Tax — override if needed.</p>
                            </FormField>

                            <FormField label="Notes">
                                <textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    placeholder="Optional context for the bill"
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
                                disabled={createSubmitting || !createPayableId}
                                className="h-9 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-60 text-xs font-semibold"
                            >
                                {createSubmitting ? 'Creating...' : 'Create Bill'}
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

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
    </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const tone = status === 'paid' ? 'success'
        : status === 'cancelled' ? 'danger'
            : status === 'approved' ? 'info'
                : 'warning';
    const styles = tone === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : tone === 'danger' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : tone === 'info' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
            {status}
        </span>
    );
};

export default BillsPage;
