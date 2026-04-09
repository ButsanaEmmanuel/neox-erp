import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircle, RefreshCcw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ReconciliationSummary {
  lineCount?: number;
  discrepancyCount?: number;
  unmatchedReceipts?: number;
  unmatchedPayments?: number;
  matchedLines?: number;
}

interface Reconciliation {
  id: string;
  reconciliationCode: string;
  status: string;
  createdAt: string;
  summaryJson?: ReconciliationSummary;
}

interface ReconciliationLine {
  id: string;
  movementType: string;
  movementId: string;
  referenceCode?: string | null;
  expectedAmount?: number | null;
  actualAmount?: number | null;
  proofPresent: boolean;
  matchStatus: string;
  notes?: string | null;
  createdAt: string;
}

interface DiscrepancyCase {
  id: string;
  caseType: string;
  severity: string;
  status: string;
  title: string;
  description?: string | null;
  expectedAmount?: number | null;
  actualAmount?: number | null;
  createdAt: string;
}

const FinanceReconciliationPage: React.FC = () => {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unmatchedReceipts, setUnmatchedReceipts] = useState<ReconciliationLine[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<ReconciliationLine[]>([]);
  const [cases, setCases] = useState<DiscrepancyCase[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const rec = await apiRequest<{ reconciliations: Reconciliation[] }>('/api/v1/finance/reconciliations?take=20');
    const list = rec.reconciliations || [];
    setReconciliations(list);
    if (!activeId && list.length) setActiveId(list[0].id);
  };

  const loadDetail = async (id: string) => {
    const [r, p, c] = await Promise.all([
      apiRequest<{ lines: ReconciliationLine[] }>(`/api/v1/finance/reconciliations/${id}/unmatched-receipts`),
      apiRequest<{ lines: ReconciliationLine[] }>(`/api/v1/finance/reconciliations/${id}/unmatched-payments`),
      apiRequest<{ cases: DiscrepancyCase[] }>(`/api/v1/finance/reconciliations/${id}/discrepancies`),
    ]);
    setUnmatchedReceipts(r.lines || []);
    setUnmatchedPayments(p.lines || []);
    setCases(c.cases || []);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeId) void loadDetail(activeId);
  }, [activeId]);

  const runNow = async () => {
    setBusy(true);
    try {
      const result = await apiRequest<{ reconciliation: Reconciliation }>('/api/v1/finance/reconciliations/run', {
        method: 'POST',
        body: {
          actorDisplayName: 'Finance Controller',
        },
      });
      await load();
      setActiveId(result.reconciliation.id);
      await loadDetail(result.reconciliation.id);
    } finally {
      setBusy(false);
    }
  };

  const resolveCase = async (id: string) => {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/finance/discrepancies/${id}`, {
        method: 'PATCH',
        body: {
          status: 'resolved',
          resolutionNotes: 'Resolved by reconciliation panel.',
          actorDisplayName: 'Finance Controller',
        },
      });
      if (activeId) await loadDetail(activeId);
    } finally {
      setBusy(false);
    }
  };

  const active = useMemo(() => reconciliations.find((r) => r.id === activeId) || null, [reconciliations, activeId]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">Reconciliation Workspace</h3>
          <p className="text-xs text-secondary mt-1">Expected vs actual, proof vs amount, duplicate and missing-source controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={busy} onClick={() => void load()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 disabled:opacity-50"><RefreshCcw size={14} />Refresh</button>
          <button disabled={busy} onClick={() => void runNow()} className="h-9 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"><PlayCircle size={14} />Run Reconciliation</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-4 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Reconciliation Runs</div>
          <div className="max-h-[560px] overflow-y-auto">
            {reconciliations.map((row) => (
              <button key={row.id} onClick={() => setActiveId(row.id)} className={`w-full text-left px-5 py-4 border-b border-border/70 hover:bg-surface ${activeId === row.id ? 'bg-surface' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-primary font-semibold">{row.reconciliationCode}</p>
                  <span className="text-[10px] uppercase text-secondary">{row.status}</span>
                </div>
                <p className="text-xs text-muted mt-1">{formatDate(row.createdAt, 'short')}</p>
                <p className="text-xs text-emerald-300 mt-1">Lines: {row.summaryJson?.lineCount || 0} - Cases: {row.summaryJson?.discrepancyCount || 0}</p>
              </button>
            ))}
            {reconciliations.length === 0 && <div className="p-6 text-sm text-muted">No reconciliation run found.</div>}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-8 grid grid-cols-1 gap-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Unmatched Receipts Queue ({unmatchedReceipts.length})</div>
            <QueueTable rows={unmatchedReceipts} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Unmatched Payments Queue ({unmatchedPayments.length})</div>
            <QueueTable rows={unmatchedPayments} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Discrepancy Resolution Panel ({cases.length})</div>
            <div className="max-h-[280px] overflow-y-auto divide-y divide-white/[0.05]">
              {cases.map((dc) => (
                <div key={dc.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-primary font-semibold flex items-center gap-2"><ShieldAlert size={14} className="text-amber-400" />{dc.title}</p>
                      <p className="text-xs text-muted mt-1">{dc.caseType} - severity: {dc.severity} - status: {dc.status}</p>
                      <p className="text-xs text-muted mt-1">Expected: {formatCurrency(Number(dc.expectedAmount || 0))} | Actual: {formatCurrency(Number(dc.actualAmount || 0))}</p>
                    </div>
                    <button disabled={busy || dc.status === 'resolved'} onClick={() => void resolveCase(dc.id)} className="h-7 px-2.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1"><CheckCircle2 size={12} />Resolve</button>
                  </div>
                </div>
              ))}
              {cases.length === 0 && <div className="px-5 py-5 text-sm text-muted">No discrepancy case for this run.</div>}
            </div>
          </div>
        </div>
      </div>

      {active && (
        <div className="text-xs text-muted">Active run: {active.reconciliationCode} | matched: {active.summaryJson?.matchedLines || 0} | unmatched receipts: {active.summaryJson?.unmatchedReceipts || 0} | unmatched payments: {active.summaryJson?.unmatchedPayments || 0}</div>
      )}
    </div>
  );
};

const QueueTable = ({ rows }: { rows: ReconciliationLine[] }) => (
  <div className="max-h-[220px] overflow-y-auto">
    <table className="w-full text-left">
      <thead>
        <tr className="bg-surface/50 border-b border-border">
          <th className="px-4 py-2 text-[10px] uppercase text-muted">Reference</th>
          <th className="px-4 py-2 text-[10px] uppercase text-muted text-right">Expected</th>
          <th className="px-4 py-2 text-[10px] uppercase text-muted text-right">Actual</th>
          <th className="px-4 py-2 text-[10px] uppercase text-muted">Proof</th>
          <th className="px-4 py-2 text-[10px] uppercase text-muted">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-2 text-xs text-secondary">{row.referenceCode || row.movementId}</td>
            <td className="px-4 py-2 text-xs text-secondary text-right">{formatCurrency(Number(row.expectedAmount || 0))}</td>
            <td className="px-4 py-2 text-xs text-secondary text-right">{formatCurrency(Number(row.actualAmount || 0))}</td>
            <td className="px-4 py-2 text-xs text-secondary">{row.proofPresent ? 'Yes' : 'No'}</td>
            <td className="px-4 py-2 text-xs text-amber-300 uppercase">{row.matchStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 && <div className="px-4 py-4 text-sm text-muted">No unmatched movement.</div>}
  </div>
);

export default FinanceReconciliationPage;


