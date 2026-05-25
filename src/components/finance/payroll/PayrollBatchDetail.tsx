// F2.6 — Bottom grid: batches list (left) + batch detail (right). Batch
// detail has its own StateBadge + contextual ActionBar (Disburse all /
// Reconcile) + lines table with per-line Payout + selected line panel.

import React from 'react';
import { CheckCircle2, Landmark } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { PayrollBatch, PayrollLine } from '../../../types/payroll';

const BATCH_STATE_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-surface text-muted border-border' },
  approved: { label: 'Approved', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  reconciled: { label: 'Reconciled', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
};

const StateBadge: React.FC<{ value: string }> = ({ value }) => {
  const entry = BATCH_STATE_LABELS[value] || { label: value, cls: 'bg-surface text-muted border-border' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${entry.cls}`}>
      {entry.label}
    </span>
  );
};

interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

interface Props {
  batches: PayrollBatch[];
  selectedBatch: PayrollBatch | null;
  selectedBatchId: string | null;
  selectedLine: PayrollLine | null;
  selectedLineId: string | null;
  loading: boolean;
  busy: boolean;
  canExecutePayroll: boolean;
  onSelectBatch: (batchId: string) => void;
  onSelectLine: (lineId: string) => void;
  onDisburseLine: (lineId: string) => void;
  onDisburseAllPending: (batch: PayrollBatch) => void;
  onReconcileBatch: (batchId: string) => void;
  onRequestConfirm: (req: ConfirmRequest) => void;
}

const PayrollBatchDetail: React.FC<Props> = ({
  batches, selectedBatch, selectedBatchId, selectedLine, selectedLineId,
  loading, busy, canExecutePayroll,
  onSelectBatch, onSelectLine, onDisburseLine, onDisburseAllPending, onReconcileBatch, onRequestConfirm,
}) => (
  <div className="grid grid-cols-12 gap-6">
    <div className="col-span-12 xl:col-span-5 bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Payroll Batches</div>
      <div className="max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="p-5 text-sm text-secondary">Loading...</div>
        ) : batches.map((batch) => (
          <button
            key={batch.id}
            onClick={() => onSelectBatch(batch.id)}
            className={`w-full text-left px-5 py-4 border-b border-border/70 hover:bg-surface ${selectedBatchId === batch.id ? 'bg-surface' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-primary">{batch.batchCode}</p>
              <span className="text-[10px] uppercase text-secondary">{batch.status}</span>
            </div>
            <p className="text-xs text-secondary mt-1">{formatDate(batch.periodStart, 'short')} - {formatDate(batch.periodEnd, 'short')}</p>
            <p className="text-xs text-emerald-300 mt-1">{formatCurrency(Number(batch.totalAmount || 0))} - {batch.lines?.length || 0} lines</p>
          </button>
        ))}
        {!loading && batches.length === 0 && <div className="p-6 text-sm text-muted">No payroll batches yet.</div>}
      </div>
    </div>

    <div className="col-span-12 xl:col-span-7 bg-card border border-border rounded-xl overflow-hidden">
      {!selectedBatch ? (
        <div className="p-6 text-sm text-muted">Select a payroll batch.</div>
      ) : (
        <>
          {(() => {
            const pendingLines = selectedBatch.lines.filter((l) => l.status !== 'paid' && l.status !== 'reconciled');
            const pendingCount = pendingLines.length;
            const pendingTotal = pendingLines.reduce((sum, l) => sum + Number(l.totalAmount || 0), 0);
            const allDisbursed = pendingCount === 0 && selectedBatch.lines.length > 0;
            const canDisburse = canExecutePayroll && pendingCount > 0 && selectedBatch.status !== 'reconciled';
            const canReconcile = canExecutePayroll && allDisbursed && selectedBatch.status !== 'reconciled';
            return (
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-primary">{selectedBatch.batchCode}</p>
                  <StateBadge value={selectedBatch.status} />
                </div>
                <div className="flex items-center gap-2">
                  {canDisburse && (
                    <button
                      disabled={busy}
                      title={`Paie groupée des ${pendingCount} ligne(s) restante(s)`}
                      onClick={() => onRequestConfirm({
                        title: 'Disburse all pending lines',
                        description: `Régler ${pendingCount} ligne${pendingCount > 1 ? 's' : ''} en attente pour un total de ${formatCurrency(pendingTotal)} ? Chaque ligne déclenche un PaymentDisbursement séparé.`,
                        confirmLabel: 'Disburse',
                        onConfirm: () => onDisburseAllPending(selectedBatch),
                      })}
                      className="h-8 px-3 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Landmark size={13} /> Disburse all pending ({pendingCount})
                    </button>
                  )}
                  {canReconcile && (
                    <button
                      disabled={busy}
                      title="Toutes les lignes sont payées — la batch peut être réconciliée"
                      onClick={() => onRequestConfirm({
                        title: 'Reconcile batch',
                        description: `Réconcilier la batch ${selectedBatch.batchCode} ? ${selectedBatch.lines.length} ligne(s), total ${formatCurrency(Number(selectedBatch.totalAmount || 0))}. La batch passera en statut "reconciled".`,
                        confirmLabel: 'Reconcile',
                        onConfirm: () => onReconcileBatch(selectedBatch.id),
                      })}
                      className="h-8 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={13} /> Reconcile batch
                    </button>
                  )}
                  {!canExecutePayroll && (
                    <span title="Permission requise : hrm.payroll.execute" className="text-[10px] text-muted italic">hrm.payroll.execute requis</span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="max-h-[280px] overflow-y-auto border-b border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface/50 border-b border-border">
                  <th className="px-4 py-2 text-[10px] uppercase text-muted">Employee</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-muted text-right">Amount</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-muted">Status</th>
                  <th className="px-4 py-2 text-[10px] uppercase text-muted">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {selectedBatch.lines.map((line) => (
                  <tr key={line.id} className={`hover:bg-surface ${selectedLineId === line.id ? 'bg-surface' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => onSelectLine(line.id)} className="text-left">
                        <p className="text-sm font-medium text-primary">{line.employeeName}</p>
                        <p className="text-xs text-muted">{line.employeeCode || '-'}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-300">{formatCurrency(Number(line.totalAmount || 0))}</td>
                    <td className="px-4 py-3 text-xs text-secondary uppercase">{line.status}</td>
                    <td className="px-4 py-3">
                      <button
                        disabled={busy || !canExecutePayroll || line.status === 'paid' || line.status === 'reconciled'}
                        title={
                          line.status === 'paid' || line.status === 'reconciled' ? 'Déjà disbursée'
                            : !canExecutePayroll ? 'Permission requise : hrm.payroll.execute'
                            : 'Disbursement unique pour cette ligne'
                        }
                        onClick={() => onDisburseLine(line.id)}
                        className="h-7 px-2.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1"
                      >
                        <Landmark size={12} /> Payout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4">
            {!selectedLine ? (
              <p className="text-sm text-muted">Select a line for payout details and proof documents.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">Payout Detail - {selectedLine.employeeName}</p>
                  <span className="text-xs text-secondary">{selectedLine.status}</span>
                </div>
                <div className="rounded-lg border border-border/80 bg-surface p-3">
                  <p className="text-xs text-secondary">Finance Entry Ref</p>
                  <p className="text-sm text-primary mt-1">{selectedLine.payable?.financeEntry?.referenceCode || '-'}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-surface p-3">
                  <p className="text-xs text-secondary mb-2">Proof / Evidence</p>
                  {(selectedLine.payable?.financeEntry?.evidenceDocuments || []).length === 0 ? (
                    <p className="text-xs text-muted">No proof document attached.</p>
                  ) : (
                    (selectedLine.payable?.financeEntry?.evidenceDocuments || []).map((doc) => (
                      <div key={doc.id} className="text-xs text-secondary flex items-center justify-between py-1 border-b last:border-b-0 border-border/70">
                        <span>{doc.documentType}</span>
                        <span className="text-muted">{doc.originalFileName}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-lg border border-border/80 bg-surface p-3">
                  <p className="text-xs text-secondary mb-2">Payout Records</p>
                  {(selectedLine.payable?.payments || []).length === 0 ? (
                    <p className="text-xs text-muted">No payout recorded.</p>
                  ) : (
                    (selectedLine.payable?.payments || []).map((p) => (
                      <div key={p.id} className="text-xs text-secondary flex items-center justify-between py-1 border-b last:border-b-0 border-border/70">
                        <span>{p.paymentReference}</span>
                        <span className="text-muted">{formatDate(p.paymentDate, 'short')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  </div>
);

export default PayrollBatchDetail;
