import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { PayableRecord } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';

type ThreeWayFilter = 'all' | 'pending' | 'complete';

interface PayablesResponse {
  payables: PayableRecord[];
}

function isScmPayable(item: PayableRecord): boolean {
  return Boolean(item.financeEntry?.sourceLinks?.some((l) => l.sourceModule === 'scm'));
}

function getThreeWay(item: PayableRecord) {
  const links = item.financeEntry?.sourceLinks || [];
  const hasPo = links.some((l) => l.sourceModule === 'scm' && l.sourceEntity === 'purchase_order');
  const hasBill = links.some((l) => l.sourceModule === 'scm' && l.sourceEntity === 'vendor_bill');
  const hasGrn = links.some((l) => l.sourceModule === 'scm' && (l.sourceEntity === 'goods_receipt' || l.sourceEntity === 'service_acceptance'));
  const complete = hasPo && hasBill && hasGrn;
  return { hasPo, hasBill, hasGrn, complete };
}

const FinanceScmObligationsPage: React.FC = () => {
  const { payables: contextPayables } = useFinance();
  const { user } = useAuth();

  const [payables, setPayables] = useState<PayableRecord[]>([]);
  const [search, setSearch] = useState('');
  const [threeWayFilter, setThreeWayFilter] = useState<ThreeWayFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPayables(contextPayables.filter(isScmPayable));
  }, [contextPayables]);

  const refresh = async () => {
    const data = await apiRequest<PayablesResponse>('/api/v1/finance/payables?take=200');
    setPayables((data.payables || []).filter(isScmPayable));
  };

  const rows = useMemo(() => {
    return payables.filter((item) => {
      const haystack = `${item.referenceCode} ${item.vendorName || ''} ${item.financeEntry?.title || ''}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const threeWay = getThreeWay(item);
      const matchesThreeWay = threeWayFilter === 'all' ? true : threeWayFilter === 'complete' ? threeWay.complete : !threeWay.complete;
      return matchesSearch && matchesThreeWay;
    });
  }, [payables, search, threeWayFilter]);

  const metrics = useMemo(() => {
    const total = rows.length;
    const complete = rows.filter((r) => getThreeWay(r).complete).length;
    const pending = total - complete;
    const blockedApproval = rows.filter((r) => r.financeEntry?.evidenceStatus === 'required_missing').length;
    return { total, complete, pending, blockedApproval };
  }, [rows]);

  const approve = async (item: PayableRecord) => {
    setBusyId(item.id);
    setError(null);
    try {
      await apiRequest(`/api/v1/finance/entries/${item.financeEntryId}/approve`, {
        method: 'PATCH',
        body: {
          notes: 'Approved from SCM obligations board',
          actorUserId: user?.id,
          actorDisplayName: user?.name,
        },
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve payable.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="SCM Payables" value={String(metrics.total)} tone="info" />
        <Kpi label="3-Way Complete" value={String(metrics.complete)} tone="success" />
        <Kpi label="3-Way Pending" value={String(metrics.pending)} tone="warning" />
        <Kpi label="Blocked by Evidence" value={String(metrics.blockedApproval)} tone="danger" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-primary">SCM Obligations</h3>
            <p className="text-xs text-secondary mt-1">Finance-observed supplier obligations with three-way support path (PO/Bill/GRN).</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SCM payables..."
                className="bg-surface border border-border rounded-lg h-9 pl-9 pr-4 text-[13px] text-primary focus:outline-none focus:border-blue-500/50 w-64 placeholder:text-muted"
              />
            </div>
            <div className="flex bg-surface border border-border rounded-lg p-0.5">
              {(['all', 'pending', 'complete'] as ThreeWayFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setThreeWayFilter(f)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md ${threeWayFilter === f ? 'bg-[#1e293b] text-blue-300 border border-border/80' : 'text-secondary hover:text-primary'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="px-6 py-3 text-xs text-rose-400 border-b border-border">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Reference</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Vendor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Outstanding</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Three-Way</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Approval</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Evidence</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Due</th>
                <th className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((item) => {
                const threeWay = getThreeWay(item);
                const canApprove = item.financeEntry?.approvalStatus !== 'approved';
                return (
                  <tr key={item.id} className="hover:bg-surface">
                    <td className="px-4 py-3 text-sm font-semibold text-primary">{item.referenceCode}</td>
                    <td className="px-4 py-3 text-sm text-secondary">{item.vendorName || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-primary tabular-nums">{formatCurrency(Number(item.outstandingAmount || 0))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                        <span className={threeWay.hasPo ? 'text-emerald-400' : 'text-muted'}>PO</span>
                        <span className={threeWay.hasBill ? 'text-emerald-400' : 'text-muted'}>Bill</span>
                        <span className={threeWay.hasGrn ? 'text-emerald-400' : 'text-muted'}>GRN</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full border ${threeWay.complete ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {threeWay.complete ? 'Complete' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-primary uppercase">{item.financeEntry?.approvalStatus || '-'}</td>
                    <td className="px-4 py-3 text-xs text-primary uppercase">{item.financeEntry?.evidenceStatus || '-'}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{item.dueDate ? formatDate(item.dueDate, 'short') : '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!canApprove || busyId === item.id}
                        onClick={() => void approve(item)}
                        className="h-8 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!canApprove ? 'Already approved' : 'Approve payable'}
                      >
                        {busyId === item.id ? 'Approving...' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="p-10 text-center text-muted text-sm flex flex-col items-center gap-2">
            <AlertTriangle size={20} className="opacity-60" />
            No SCM obligations found for the current filters.
          </div>
        )}
      </div>

      <div className="text-xs text-secondary flex items-center gap-2">
        <ShieldCheck size={14} className="text-emerald-400" />
        Outgoing supplier settlement remains blocked by backend when required documents are missing.
      </div>
    </div>
  );
};

const Kpi = ({ label, value, tone }: { label: string; value: string; tone: 'info' | 'success' | 'warning' | 'danger' }) => {
  const toneClass = tone === 'success'
    ? 'border-emerald-500/20 text-emerald-300'
    : tone === 'warning'
      ? 'border-amber-500/20 text-amber-300'
      : tone === 'danger'
        ? 'border-rose-500/20 text-rose-300'
        : 'border-blue-500/20 text-blue-300';

  return (
    <div className={`bg-card border rounded-xl p-4 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{value}</p>
    </div>
  );
};

export default FinanceScmObligationsPage;


