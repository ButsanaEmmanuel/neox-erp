import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, Paperclip, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const badgeTone = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('approved') || normalized.includes('settled')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (normalized.includes('rejected') || normalized.includes('cancelled')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
};

const TransactionsPage: React.FC = () => {
    const { financeEntries, transactions } = useFinance();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<'all' | 'receivable' | 'payable'>('all');

    const rows = useMemo(() => {
        if (financeEntries.length > 0) {
            return financeEntries.filter((entry) => {
                const haystack = `${entry.title} ${entry.memo || ''} ${entry.companyName || ''}`.toLowerCase();
                const matchesSearch = haystack.includes(searchQuery.toLowerCase());
                const matchesType = selectedType === 'all' || entry.entryType === selectedType;
                return matchesSearch && matchesType;
            });
        }

        return transactions
            .filter((tx) => {
                const haystack = `${tx.memo || ''}`.toLowerCase();
                return haystack.includes(searchQuery.toLowerCase());
            })
            .map((tx) => ({
                id: tx.id,
                title: tx.memo || 'Transaction',
                memo: tx.memo,
                amount: tx.amount,
                currencyCode: tx.currency,
                entryType: tx.type === 'income' ? 'receivable' : 'payable',
                sourceModule: 'finance_snapshot',
                companyName: tx.companyId,
                lifecycleStatus: tx.status,
                evidenceStatus: 'not_required',
                approvalStatus: tx.status,
                settlementStatus: tx.status,
                updatedAt: tx.updatedAt,
                evidenceDocuments: [],
            }));
    }, [financeEntries, transactions, searchQuery, selectedType]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-surface animate-in fade-in duration-500">
            <div className="p-6 pb-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Find finance entries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-surface border border-border/80 rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 transition-colors w-72 placeholder:text-muted"
                        />
                    </div>
                    <div className="flex bg-surface p-0.5 rounded-lg border border-border/80">
                        {['all', 'receivable', 'payable'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setSelectedType(t as 'all' | 'receivable' | 'payable')}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all',
                                    selectedType === t
                                        ? 'bg-[#1e293b] text-blue-400 border border-border shadow-sm'
                                        : 'text-muted hover:text-secondary'
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs text-secondary flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Finance registry is now sourced from persisted finance entries.
                </div>
            </div>

            <div className="grid grid-cols-[1.3fr_110px_120px_120px_130px_100px_110px] gap-4 px-6 py-3 border-b border-border text-[10px] font-bold text-muted uppercase tracking-widest">
                <span>Description</span>
                <span className="text-right">Amount</span>
                <span>Type</span>
                <span>Evidence</span>
                <span>Approval</span>
                <span>Settlement</span>
                <span>Updated</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {rows.map((entry) => (
                    <div
                        key={entry.id}
                        className="grid grid-cols-[1.3fr_110px_120px_120px_130px_100px_110px] gap-4 px-6 py-4 border-b border-border/60 hover:bg-surface transition-colors"
                    >
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-primary truncate">{entry.title}</div>
                            <div className="text-xs text-secondary truncate mt-1">
                                {entry.companyName || entry.memo || 'No memo'}
                            </div>
                            <div className="text-[11px] text-muted mt-2 uppercase tracking-wide">
                                {entry.sourceModule.replace(/_/g, ' ')}
                            </div>
                        </div>
                        <div className={cn('text-right text-sm font-bold tabular-nums', entry.entryType === 'receivable' ? 'text-emerald-400' : 'text-rose-300')}>
                            {entry.entryType === 'receivable' ? '+' : '-'}{formatCurrency(Number(entry.amount || 0))}
                        </div>
                        <div className="text-xs text-secondary uppercase tracking-wide self-center">{entry.entryType}</div>
                        <div className="self-center">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border', badgeTone(entry.evidenceStatus))}>
                                <Paperclip size={10} />
                                {entry.evidenceStatus}
                            </span>
                        </div>
                        <div className="self-center">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border', badgeTone(entry.approvalStatus))}>
                                {entry.approvalStatus === 'approved' ? <CheckCircle2 size={10} /> : entry.approvalStatus === 'rejected' ? <XCircle size={10} /> : <Clock3 size={10} />}
                                {entry.approvalStatus}
                            </span>
                        </div>
                        <div className="self-center text-xs text-secondary uppercase tracking-wide">{entry.settlementStatus}</div>
                        <div className="self-center text-xs text-secondary">{formatDate(entry.updatedAt, 'short')}</div>
                    </div>
                ))}

                {rows.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-muted">
                        <Search size={40} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No finance entries match your filters</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransactionsPage;


