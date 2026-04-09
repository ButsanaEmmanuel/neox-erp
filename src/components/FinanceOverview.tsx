import React, { useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    ArrowUpRight,
    ArrowRight
} from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const FinanceOverview: React.FC = () => {
    const { summary, transactions, invoices, accounts } = useFinance();

    const recentTransactions = useMemo(() => {
        return transactions.slice(0, 5);
    }, [transactions]);

    const overdueInvoices = useMemo(() => {
        return invoices.filter(inv => inv.status === 'overdue');
    }, [invoices]);

    const expectedFlows = useMemo(() => {
        const inflows = transactions.filter(
            (tx) => tx.type === 'income' && tx.categoryId === 'cat_project_receivables'
        );
        const outflows = transactions.filter(
            (tx) => tx.type === 'expense' && tx.categoryId === 'cat_project_payables'
        );

        const inflowAmount = inflows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const outflowAmount = outflows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const inflowPending = inflows.filter((tx) => tx.status === 'pending').length;
        const outflowSynced = outflows.filter((tx) => tx.status === 'completed').length;

        return { inflowAmount, outflowAmount, inflowPending, outflowSynced, inflowCount: inflows.length, outflowCount: outflows.length };
    }, [transactions]);

    const stats = [
        {
            label: 'Total Cash Balance',
            value: formatCurrency(summary.totalBalance),
            delta: '--',
            positive: true,
            icon: DollarSign,
            color: 'emerald'
        },
        {
            label: 'Monthly Burn Rate',
            value: formatCurrency(summary.monthlyBurnRate),
            delta: '--',
            positive: true, // Spending less is positive
            icon: Clock,
            color: 'rose'
        },
        {
            label: 'Accounts Receivable',
            value: formatCurrency(summary.unpaidAccountsReceivable),
            delta: '--',
            positive: false, // More unpaid is usually negative contextually
            icon: ArrowUpRight,
            color: 'amber'
        },
        {
            label: 'Monthly Net Flow',
            value: formatCurrency(summary.monthlyIncome - summary.monthlyExpenses),
            delta: '--',
            positive: true,
            icon: TrendingUp,
            color: 'blue'
        }
    ];

    const monthlySeries = useMemo(() => {
        const income = Array.from({ length: 12 }, () => 0);
        const expense = Array.from({ length: 12 }, () => 0);
        for (const tx of transactions) {
            const d = new Date(tx.date);
            if (Number.isNaN(d.getTime())) continue;
            const month = d.getUTCMonth();
            if (tx.type === 'income') income[month] += Number(tx.amount || 0);
            if (tx.type === 'expense') expense[month] += Number(tx.amount || 0);
        }
        const max = Math.max(
            1,
            ...income,
            ...expense,
        );
        const incomePct = income.map((v) => Math.round((v / max) * 100));
        const expensePct = expense.map((v) => Math.round((v / max) * 100));
        return { incomePct, expensePct };
    }, [transactions]);

    const liquidityRatio = useMemo(() => {
        const expenses = Number(summary.monthlyExpenses || 0);
        if (expenses <= 0) return 0;
        return Number(summary.totalBalance || 0) / expenses;
    }, [summary.monthlyExpenses, summary.totalBalance]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-input transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn(
                                "p-2 rounded-lg",
                                stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" :
                                    stat.color === 'rose' ? "bg-rose-500/10 text-rose-500" :
                                        stat.color === 'amber' ? "bg-amber-500/10 text-amber-500" :
                                            "bg-blue-500/10 text-blue-500"
                            )}>
                                <stat.icon size={20} />
                            </div>
                            <span className={cn(
                                "text-xs font-bold px-1.5 py-0.5 rounded border",
                                stat.positive
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            )}>
                                {stat.delta}
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-primary tabular-nums">{stat.value}</h3>

                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-border/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>

            {/* Expected Flow Split (DB only) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-emerald-500/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-emerald-300">Expected Inflows</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 uppercase tracking-wide">
                            PO Unit Price Completed
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(expectedFlows.inflowAmount)}</p>
                    <p className="text-xs text-muted mt-1">
                        {expectedFlows.inflowCount} entries from DB - {expectedFlows.inflowPending} pending collection
                    </p>
                </div>

                <div className="bg-card border border-rose-500/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-rose-300">Expected Outflows</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 uppercase tracking-wide">
                            Contractor Payable Amount
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(expectedFlows.outflowAmount)}</p>
                    <p className="text-xs text-muted mt-1">
                        {expectedFlows.outflowCount} entries from DB - {expectedFlows.outflowSynced} synced
                    </p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Cashflow Chart Placeholder */}
                <div className="lg:col-span-8 bg-card border border-border rounded-xl flex flex-col min-h-[400px]">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-primary">Cashflow Trend</h3>
                            <p className="text-xs text-muted">Net movement across all accounts</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Income
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 uppercase tracking-tight">
                                <span className="w-2 h-2 rounded-full bg-rose-500" /> Expense
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-6 flex justify-between gap-3 h-64">
                        {monthlySeries.incomePct.map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                                <div className="w-full flex-1 flex items-end justify-center gap-1">
                                    <div
                                        className="w-1/2 bg-emerald-500/40 group-hover:bg-emerald-500/60 transition-all rounded-t-sm"
                                        style={{ height: `${Math.max(1, h)}%` }}
                                        title={`Income M${i + 1}`}
                                    />
                                    <div
                                        className="w-1/2 bg-rose-500/40 group-hover:bg-rose-500/60 transition-all rounded-t-sm"
                                        style={{ height: `${Math.max(1, monthlySeries.expensePct[i])}%` }}
                                        title={`Expense M${i + 1}`}
                                    />
                                </div>
                                <span className="text-[10px] font-medium text-muted uppercase mt-3">M{i + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Accounts Summary */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-semibold text-primary">Accounts</h3>
                            <button className="text-[11px] font-bold text-emerald-500 hover:underline uppercase tracking-wider">Manage</button>
                        </div>
                        <div className="space-y-4">
                            {accounts.map(acc => (
                                <div key={acc.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-xs font-bold text-muted">
                                            {acc.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-primary">{acc.name}</p>
                                            <p className="text-[10px] text-muted uppercase tracking-tight">{acc.institution}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-primary tabular-nums">{formatCurrency(acc.balance)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Financial Health</h4>
                            <p className="text-lg font-semibold text-primary mb-4">DB Snapshot</p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[11px] text-muted">
                                    <span>Liquidity Ratio</span>
                                    <span className="text-emerald-500 font-bold">{liquidityRatio.toFixed(2)}x</span>
                                </div>
                                <div className="h-1 bg-border/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, liquidityRatio * 25))}%` }} />
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <TrendingUp size={48} className="text-emerald-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Transactions & Overdue Invoices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <div className="bg-card border border-border rounded-xl flex flex-col">
                    <div className="p-4 px-6 border-b border-border flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-primary">Recent Transactions</h3>
                        <button className="text-[11px] font-bold text-muted hover:text-primary uppercase tracking-wider flex items-center gap-1">
                            Full History <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="p-2">
                        {recentTransactions.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between p-3 px-4 hover:bg-surface rounded-lg transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        tx.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-surface text-muted"
                                    )}>
                                        {tx.type === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-medium text-primary">{tx.memo}</p>
                                        <p className="text-[10px] text-muted">{new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <p className={cn(
                                    "text-[13px] font-bold tabular-nums",
                                    tx.type === 'income' ? "text-emerald-500" : "text-primary"
                                )}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Overdue Invoices */}
                <div className="bg-card border border-border rounded-xl flex flex-col">
                    <div className="p-4 px-6 border-b border-border flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-primary">Attention Required</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-tight">
                            {overdueInvoices.length} Overdue
                        </span>
                    </div>
                    <div className="p-2">
                        {overdueInvoices.length > 0 ? overdueInvoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-3 px-4 hover:bg-surface rounded-lg transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-bold">
                                        INV
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-medium text-primary">{inv.number}</p>
                                        <p className="text-[10px] text-rose-500/70 font-medium">Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-bold text-primary tabular-nums">{formatCurrency(inv.total)}</p>
                                    <p className="text-[10px] text-muted uppercase tracking-tighter">{inv.companyId || '-'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="h-40 flex flex-col items-center justify-center text-muted">
                                <Clock size={24} className="opacity-20 mb-2" />
                                <p className="text-xs">No overdue invoices</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceOverview;

