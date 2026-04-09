import React, { useMemo, useState } from 'react';
import { Search, AlertTriangle, Wallet } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';

const ReceivablesPage: React.FC = () => {
    const { receivables } = useFinance();
    const [searchQuery, setSearchQuery] = useState('');

    const rows = useMemo(() => {
        return receivables.filter((item) => {
            const haystack = `${item.referenceCode} ${item.clientName || ''} ${item.financeEntry?.title || ''}`.toLowerCase();
            return haystack.includes(searchQuery.toLowerCase());
        });
    }, [receivables, searchQuery]);

    const totals = useMemo(() => ({
        total: rows.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
        outstanding: rows.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0),
        overdue: rows.filter((item) => item.isOverdue).length,
    }), [rows]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Receivables" value={formatCurrency(totals.total)} accent="emerald" />
                <StatCard label="Outstanding" value={formatCurrency(totals.outstanding)} accent="blue" />
                <StatCard label="Overdue Items" value={String(totals.overdue)} accent="rose" />
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-sm font-semibold text-primary">Receivables Control</h3>
                        <p className="text-xs text-secondary mt-1">Expected inflows grouped as controllable receivables.</p>
                    </div>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search receivables..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-64 placeholder:text-muted"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border bg-surface/50">
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Total</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Outstanding</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {rows.map((item) => (
                                <tr key={item.id} className="hover:bg-surface transition-colors">
                                    <td className="px-6 py-4 text-sm font-semibold text-primary">{item.referenceCode}</td>
                                    <td className="px-6 py-4 text-sm text-secondary">{item.clientName || '-'}</td>
                                    <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-400 tabular-nums">{formatCurrency(Number(item.totalAmount || 0))}</td>
                                    <td className="px-6 py-4 text-right text-sm font-semibold text-primary tabular-nums">{formatCurrency(Number(item.outstandingAmount || 0))}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                            {item.isOverdue ? 'Overdue' : item.collectionStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-secondary">{item.dueDate ? formatDate(item.dueDate, 'short') : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rows.length === 0 && (
                    <div className="p-12 text-center text-muted text-sm">No receivables found.</div>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'blue' | 'rose' }) => (
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

export default ReceivablesPage;


