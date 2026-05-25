// F2.6 — Run detail body. Stats grid + ActionBar + manual override panel
// + 6 tabs (employees / calculations / adjustments / logs / timesheets /
// notifications). Tabs state is local — selection doesn't refetch.

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { PayrollRun, PayrollRunEmployee } from '../../../types/payroll';
import PayrollRunActionBar from './PayrollRunActionBar';

type RunDetailTab = 'employees' | 'calculations' | 'adjustments' | 'logs' | 'timesheets' | 'notifications';

interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

interface Props {
  runDetail: PayrollRun | null;
  busy: boolean;
  canExecutePayroll: boolean;
  selectedRunEmployee: PayrollRunEmployee | null;
  adjustAmount: string;
  adjustReason: string;
  onChangeAdjustAmount: (v: string) => void;
  onChangeAdjustReason: (v: string) => void;
  onApplyAdjustment: () => void;
  onPostRun: () => void;
  onRequestConfirm: (req: ConfirmRequest) => void;
}

const PayrollRunDetail: React.FC<Props> = ({
  runDetail, busy, canExecutePayroll, selectedRunEmployee,
  adjustAmount, adjustReason, onChangeAdjustAmount, onChangeAdjustReason, onApplyAdjustment,
  onPostRun, onRequestConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<RunDetailTab>('employees');

  if (!runDetail) {
    return <div className="p-5 text-sm text-muted">Select a payroll run to inspect details, anomalies, and posting state.</div>;
  }

  const empLookup = (id: string) =>
    runDetail.employees?.find((e) => e.id === id)?.userId.slice(-8).toUpperCase() ?? id.slice(-8);

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Regular pay</p><p className="text-sm text-primary font-semibold">{formatCurrency(Number(runDetail.totalRegularPay || 0))}</p></div>
        <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Overtime pay</p><p className="text-sm text-primary font-semibold">{formatCurrency(Number(runDetail.totalOvertimePay || 0))}</p></div>
        <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Warnings</p><p className="text-sm text-amber-300 font-semibold">{runDetail.warningCount}</p></div>
        <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Errors</p><p className="text-sm text-rose-300 font-semibold">{runDetail.errorCount}</p></div>
      </div>

      <PayrollRunActionBar
        runDetail={runDetail}
        busy={busy}
        canExecutePayroll={canExecutePayroll}
        onRequestConfirm={onRequestConfirm}
        onPostRun={onPostRun}
      />

      {selectedRunEmployee && (
        <div className="rounded-lg border border-border/80 bg-surface p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Manual override (before posting)</p>
          <p className="text-xs text-secondary">Employee line: {selectedRunEmployee.userId.slice(-8).toUpperCase()} • Current {formatCurrency(Number(selectedRunEmployee.adjustedGrossPay ?? selectedRunEmployee.grossPay ?? 0))}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="number" step="0.01" value={adjustAmount} onChange={(e) => onChangeAdjustAmount(e.target.value)} placeholder="Adjusted amount" className="h-8 px-2 rounded border border-input bg-app text-xs text-primary" />
            <input value={adjustReason} onChange={(e) => onChangeAdjustReason(e.target.value)} placeholder="Reason (required)" className="h-8 px-2 rounded border border-input bg-app text-xs text-primary" />
            <button disabled={busy || !adjustAmount || !adjustReason} onClick={onApplyAdjustment} className="h-8 px-3 rounded bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-semibold disabled:opacity-50">Apply adjustment</button>
          </div>
        </div>
      )}

      <div className="border-b border-border/70 flex gap-1 overflow-x-auto -mx-5 px-5">
        {([
          ['employees', `Employees (${runDetail.employees?.length || 0})`],
          ['calculations', `Calculations (${runDetail.calculations?.length || 0})`],
          ['adjustments', `Adjustments (${runDetail.adjustments?.length || 0})`],
          ['logs', `Logs (${runDetail.logs?.length || 0})`],
          ['timesheets', `Timesheets (${runDetail.timesheetLinks?.length || 0})`],
          ['notifications', `Notifications (${runDetail.notifications?.length || 0})`],
        ] as Array<[RunDetailTab, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-2 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key ? 'border-blue-400 text-primary' : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/60">
          {(runDetail.employees || []).map((emp) => (
            <div key={emp.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-primary font-medium truncate">{emp.userId.slice(-8).toUpperCase()}</p>
                <p className="text-muted">{emp.inclusionStatus}{emp.exclusionReason ? ` — ${emp.exclusionReason}` : ''}</p>
              </div>
              <p className="text-secondary tabular-nums whitespace-nowrap">{formatCurrency(Number(emp.adjustedGrossPay ?? emp.grossPay ?? 0))}</p>
            </div>
          ))}
          {(runDetail.employees || []).length === 0 && <div className="px-3 py-4 text-xs text-muted text-center">No employees on this run.</div>}
        </div>
      )}

      {activeTab === 'calculations' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70">
          <table className="w-full text-[11px]">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Employee</th>
                <th className="text-left px-3 py-2 font-semibold">Rule</th>
                <th className="text-left px-3 py-2 font-semibold">Description</th>
                <th className="text-right px-3 py-2 font-semibold">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(runDetail.calculations || []).map((c) => {
                const out = c.outputJson && typeof c.outputJson === 'object' ? JSON.stringify(c.outputJson) : '-';
                return (
                  <tr key={c.id} className="text-secondary">
                    <td className="px-3 py-1.5 text-primary">{empLookup(c.payrollRunEmployeeId)}</td>
                    <td className="px-3 py-1.5 font-mono">{c.ruleCode}</td>
                    <td className="px-3 py-1.5">{c.ruleDescription || '-'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted truncate max-w-[200px]">{out}</td>
                  </tr>
                );
              })}
              {(runDetail.calculations || []).length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">No calculation details for this run.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'adjustments' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70">
          <table className="w-full text-[11px]">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Employee</th>
                <th className="text-right px-3 py-2 font-semibold">Original</th>
                <th className="text-right px-3 py-2 font-semibold">Adjusted</th>
                <th className="text-left px-3 py-2 font-semibold">Reason</th>
                <th className="text-left px-3 py-2 font-semibold">By</th>
                <th className="text-left px-3 py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(runDetail.adjustments || []).map((a) => (
                <tr key={a.id} className="text-secondary">
                  <td className="px-3 py-1.5 text-primary">{empLookup(a.payrollRunEmployeeId)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(Number(a.originalAmount))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-300">{formatCurrency(Number(a.adjustedAmount))}</td>
                  <td className="px-3 py-1.5">{a.reason}</td>
                  <td className="px-3 py-1.5 text-muted">{a.adjustedByName || '-'}</td>
                  <td className="px-3 py-1.5 text-muted">{formatDate(a.createdAt, 'short')}</td>
                </tr>
              ))}
              {(runDetail.adjustments || []).length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted">No adjustments on this run.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/60">
          {(runDetail.logs || []).map((log) => (
            <div key={log.id} className="px-3 py-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-mono text-[10px] uppercase ${log.level === 'error' ? 'text-rose-300' : log.level === 'warning' ? 'text-amber-300' : 'text-secondary'}`}>{log.actionType}</span>
                <span className="text-muted text-[10px]">{formatDate(log.createdAt, 'short')}</span>
              </div>
              <p className="text-secondary mt-0.5">{log.message}</p>
              {log.actorDisplayName && <p className="text-muted text-[10px] mt-0.5">by {log.actorDisplayName}</p>}
            </div>
          ))}
          {(runDetail.logs || []).length === 0 && <div className="px-3 py-4 text-xs text-muted text-center">No logs yet.</div>}
        </div>
      )}

      {activeTab === 'timesheets' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70">
          <table className="w-full text-[11px]">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Employee</th>
                <th className="text-left px-3 py-2 font-semibold">Date</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-right px-3 py-2 font-semibold">Hours</th>
                <th className="text-left px-3 py-2 font-semibold">Entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(runDetail.timesheetLinks || []).map((tl) => (
                <tr key={tl.id} className="text-secondary">
                  <td className="px-3 py-1.5 text-primary">{empLookup(tl.payrollRunEmployeeId)}</td>
                  <td className="px-3 py-1.5">{formatDate(tl.workedDate, 'short')}</td>
                  <td className="px-3 py-1.5">{tl.weekdayType}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{Number(tl.hours).toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-muted">{tl.timesheetEntryId.slice(-8)}</td>
                </tr>
              ))}
              {(runDetail.timesheetLinks || []).length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No timesheets linked.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/70 divide-y divide-border/60">
          {(runDetail.notifications || []).map((n) => (
            <div key={n.id} className="px-3 py-2 text-xs flex items-start gap-2">
              {n.severity === 'warning' ? <AlertTriangle size={12} className="text-amber-300 mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={12} className="text-emerald-300 mt-0.5 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-primary font-medium">{n.title}</p>
                <p className="text-secondary">{n.message}</p>
                <p className="text-muted text-[10px] mt-0.5">{formatDate(n.createdAt, 'short')}</p>
              </div>
            </div>
          ))}
          {(runDetail.notifications || []).length === 0 && <div className="px-3 py-4 text-xs text-muted text-center">No notifications.</div>}
        </div>
      )}
    </div>
  );
};

export default PayrollRunDetail;
