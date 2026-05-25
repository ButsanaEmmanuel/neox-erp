// F2.6 — Left column of the top grid: schedule form + Run buttons + Run due
// + all-schedules list with toggle + salary profiles list. Owned by the
// Dashboard which passes form state, schedules, salary profiles, and
// callbacks. No data fetching here.

import React from 'react';
import { CalendarClock, PlayCircle, Zap, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { PayrollSchedule, SalaryProfile } from '../../../types/payroll';

interface Props {
  schedules: PayrollSchedule[];
  salaryProfiles: SalaryProfile[];
  scheduleName: string;
  executionRule: 'day_of_month' | 'last_working_day';
  dayOfMonth: string;
  validationMode: 'review_before_posting' | 'automatic_posting';
  busy: boolean;
  runDueBusy: boolean;
  togglingScheduleId: string | null;
  canWritePayroll: boolean;
  canExecutePayroll: boolean;
  onChangeScheduleName: (v: string) => void;
  onChangeExecutionRule: (v: 'day_of_month' | 'last_working_day') => void;
  onChangeDayOfMonth: (v: string) => void;
  onChangeValidationMode: (v: 'review_before_posting' | 'automatic_posting') => void;
  onSaveSchedule: () => void;
  onExecuteRun: () => void;
  onRunDueNow: () => void;
  onToggleScheduleActive: (schedule: PayrollSchedule) => void;
  onOpenSalaryModal: (profile?: SalaryProfile) => void;
}

const PayrollSchedulesPanel: React.FC<Props> = ({
  schedules, salaryProfiles, scheduleName, executionRule, dayOfMonth, validationMode,
  busy, runDueBusy, togglingScheduleId, canWritePayroll, canExecutePayroll,
  onChangeScheduleName, onChangeExecutionRule, onChangeDayOfMonth, onChangeValidationMode,
  onSaveSchedule, onExecuteRun, onRunDueNow, onToggleScheduleActive, onOpenSalaryModal,
}) => (
  <div className="col-span-12 xl:col-span-4 bg-card border border-border rounded-xl p-5 space-y-4">
    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
      <CalendarClock size={16} /> Payroll Schedule
    </div>

    <div className="space-y-2">
      <label className="text-xs text-secondary">Name</label>
      <input value={scheduleName} onChange={(e) => onChangeScheduleName(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary" />
    </div>
    <div className="space-y-2">
      <label className="text-xs text-secondary">Execution Rule</label>
      <select value={executionRule} onChange={(e) => onChangeExecutionRule(e.target.value as 'day_of_month' | 'last_working_day')} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary">
        <option value="day_of_month">Day of month</option>
        <option value="last_working_day">Last working day</option>
      </select>
    </div>
    {executionRule === 'day_of_month' && (
      <div className="space-y-2">
        <label className="text-xs text-secondary">Day of month</label>
        <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => onChangeDayOfMonth(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary" />
      </div>
    )}
    <div className="space-y-2">
      <label className="text-xs text-secondary">Validation Mode</label>
      <select value={validationMode} onChange={(e) => onChangeValidationMode(e.target.value as 'review_before_posting' | 'automatic_posting')} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary">
        <option value="review_before_posting">Review before posting</option>
        <option value="automatic_posting">Automatic posting</option>
      </select>
    </div>

    <div className="text-xs text-secondary space-y-1">
      <p>Next run: {schedules[0]?.nextRunAt ? formatDate(schedules[0].nextRunAt, 'short') : '-'}</p>
      <p>Last run: {schedules[0]?.lastRunAt ? formatDate(schedules[0].lastRunAt, 'short') : '-'}</p>
      <p>Last status: {schedules[0]?.lastRunStatus || '-'}</p>
    </div>

    <div className="flex gap-2 flex-wrap">
      <button disabled={busy || !canWritePayroll} onClick={onSaveSchedule} className="h-9 px-3 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold disabled:opacity-50">Save schedule</button>
      <button disabled={busy || !canExecutePayroll} onClick={onExecuteRun} className="h-9 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><PlayCircle size={13} /> Run now</button>
      {canExecutePayroll && (
        <button
          disabled={runDueBusy || busy}
          onClick={onRunDueNow}
          title="Exécute tous les schedules dont nextRunAt est passé"
          className="h-9 px-3 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Zap size={13} /> {runDueBusy ? 'Running…' : 'Run due now'}
        </button>
      )}
    </div>

    {schedules.length > 0 && (
      <div className="pt-3 border-t border-border/70 space-y-1.5">
        <p className="text-xs font-semibold text-primary">All schedules</p>
        {schedules.map((s) => {
          const active = s.isActive ?? true;
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[11px] py-1">
              <div className="min-w-0 flex-1">
                <p className="text-secondary truncate">{s.name || s.code}</p>
                <p className="text-muted">{s.executionRule}{s.dayOfMonth ? ` (day ${s.dayOfMonth})` : ''}</p>
              </div>
              <button
                disabled={!canWritePayroll || togglingScheduleId === s.id}
                onClick={() => onToggleScheduleActive(s)}
                title={canWritePayroll ? (active ? 'Désactiver' : 'Activer') : 'hrm.payroll.write requis'}
                className={`h-6 px-2 rounded text-[10px] font-semibold border disabled:opacity-50 transition-colors ${
                  active ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-surface border-border text-muted'
                }`}
              >
                {togglingScheduleId === s.id ? '…' : active ? 'Active' : 'Inactive'}
              </button>
            </div>
          );
        })}
      </div>
    )}

    <div className="pt-3 border-t border-border/70 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-primary">Salary Profiles</p>
        {canWritePayroll && (
          <button onClick={() => onOpenSalaryModal()} className="h-7 px-2 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold flex items-center gap-1">
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto rounded border border-border/70 p-2 space-y-1">
        {salaryProfiles.map((sp) => (
          <button
            key={sp.id}
            onClick={() => canWritePayroll && onOpenSalaryModal(sp)}
            disabled={!canWritePayroll}
            className="w-full text-left text-[11px] text-secondary hover:text-primary hover:bg-surface px-1 py-0.5 rounded disabled:cursor-default disabled:hover:text-secondary disabled:hover:bg-transparent"
          >
            {(sp.user?.name || sp.user?.email || sp.userId)} — {formatCurrency(Number(sp.monthlyBaseSalary || 0))} / OT ×{Number(sp.overtimeMultiplier || 1.5)}
          </button>
        ))}
        {salaryProfiles.length === 0 && <div className="text-[11px] text-muted">No salary profile found.</div>}
      </div>
    </div>
  </div>
);

export default PayrollSchedulesPanel;
