import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircle, RefreshCcw, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  listReconciliations,
  listUnmatchedReceipts,
  listUnmatchedPayments,
  listDiscrepancies,
  runReconciliation,
  resolveDiscrepancy,
  type Reconciliation,
  type ReconciliationLine,
  type DiscrepancyCase,
} from '../services/finance/reconciliationApi';
import { formatCurrency, formatDate } from '../utils/formatters';

interface FinanceReconciliationPageProps {
  // Drill-through: open the underlying payment/receipt in its own finance view.
  onNavigate?: (view: string) => void;
}

const FinanceReconciliationPage: React.FC<FinanceReconciliationPageProps> = ({ onNavigate }) => {
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unmatchedReceipts, setUnmatchedReceipts] = useState<ReconciliationLine[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<ReconciliationLine[]>([]);
  const [cases, setCases] = useState<DiscrepancyCase[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describeError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission denied|status 403/i.test(message)) {
      return "Permission refusée : votre compte n'a pas le droit finance.reconciliation. Reconnectez-vous ou demandez l'accès.";
    }
    return message || 'Une erreur est survenue.';
  };

  const load = async () => {
    const list = await listReconciliations(20);
    setReconciliations(list);
    if (!activeId && list.length) setActiveId(list[0].id);
  };

  const loadDetail = async (id: string) => {
    const [r, p, c] = await Promise.all([
      listUnmatchedReceipts(id),
      listUnmatchedPayments(id),
      listDiscrepancies(id),
    ]);
    setUnmatchedReceipts(r);
    setUnmatchedPayments(p);
    setCases(c);
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await load();
      // Reload the queues of the currently selected run too — otherwise
      // Refresh only updates the left-hand list and the panels look frozen.
      if (activeId) await loadDetail(activeId);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (activeId) void loadDetail(activeId).catch((err) => setError(describeError(err)));
  }, [activeId]);

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const reconciliation = await runReconciliation();
      await load();
      setActiveId(reconciliation.id);
      await loadDetail(reconciliation.id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const resolveCase = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await resolveDiscrepancy(id, 'Resolved by reconciliation panel.');
      if (activeId) await loadDetail(activeId);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // Drill-through: open the source payment/receipt in its module so the user
  // can fix the root cause (e.g. attach the missing proof).
  const openMovement = (row: ReconciliationLine) => {
    if (!onNavigate || !row.movementId) return;
    const view = row.movementType === 'receipt'
      ? `finance-receipts-detail-${row.movementId}`
      : `finance-payments-detail-${row.movementId}`;
    onNavigate(view);
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
          <button disabled={busy} onClick={() => void refresh()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 disabled:opacity-50"><RefreshCcw size={14} />Refresh</button>
          <button disabled={busy} onClick={() => void runNow()} className="h-9 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"><PlayCircle size={14} />Run Reconciliation</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 flex items-start gap-2 text-xs text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
            <QueueTable rows={unmatchedReceipts} onRowClick={onNavigate ? openMovement : undefined} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Unmatched Payments Queue ({unmatchedPayments.length})</div>
            <QueueTable rows={unmatchedPayments} onRowClick={onNavigate ? openMovement : undefined} />
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

const QueueTable = ({ rows, onRowClick }: { rows: ReconciliationLine[]; onRowClick?: (row: ReconciliationLine) => void }) => (
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
          <tr
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            title={onRowClick ? "Ouvrir l'enregistrement source pour corriger" : undefined}
            className={onRowClick ? 'cursor-pointer hover:bg-surface transition-colors' : undefined}
          >
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


