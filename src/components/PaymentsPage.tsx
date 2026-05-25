import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { PaymentDisbursementRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import ComboboxSelect from './ui/ComboboxSelect';

const PAYMENT_STATUS_OPTIONS = ['all', 'pending', 'completed', 'failed', 'cancelled'];
const PAYMENT_METHOD_OPTIONS = ['all', 'bank_transfer', 'mobile_money', 'cash', 'check'];

interface PaymentsResponse {
    payments: PaymentDisbursementRecord[];
}

interface CreatePaymentResponse {
    payment: PaymentDisbursementRecord;
}

const isoToday = () => new Date().toISOString().slice(0, 10);

const PaymentsPage: React.FC = () => {
    const { paymentDisbursements: contextPayments, payables } = useFinance();
    const { user } = useAuth();

    const [payments, setPayments] = useState<PaymentDisbursementRecord[]>(contextPayments);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [methodFilter, setMethodFilter] = useState<string>('all');
    const [vendorFilter, setVendorFilter] = useState('');
    const [dateFromFilter, setDateFromFilter] = useState('');
    const [dateToFilter, setDateToFilter] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createPayableId, setCreatePayableId] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createMethod, setCreateMethod] = useState('bank_transfer');
    const [createPaymentDate, setCreatePaymentDate] = useState(isoToday);
    const [createPaymentReference, setCreatePaymentReference] = useState('');
    const [createProofReference, setCreateProofReference] = useState('');
    const [createCurrency, setCreateCurrency] = useState('USD');
    const [createNotes, setCreateNotes] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        setPayments(contextPayments);
    }, [contextPayments]);

    // Default amount to outstanding when picking a payable.
    useEffect(() => {
        if (!createPayableId) return;
        const payable = payables.find((p) => p.id === createPayableId);
        if (!payable) return;
        const outstanding = Number(payable.outstandingAmount || 0);
        if (!createAmount && outstanding > 0) setCreateAmount(String(outstanding));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createPayableId]);

    const selectedCreatePayable = useMemo(
        () => payables.find((p) => p.id === createPayableId) || null,
        [payables, createPayableId],
    );

    // Payable selector limited to those still owing — paying a fully-paid
    // payable would just be rejected by the backend anyway.
    const payableOptions = useMemo(() => {
        return payables
            .filter((p) => Number(p.outstandingAmount || 0) > 0)
            .slice()
            .sort((a, b) => (a.referenceCode || '').localeCompare(b.referenceCode || ''))
            .map((p) => ({
                id: p.id,
                label: p.referenceCode,
                subLabel: `${p.vendorName || 'Unknown vendor'} — outstanding ${formatCurrency(Number(p.outstandingAmount || 0))}`,
            }));
    }, [payables]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || methodFilter !== 'all' || vendorFilter || dateFromFilter || dateToFilter);

    const filteredRows = useMemo(() => {
        const sq = searchQuery.toLowerCase();
        const vq = vendorFilter.toLowerCase();
        return payments.filter((payment) => {
            if (sq) {
                const hay = `${payment.paymentReference} ${payment.payable?.vendorName || ''} ${payment.payable?.referenceCode || ''}`.toLowerCase();
                if (!hay.includes(sq)) return false;
            }
            if (statusFilter !== 'all' && payment.status !== statusFilter) return false;
            if (methodFilter !== 'all' && payment.method !== methodFilter) return false;
            if (vq && !(payment.payable?.vendorName || '').toLowerCase().includes(vq)) return false;
            if (dateFromFilter && payment.paymentDate && payment.paymentDate.slice(0, 10) < dateFromFilter) return false;
            if (dateToFilter && payment.paymentDate && payment.paymentDate.slice(0, 10) > dateToFilter) return false;
            return true;
        });
    }, [payments, searchQuery, statusFilter, methodFilter, vendorFilter, dateFromFilter, dateToFilter]);

    const stats = useMemo(() => ({
        count: filteredRows.length,
        totalDisbursed: filteredRows
            .filter((p) => p.status === 'completed')
            .reduce((s, p) => s + Number(p.amount || 0), 0),
        pendingCount: filteredRows.filter((p) => p.status === 'pending').length,
    }), [filteredRows]);

    const refreshPayments = async () => {
        const data = await apiRequest<PaymentsResponse>('/api/v1/finance/payments?take=200');
        setPayments(data.payments || []);
    };

    const openCreateModal = () => {
        setCreatePayableId('');
        setCreateAmount('');
        setCreateMethod('bank_transfer');
        setCreatePaymentDate(isoToday());
        setCreatePaymentReference('');
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
        if (!createPayableId) {
            setCreateError('Select a payable to settle.');
            return;
        }
        const amount = Number(createAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            setCreateError('Amount must be greater than zero.');
            return;
        }
        const outstanding = Number(selectedCreatePayable?.outstandingAmount || 0);
        if (outstanding > 0 && amount > outstanding) {
            setCreateError(`Amount exceeds outstanding (${formatCurrency(outstanding)}).`);
            return;
        }

        setCreateSubmitting(true);
        setCreateError(null);
        try {
            await apiRequest<CreatePaymentResponse>('/api/v1/finance/payments', {
                method: 'POST',
                body: {
                    payableId: createPayableId,
                    amount,
                    method: createMethod,
                    paymentDate: createPaymentDate,
                    paymentReference: createPaymentReference.trim() || undefined,
                    proofReference: createProofReference.trim() || undefined,
                    currencyCode: createCurrency || 'USD',
                    notes: createNotes.trim() || null,
                    actorUserId: user?.id,
                    actorDisplayName: user?.name,
                },
            });
            await refreshPayments();
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Unable to record payment.');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setMethodFilter('all');
        setVendorFilter('');
        setDateFromFilter('');
        setDateToFilter('');
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Payments (filtered)" value={String(stats.count)} />
                    <StatCard label="Disbursed (completed)" value={formatCurrency(stats.totalDisbursed)} accent="rose" />
                    <StatCard label="Pending" value={String(stats.pendingCount)} accent="amber" />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-primary">Payment Disbursements</h3>
                                <p className="text-xs text-secondary mt-1">Outgoing payments settling vendor payables. SCM payments require approval + transfer proof on the parent payable.</p>
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
                                    <Plus size={14} /> Record Payment
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                            <div className="relative md:col-span-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search reference or vendor..."
                                    className="bg-surface border border-border rounded-lg h-9 pl-9 pr-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-full placeholder:text-muted"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {PAYMENT_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
                                ))}
                            </select>
                            <select
                                value={methodFilter}
                                onChange={(e) => setMethodFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {PAYMENT_METHOD_OPTIONS.map((m) => (
                                    <option key={m} value={m}>{m === 'all' ? 'All methods' : m.replace('_', ' ')}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={dateFromFilter}
                                onChange={(e) => setDateFromFilter(e.target.value)}
                                title="Payment date from"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                            <input
                                type="date"
                                value={dateToFilter}
                                onChange={(e) => setDateToFilter(e.target.value)}
                                title="Payment date to"
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            />
                        </div>

                        <input
                            value={vendorFilter}
                            onChange={(e) => setVendorFilter(e.target.value)}
                            placeholder="Vendor contains..."
                            className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 placeholder:text-muted w-full md:w-72"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-surface/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Vendor</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Payable</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Amount</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Method</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredRows.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-surface transition-colors">
                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{payment.paymentReference}</td>
                                        <td className="px-6 py-4 text-sm text-secondary">{payment.payable?.vendorName || '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{payment.payable?.referenceCode || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-rose-300 tabular-nums">{formatCurrency(Number(payment.amount || 0))}</td>
                                        <td className="px-6 py-4 text-xs text-secondary lowercase">{(payment.method || '').replace('_', ' ')}</td>
                                        <td className="px-6 py-4"><StatusPill status={payment.status} /></td>
                                        <td className="px-6 py-4 text-xs text-secondary">{payment.paymentDate ? formatDate(payment.paymentDate, 'short') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRows.length === 0 && (
                        <div className="p-12 text-center text-muted text-sm">
                            {payments.length === 0 ? 'No payments recorded yet — record the first from a payable.' : 'No payments match the current filters.'}
                        </div>
                    )}
                </div>
            </div>

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
                                <p className="text-xs uppercase tracking-wider text-secondary">New Payment</p>
                                <h3 className="text-lg font-semibold text-primary">Record Payment</h3>
                            </div>
                            <button type="button" onClick={closeCreateModal} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {createError && (
                                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">{createError}</div>
                            )}

                            <ComboboxSelect
                                label="Parent Payable (with outstanding balance)"
                                required
                                options={payableOptions}
                                value={createPayableId}
                                onChange={setCreatePayableId}
                                placeholder="Search payable by reference or vendor..."
                                emptyMessage="No payables with outstanding balance."
                            />

                            {selectedCreatePayable && (
                                <div className="rounded-lg border border-border bg-slate-900/40 px-3 py-2 text-xs text-secondary flex items-center justify-between">
                                    <span>Outstanding on {selectedCreatePayable.referenceCode}</span>
                                    <span className="font-semibold text-amber-300 tabular-nums">
                                        {formatCurrency(Number(selectedCreatePayable.outstandingAmount || 0))}
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
                                        {PAYMENT_METHOD_OPTIONS.filter((m) => m !== 'all').map((m) => (
                                            <option key={m} value={m}>{m.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Payment date" required>
                                    <input
                                        type="date"
                                        required
                                        value={createPaymentDate}
                                        onChange={(e) => setCreatePaymentDate(e.target.value)}
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
                                <FormField label="Payment reference">
                                    <input
                                        value={createPaymentReference}
                                        onChange={(e) => setCreatePaymentReference(e.target.value)}
                                        placeholder="Auto-generated if blank"
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                                <FormField label="Proof reference">
                                    <input
                                        value={createProofReference}
                                        onChange={(e) => setCreateProofReference(e.target.value)}
                                        placeholder="Bank ref / wire confirmation"
                                        className="h-10 bg-slate-900/70 border border-border/80 rounded-lg px-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40 w-full"
                                    />
                                </FormField>
                            </div>

                            <p className="text-[11px] text-muted">
                                Required for SCM payables. The backend attaches a synthetic evidence document from this reference.
                            </p>

                            <FormField label="Notes">
                                <textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    placeholder="Optional context for the payment"
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
                                {createSubmitting ? 'Recording...' : 'Record Payment'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="w-full">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {label} {required && <span className="text-red-400">*</span>}
        </label>
        {children}
    </div>
);

const StatCard: React.FC<{ label: string; value: string; accent?: 'rose' | 'amber' }> = ({ label, value, accent }) => (
    <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        {accent && (
            <div
                className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] ${accent === 'rose' ? 'bg-rose-500' : 'bg-amber-500'}`}
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

export default PaymentsPage;
