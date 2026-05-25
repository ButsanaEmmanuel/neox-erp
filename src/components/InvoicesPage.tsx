import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { CustomerInvoiceRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import ComboboxSelect from './ui/ComboboxSelect';

const INVOICE_STATUS_OPTIONS = ['all', 'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'];

interface CustomerInvoicesResponse {
    invoices: CustomerInvoiceRecord[];
}

interface CreateInvoiceResponse {
    invoice: CustomerInvoiceRecord;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoPlusDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const InvoicesPage: React.FC = () => {
    const { customerInvoices: contextInvoices, receivables } = useFinance();
    const { user } = useAuth();

    const [invoices, setInvoices] = useState<CustomerInvoiceRecord[]>(contextInvoices);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [clientFilter, setClientFilter] = useState('');
    const [issueFromFilter, setIssueFromFilter] = useState('');
    const [issueToFilter, setIssueToFilter] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createReceivableId, setCreateReceivableId] = useState('');
    const [createInvoiceNumber, setCreateInvoiceNumber] = useState('');
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
        setInvoices(contextInvoices);
    }, [contextInvoices]);

    // Default amounts from selected receivable so the user does not retype the obvious case.
    useEffect(() => {
        if (!createReceivableId) return;
        const receivable = receivables.find((r) => r.id === createReceivableId);
        if (!receivable) return;
        const amount = Number(receivable.totalAmount || 0);
        if (!createSubtotal) setCreateSubtotal(String(amount));
        if (!createTotal) setCreateTotal(String(amount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createReceivableId]);

    // Keep total in sync with subtotal+tax until the user overrides it.
    useEffect(() => {
        const subtotal = Number(createSubtotal || 0);
        const tax = Number(createTax || 0);
        if (Number.isFinite(subtotal) && Number.isFinite(tax)) {
            setCreateTotal(String(Number((subtotal + tax).toFixed(2))));
        }
    }, [createSubtotal, createTax]);

    const receivableOptions = useMemo(() => {
        return receivables
            .slice()
            .sort((a, b) => (a.referenceCode || '').localeCompare(b.referenceCode || ''))
            .map((r) => ({
                id: r.id,
                label: r.referenceCode,
                subLabel: `${r.clientName || 'Unknown client'} — ${formatCurrency(Number(r.totalAmount || 0))} outstanding ${formatCurrency(Number(r.outstandingAmount || 0))}`,
            }));
    }, [receivables]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all' || clientFilter || issueFromFilter || issueToFilter);

    const filteredRows = useMemo(() => {
        const sq = searchQuery.toLowerCase();
        const cq = clientFilter.toLowerCase();
        return invoices.filter((invoice) => {
            if (sq) {
                const hay = `${invoice.invoiceNumber} ${invoice.receivable?.clientName || ''} ${invoice.receivable?.referenceCode || ''}`.toLowerCase();
                if (!hay.includes(sq)) return false;
            }
            if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
            if (cq && !(invoice.receivable?.clientName || '').toLowerCase().includes(cq)) return false;
            if (issueFromFilter && invoice.issueDate && invoice.issueDate.slice(0, 10) < issueFromFilter) return false;
            if (issueToFilter && invoice.issueDate && invoice.issueDate.slice(0, 10) > issueToFilter) return false;
            return true;
        });
    }, [invoices, searchQuery, statusFilter, clientFilter, issueFromFilter, issueToFilter]);

    const stats = useMemo(() => {
        const total = filteredRows.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
        const paid = filteredRows
            .filter((inv) => inv.status.toLowerCase() === 'paid')
            .reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
        const overdueRows = filteredRows.filter((inv) => inv.status.toLowerCase() === 'overdue');
        const overdue = overdueRows.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
        return { total, paid, overdue, overdueCount: overdueRows.length };
    }, [filteredRows]);

    const refreshInvoices = async () => {
        const data = await apiRequest<CustomerInvoicesResponse>('/api/v1/finance/invoices?take=200');
        setInvoices(data.invoices || []);
    };

    const openCreateModal = () => {
        setCreateReceivableId('');
        setCreateInvoiceNumber('');
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
        if (!createReceivableId) {
            setCreateError('Select a parent receivable to invoice.');
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
            await apiRequest<CreateInvoiceResponse>('/api/v1/finance/invoices', {
                method: 'POST',
                body: {
                    receivableId: createReceivableId,
                    invoiceNumber: createInvoiceNumber.trim() || undefined,
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
            await refreshInvoices();
            closeCreateModal();
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Unable to create invoice.');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setClientFilter('');
        setIssueFromFilter('');
        setIssueToFilter('');
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Invoiced" value={formatCurrency(stats.total)} color="blue" />
                    <StatCard label="Collected" value={formatCurrency(stats.paid)} color="emerald" />
                    <StatCard
                        label="Overdue Amount"
                        value={formatCurrency(stats.overdue)}
                        color="rose"
                        subtext={stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : undefined}
                    />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-border flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-primary">Customer Invoices</h3>
                                <p className="text-xs text-secondary mt-1">Receivable-linked invoices. Collections and adjustments live on the parent receivable.</p>
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
                                    <Plus size={14} /> New Invoice
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search invoice # or client..."
                                    className="bg-surface border border-border rounded-lg h-9 pl-9 pr-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-full placeholder:text-muted"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-surface border border-border rounded-lg h-9 px-3 text-[13px] text-primary focus:outline-none focus:border-blue-500/50"
                            >
                                {INVOICE_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
                                ))}
                            </select>
                            <input
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                placeholder="Client contains..."
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
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Invoice #</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Receivable</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Subtotal</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Tax</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Issue</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredRows.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-surface transition-colors">
                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{invoice.invoiceNumber}</td>
                                        <td className="px-6 py-4 text-sm text-secondary">{invoice.receivable?.clientName || '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{invoice.receivable?.referenceCode || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm text-secondary tabular-nums">{formatCurrency(Number(invoice.subtotalAmount || 0))}</td>
                                        <td className="px-6 py-4 text-right text-xs text-secondary tabular-nums">{formatCurrency(Number(invoice.taxAmount || 0))}</td>
                                        <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-300 tabular-nums">{formatCurrency(Number(invoice.totalAmount || 0))}</td>
                                        <td className="px-6 py-4"><StatusPill status={invoice.status} /></td>
                                        <td className="px-6 py-4 text-xs text-secondary">{invoice.issueDate ? formatDate(invoice.issueDate, 'short') : '-'}</td>
                                        <td className="px-6 py-4 text-xs text-secondary">{invoice.dueDate ? formatDate(invoice.dueDate, 'short') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRows.length === 0 && (
                        <div className="p-12 text-center text-muted text-sm">
                            {invoices.length === 0 ? 'No invoices recorded yet — create the first one from a receivable.' : 'No invoices match the current filters.'}
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
                                <p className="text-xs uppercase tracking-wider text-secondary">New Customer Invoice</p>
                                <h3 className="text-lg font-semibold text-primary">Create Invoice</h3>
                            </div>
                            <button type="button" onClick={closeCreateModal} className="text-secondary hover:text-primary"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {createError && (
                                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2">{createError}</div>
                            )}

                            <ComboboxSelect
                                label="Parent Receivable"
                                required
                                options={receivableOptions}
                                value={createReceivableId}
                                onChange={setCreateReceivableId}
                                placeholder="Search receivable by reference or client..."
                                emptyMessage="No receivables match — create a receivable first via the PM or sales workflow."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField label="Invoice number">
                                    <input
                                        value={createInvoiceNumber}
                                        onChange={(e) => setCreateInvoiceNumber(e.target.value)}
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
                                    placeholder="Optional context for the invoice"
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
                                {createSubmitting ? 'Creating...' : 'Create Invoice'}
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

const StatCard: React.FC<{ label: string; value: string; color: 'blue' | 'emerald' | 'rose'; subtext?: string }> = ({ label, value, color, subtext }) => (
    <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
        <div
            className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] ${color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
        />
        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-end gap-3">
            <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
            {subtext && <span className="text-[10px] text-rose-500 font-bold mb-1 uppercase tracking-tight">{subtext}</span>}
        </div>
    </div>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const lower = status.toLowerCase();
    const tone = lower === 'paid' ? 'success'
        : lower === 'overdue' || lower === 'cancelled' ? 'danger'
            : lower === 'sent' || lower === 'partial' ? 'info'
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

export default InvoicesPage;
