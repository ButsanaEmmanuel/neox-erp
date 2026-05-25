// F2.6 — Contextual ActionBar for a payroll run detail.
// Renders StateBadge + Post button (only when postingStatus allows it).
// Triggers the confirm dialog via onRequestConfirm (state owned by Dashboard).

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import type { PayrollRun } from '../../../types/payroll';

const RUN_STATE_LABELS: Record<string, { label: string; cls: string }> = {
  pending_validation: { label: 'Pending validation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  auto_posting: { label: 'Auto-posting', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  posted: { label: 'Posted', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
};

const StateBadge: React.FC<{ value: string }> = ({ value }) => {
  const entry = RUN_STATE_LABELS[value] || { label: value, cls: 'bg-surface text-muted border-border' };
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
  runDetail: PayrollRun;
  busy: boolean;
  canExecutePayroll: boolean;
  onRequestConfirm: (req: ConfirmRequest) => void;
  onPostRun: () => void;
}

const PayrollRunActionBar: React.FC<Props> = ({ runDetail, busy, canExecutePayroll, onRequestConfirm, onPostRun }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <StateBadge value={runDetail.postingStatus} />
    {runDetail.postingStatus === 'pending_validation' && (
      <button
        disabled={busy || !canExecutePayroll}
        title={!canExecutePayroll ? 'Permission requise : hrm.payroll.execute' : 'Valide le run et le poste vers Finance — irréversible'}
        onClick={() => onRequestConfirm({
          title: 'Poster le payroll run',
          description: `Valider et poster ${runDetail.runCode} ? ${runDetail.includedEmployees} employé(s), total ${formatCurrency(Number(runDetail.totalGrossPay || 0))}. Cette action crée les FinanceEntries et est irréversible.`,
          confirmLabel: 'Poster',
          onConfirm: onPostRun,
        })}
        className="h-8 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
      >
        <ShieldCheck size={13} /> Post run
      </button>
    )}
  </div>
);

export default PayrollRunActionBar;
