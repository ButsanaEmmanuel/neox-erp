// F2.6 — Compact runs list with selection. Header + scrollable button rows.
// Renders nothing else; the selected run's detail lives in PayrollRunDetail.

import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { PayrollRun } from '../../../types/payroll';

interface Props {
  runs: PayrollRun[];
  selectedRunId: string | null;
  loading: boolean;
  onSelectRun: (runId: string) => void;
}

const PayrollRunsList: React.FC<Props> = ({ runs, selectedRunId, loading, onSelectRun }) => (
  <>
    <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Payroll Runs</div>
    <div className="max-h-[260px] overflow-y-auto border-b border-border/70">
      {loading ? (
        <div className="p-5 text-sm text-secondary">Loading runs...</div>
      ) : runs.map((run) => (
        <button
          key={run.id}
          onClick={() => onSelectRun(run.id)}
          className={`w-full text-left px-5 py-3 border-b border-border/60 hover:bg-surface ${selectedRunId === run.id ? 'bg-surface' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary">{run.runCode}</p>
            <span className="text-[10px] uppercase text-secondary">{run.status} / {run.postingStatus}</span>
          </div>
          <p className="text-xs text-secondary mt-1">
            {formatDate(run.startedAt, 'short')} • Included {run.includedEmployees}/{run.totalEmployees} • Gross {formatCurrency(Number(run.totalGrossPay || 0))}
          </p>
        </button>
      ))}
      {!loading && runs.length === 0 && <div className="p-5 text-sm text-muted">No payroll runs yet.</div>}
    </div>
  </>
);

export default PayrollRunsList;
