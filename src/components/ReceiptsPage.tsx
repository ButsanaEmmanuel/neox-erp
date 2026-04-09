import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';

const ReceiptsPage: React.FC = () => {
    const { receiptCollections } = useFinance();
    const [search, setSearch] = useState('');

    const rows = useMemo(() => receiptCollections.filter((receipt) => {
        const haystack = `${receipt.receiptReference} ${receipt.receivable?.clientName || ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
    }), [receiptCollections, search]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-sm font-semibold text-primary">Receipt Collections</h3>
                        <p className="text-xs text-secondary mt-1">Incoming receipts linked to receivables.</p>
                    </div>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search receipts..." className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-64 placeholder:text-muted" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                        <tr className="border-b border-border bg-surface/50">
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Amount</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Method</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Date</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                        {rows.map((receipt) => (
                            <tr key={receipt.id} className="hover:bg-surface transition-colors">
                                <td className="px-6 py-4 text-sm font-semibold text-primary">{receipt.receiptReference}</td>
                                <td className="px-6 py-4 text-sm text-secondary">{receipt.receivable?.clientName || '-'}</td>
                                <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-400 tabular-nums">{formatCurrency(Number(receipt.amount || 0))}</td>
                                <td className="px-6 py-4 text-xs text-secondary uppercase">{receipt.method}</td>
                                <td className="px-6 py-4 text-xs text-secondary">{formatDate(receipt.receiptDate, 'short')}</td>
                                <td className="px-6 py-4 text-xs text-secondary uppercase">{receipt.status}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReceiptsPage;


