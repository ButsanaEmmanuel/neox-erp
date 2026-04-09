import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { formatCurrency, formatDate } from '../utils/formatters';

const InvoicesPage: React.FC = () => {
  const { customerInvoices } = useFinance();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => customerInvoices.filter((invoice) => {
    const haystack = `${invoice.invoiceNumber} ${invoice.receivable?.clientName || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [customerInvoices, search]);

  const stats = useMemo(() => {
    const total = rows.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const paid = rows
      .filter((inv) => inv.status.toLowerCase() === 'paid')
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const overdue = rows
      .filter((inv) => inv.status.toLowerCase() === 'overdue')
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    return {
      total,
      paid,
      overdue,
      overdueCount: rows.filter((inv) => inv.status.toLowerCase() === 'overdue').length,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Invoiced" value={formatCurrency(stats.total)} color="blue" />
        <StatCard label="Collected" value={formatCurrency(stats.paid)} color="emerald" />
        <StatCard
          label="Overdue Amount"
          value={formatCurrency(stats.overdue)}
          color="rose"
          subtext={`${stats.overdueCount} overdue`}
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-primary">Customer Invoices</h3>
            <p className="text-xs text-secondary mt-1">Receivable-linked invoices persisted in Finance.</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices..."
              className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-64 placeholder:text-muted"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Invoice</th>
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Client</th>
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Issue Date</th>
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due Date</th>
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-primary">{invoice.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm text-secondary">{invoice.receivable?.clientName || '-'}</td>
                  <td className="px-6 py-4 text-xs text-secondary">{formatDate(invoice.issueDate, 'short')}</td>
                  <td className="px-6 py-4 text-xs text-secondary">{formatDate(invoice.dueDate, 'short')}</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-300 tabular-nums">{formatCurrency(Number(invoice.totalAmount || 0))}</td>
                  <td className="px-6 py-4 text-xs text-secondary uppercase">{invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, subtext }: { label: string; value: string; color: 'blue' | 'emerald' | 'rose'; subtext?: string }) => (
  <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden">
    <div
      className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] ${
        color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'
      }`}
    />
    <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-end gap-3">
      <h3 className="text-2xl font-bold text-primary tabular-nums">{value}</h3>
      {subtext && <span className="text-[10px] text-rose-500 font-bold mb-1 uppercase tracking-tight">{subtext}</span>}
    </div>
  </div>
);

export default InvoicesPage;


