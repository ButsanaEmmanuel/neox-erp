import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, Landmark, PlayCircle, RefreshCcw, CalendarClock, AlertTriangle, ShieldCheck, Zap, Plus } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../lib/rbac';
import { useToast } from './ui/Toast';
import Modal from './ui/Modal';
import type {
  PayrollBatch,
  PayrollRun,
  PayrollSchedule,
  SalaryProfile,
} from '../types/payroll';
import {
  listPayrollSchedules,
  listPayrollRuns,
  listPayrollBatches,
  listSalaryProfiles,
  getPayrollRunDetail as fetchPayrollRunDetail,
  getPayrollBatchDetail as fetchPayrollBatchDetail,
  upsertPayrollSchedule,
  upsertSalaryProfile,
  executePayrollRun as execPayrollRun,
  postPayrollRun as postRunRequest,
  adjustPayrollRunEmployee as adjustRunEmployee,
  approvePayrollBatch as approveBatchRequest,
  reconcilePayrollBatch as reconcileBatchRequest,
  disbursePayrollLine as disburseLineRequest,
  runDuePayrollSchedules,
} from '../services/finance/payrollEngineApi';

const FinancePayrollPage: React.FC = () => {
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<PayrollSchedule[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<PayrollRun | null>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);

  const [scheduleName, setScheduleName] = useState('Default Monthly Payroll');
  const [executionRule, setExecutionRule] = useState<'day_of_month' | 'last_working_day'>('day_of_month');
  const [dayOfMonth, setDayOfMonth] = useState('25');
  const [validationMode, setValidationMode] = useState<'review_before_posting' | 'automatic_posting'>('review_before_posting');

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [salaryUserId, setSalaryUserId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('1.5');

  // F2.3 — Run due + isActive toggle + Salary Profile modal.
  const { user } = useAuth();
  const { has } = usePermissions();
  const toast = useToast();
  const canExecutePayroll = has('hrm.payroll.execute');
  const canWritePayroll = has('hrm.payroll.write');
  const [runDueBusy, setRunDueBusy] = useState(false);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const actor = useMemo(
    () => ({ actorUserId: user?.id, actorDisplayName: user?.name }),
    [user?.id, user?.name],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [batchList, scheduleList, runList, profileList] = await Promise.all([
        listPayrollBatches({ take: 100 }),
        listPayrollSchedules(),
        listPayrollRuns({ take: 50 }),
        listSalaryProfiles({ take: 200 }),
      ]);
      setSalaryProfiles(profileList);

      setBatches(batchList);
      if (!selectedBatchId && batchList.length) setSelectedBatchId(batchList[0].id);

      setSchedules(scheduleList);
      const active = scheduleList[0];
      if (active) {
        setScheduleName(active.name || 'Default Monthly Payroll');
        setExecutionRule((active.executionRule === 'last_working_day' ? 'last_working_day' : 'day_of_month'));
        setDayOfMonth(String(active.dayOfMonth || 25));
        setValidationMode((active.validationMode === 'automatic_posting' ? 'automatic_posting' : 'review_before_posting'));
      }

      setRuns(runList);
      if (!selectedRunId && runList.length) setSelectedRunId(runList[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll data.');
    } finally {
      setLoading(false);
    }
  };

  const refreshRunDetail = async (runId: string) => {
    const run = await fetchPayrollRunDetail(runId);
    setRunDetail(run);
    if (run) setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...run } : r)));
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }
    void refreshRunDetail(selectedRunId);
  }, [selectedRunId]);

  const selectedBatch = useMemo(
    () => batches.find((row) => row.id === selectedBatchId) || null,
    [batches, selectedBatchId],
  );

  const selectedLine = useMemo(
    () => selectedBatch?.lines?.find((row) => row.id === selectedLineId) || null,
    [selectedBatch, selectedLineId],
  );

  const selectedRunEmployee = useMemo(() => {
    if (!runDetail?.employees?.length) return null;
    return runDetail.employees.find((row) => row.inclusionStatus === 'included') || null;
  }, [runDetail]);

  const refreshBatchDetail = async (batchId: string) => {
    const batch = await fetchPayrollBatchDetail(batchId);
    if (batch) setBatches((prev) => prev.map((row) => (row.id === batchId ? batch : row)));
  };

  const saveSchedule = async () => {
    setBusy(true);
    setError(null);
    try {
      await upsertPayrollSchedule({
        id: schedules[0]?.id,
        code: schedules[0]?.code || 'default',
        name: scheduleName,
        executionRule,
        dayOfMonth: executionRule === 'day_of_month' ? Number(dayOfMonth) : null,
        validationMode,
        actorDisplayName: 'Finance Admin',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payroll schedule.');
    } finally {
      setBusy(false);
    }
  };

  const executeRun = async () => {
    setBusy(true);
    setError(null);
    try {
      const run = await execPayrollRun({
        scheduleId: schedules[0]?.id,
        validationMode,
        triggerType: 'manual',
        actorDisplayName: 'Finance Operator',
      });
      await load();
      if (run?.id) {
        setSelectedRunId(run.id);
        await refreshRunDetail(run.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute payroll run.');
    } finally {
      setBusy(false);
    }
  };

  const postRun = async () => {
    if (!selectedRunId) return;
    setBusy(true);
    setError(null);
    try {
      await postRunRequest(selectedRunId, {
        registerProofReference: `REGISTER-${Date.now()}`,
        actorDisplayName: 'Finance Approver',
      });
      await refreshRunDetail(selectedRunId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post payroll run.');
    } finally {
      setBusy(false);
    }
  };

  const applyAdjustment = async () => {
    if (!selectedRunEmployee) return;
    setBusy(true);
    setError(null);
    try {
      await adjustRunEmployee(selectedRunEmployee.id, {
        adjustedAmount: Number(adjustAmount),
        reason: adjustReason,
        actorDisplayName: 'Finance Manager',
      });
      if (selectedRunId) await refreshRunDetail(selectedRunId);
      await load();
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust payroll line.');
    } finally {
      setBusy(false);
    }
  };

  const saveSalaryProfile = async () => {
    if (!salaryUserId || !salaryAmount) return;
    setBusy(true);
    setError(null);
    try {
      await upsertSalaryProfile({
        id: editingProfileId || undefined,
        userId: salaryUserId.trim(),
        monthlyBaseSalary: Number(salaryAmount),
        overtimeMultiplier: Number(overtimeRate || 1.5),
        currencyCode: 'USD',
        effectiveFrom: new Date().toISOString(),
        ...actor,
      });
      setSalaryUserId('');
      setSalaryAmount('');
      setOvertimeRate('1.5');
      setEditingProfileId(null);
      setSalaryModalOpen(false);
      await load();
      toast?.addToast(editingProfileId ? 'Salary profile updated' : 'Salary profile created', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save salary profile.');
      toast?.addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openSalaryModal = (profile?: SalaryProfile) => {
    if (profile) {
      setEditingProfileId(profile.id);
      setSalaryUserId(profile.userId);
      setSalaryAmount(String(profile.monthlyBaseSalary || ''));
      setOvertimeRate(String(profile.overtimeMultiplier || '1.5'));
    } else {
      setEditingProfileId(null);
      setSalaryUserId('');
      setSalaryAmount('');
      setOvertimeRate('1.5');
    }
    setSalaryModalOpen(true);
  };

  const runDueNow = async () => {
    if (runDueBusy) return;
    setRunDueBusy(true);
    try {
      const { count } = await runDuePayrollSchedules(actor);
      if (count > 0) {
        toast?.addToast(`${count} schedule${count > 1 ? 's' : ''} déclenché${count > 1 ? 's' : ''}`, 'success');
        await load();
      } else {
        toast?.addToast('Aucun schedule échu — rien à exécuter', 'error');
      }
    } catch (err) {
      toast?.addToast(err instanceof Error ? err.message : 'Run due failed', 'error');
    } finally {
      setRunDueBusy(false);
    }
  };

  const toggleScheduleActive = async (schedule: PayrollSchedule) => {
    if (togglingScheduleId) return;
    const nextActive = !(schedule.isActive ?? true);
    setTogglingScheduleId(schedule.id);
    // Optimistic update.
    setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isActive: nextActive } : s)));
    try {
      await upsertPayrollSchedule({
        id: schedule.id,
        code: schedule.code,
        name: schedule.name,
        executionRule: schedule.executionRule as 'day_of_month' | 'last_working_day',
        dayOfMonth: schedule.dayOfMonth ?? null,
        validationMode: schedule.validationMode as 'review_before_posting' | 'automatic_posting',
        isActive: nextActive,
        ...actor,
      });
      toast?.addToast(`Schedule ${nextActive ? 'activé' : 'désactivé'}`, 'success');
    } catch (err) {
      // Revert on error.
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isActive: !nextActive } : s)));
      toast?.addToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    } finally {
      setTogglingScheduleId(null);
    }
  };

  const approveBatch = async (batchId: string) => {
    setBusy(true);
    try {
      await approveBatchRequest(batchId, {
        registerProofReference: `REGISTER-${Date.now()}`,
        actorDisplayName: 'Finance User',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disburseLine = async (lineId: string) => {
    setBusy(true);
    try {
      await disburseLineRequest(lineId, {
        proofReference: `BANK-${Date.now()}`,
        actorDisplayName: 'Finance Cashier',
      });
      if (selectedBatchId) await refreshBatchDetail(selectedBatchId);
    } finally {
      setBusy(false);
    }
  };

  const reconcileBatch = async (batchId: string) => {
    setBusy(true);
    try {
      await reconcileBatchRequest(batchId, { notes: 'Payroll reconciliation completed.' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="bg-card border border-border rounded-xl p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-primary">Payroll Payable Queue</h3>
          <p className="text-xs text-secondary mt-1">Timesheet-based payroll engine with schedule, validation, posting, evidence, and audit trace.</p>
          {error ? <p className="text-xs text-rose-500 mt-2">{error}</p> : null}
        </div>
        <button onClick={() => void load()} className="h-9 px-3 rounded-md border border-input text-primary text-xs flex items-center gap-2 hover:bg-surface">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-4 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><CalendarClock size={16} /> Payroll Schedule</div>
          <div className="space-y-2">
            <label className="text-xs text-secondary">Name</label>
            <input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-secondary">Execution Rule</label>
            <select value={executionRule} onChange={(e) => setExecutionRule((e.target.value as any))} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary">
              <option value="day_of_month">Day of month</option>
              <option value="last_working_day">Last working day</option>
            </select>
          </div>
          {executionRule === 'day_of_month' && (
            <div className="space-y-2">
              <label className="text-xs text-secondary">Day of month</label>
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs text-secondary">Validation Mode</label>
            <select value={validationMode} onChange={(e) => setValidationMode((e.target.value as any))} className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary">
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
            <button disabled={busy || !canWritePayroll} onClick={() => void saveSchedule()} className="h-9 px-3 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold disabled:opacity-50">Save schedule</button>
            <button disabled={busy || !canExecutePayroll} onClick={() => void executeRun()} className="h-9 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><PlayCircle size={13} /> Run now</button>
            {canExecutePayroll && (
              <button
                disabled={runDueBusy || busy}
                onClick={() => void runDueNow()}
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
                      onClick={() => void toggleScheduleActive(s)}
                      title={canWritePayroll ? (active ? 'Désactiver' : 'Activer') : 'hrm.payroll.write requis'}
                      className={`h-6 px-2 rounded text-[10px] font-semibold border disabled:opacity-50 transition-colors ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-surface border-border text-muted'
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
                <button
                  onClick={() => openSalaryModal()}
                  className="h-7 px-2 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold flex items-center gap-1"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-border/70 p-2 space-y-1">
              {salaryProfiles.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => canWritePayroll && openSalaryModal(sp)}
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

        <div className="col-span-12 xl:col-span-8 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Payroll Runs</div>
          <div className="max-h-[260px] overflow-y-auto border-b border-border/70">
            {loading ? <div className="p-5 text-sm text-secondary">Loading runs...</div> : runs.map((run) => (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`w-full text-left px-5 py-3 border-b border-border/60 hover:bg-surface ${selectedRunId === run.id ? 'bg-surface' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-primary">{run.runCode}</p>
                  <span className="text-[10px] uppercase text-secondary">{run.status} / {run.postingStatus}</span>
                </div>
                <p className="text-xs text-secondary mt-1">{formatDate(run.startedAt, 'short')} • Included {run.includedEmployees}/{run.totalEmployees} • Gross {formatCurrency(Number(run.totalGrossPay || 0))}</p>
              </button>
            ))}
            {!loading && runs.length === 0 && <div className="p-5 text-sm text-muted">No payroll runs yet.</div>}
          </div>

          {!runDetail ? (
            <div className="p-5 text-sm text-muted">Select a payroll run to inspect details, anomalies, and posting state.</div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Regular pay</p><p className="text-sm text-primary font-semibold">{formatCurrency(Number(runDetail.totalRegularPay || 0))}</p></div>
                <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Overtime pay</p><p className="text-sm text-primary font-semibold">{formatCurrency(Number(runDetail.totalOvertimePay || 0))}</p></div>
                <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Warnings</p><p className="text-sm text-amber-300 font-semibold">{runDetail.warningCount}</p></div>
                <div className="rounded-lg border border-border/80 bg-surface p-3"><p className="text-[10px] text-muted uppercase">Errors</p><p className="text-sm text-rose-300 font-semibold">{runDetail.errorCount}</p></div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button disabled={busy || runDetail.postingStatus === 'posted'} onClick={() => void postRun()} className="h-8 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"><ShieldCheck size={13} /> Validate & Post</button>
                <span className="text-xs text-secondary">Posting status: {runDetail.postingStatus}</span>
              </div>

              {selectedRunEmployee && (
                <div className="rounded-lg border border-border/80 bg-surface p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary">Manual override (before posting)</p>
                  <p className="text-xs text-secondary">Employee line: {selectedRunEmployee.userId.slice(-8).toUpperCase()} • Current {formatCurrency(Number(selectedRunEmployee.adjustedGrossPay ?? selectedRunEmployee.grossPay ?? 0))}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="Adjusted amount" className="h-8 px-2 rounded border border-input bg-app text-xs text-primary" />
                    <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason (required)" className="h-8 px-2 rounded border border-input bg-app text-xs text-primary" />
                    <button disabled={busy || !adjustAmount || !adjustReason} onClick={() => void applyAdjustment()} className="h-8 px-3 rounded bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-semibold disabled:opacity-50">Apply adjustment</button>
                  </div>
                </div>
              )}

              {(runDetail.notifications || []).length > 0 && (
                <div className="rounded-lg border border-border/80 bg-surface p-3">
                  <p className="text-xs font-semibold text-primary mb-2">Notifications</p>
                  <div className="space-y-2">
                    {(runDetail.notifications || []).slice(0, 5).map((n) => (
                      <div key={n.id} className="text-xs text-secondary flex items-start gap-2">
                        {n.severity === 'warning' ? <AlertTriangle size={12} className="text-amber-300 mt-0.5" /> : <CheckCircle2 size={12} className="text-emerald-300 mt-0.5" />}
                        <div><span className="text-primary">{n.title}</span> - {n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-5 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border text-sm font-semibold text-primary">Payroll Batches</div>
          <div className="max-h-[520px] overflow-y-auto">
            {loading ? <div className="p-5 text-sm text-secondary">Loading...</div> : batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => { setSelectedBatchId(batch.id); setSelectedLineId(null); }}
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
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-primary">{selectedBatch.batchCode}</p>
                  <p className="text-xs text-secondary mt-1">Status: {selectedBatch.status} - Approval: {selectedBatch.approvalStatus}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={busy || selectedBatch.approvalStatus === 'approved'} onClick={() => void approveBatch(selectedBatch.id)} className="h-8 px-3 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
                    <FileCheck2 size={13} /> Approve
                  </button>
                  <button disabled={busy || selectedBatch.status === 'reconciled'} onClick={() => void reconcileBatch(selectedBatch.id)} className="h-8 px-3 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Reconcile
                  </button>
                </div>
              </div>

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
                          <button onClick={() => setSelectedLineId(line.id)} className="text-left">
                            <p className="text-sm font-medium text-primary">{line.employeeName}</p>
                            <p className="text-xs text-muted">{line.employeeCode || '-'}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-300">{formatCurrency(Number(line.totalAmount || 0))}</td>
                        <td className="px-4 py-3 text-xs text-secondary uppercase">{line.status}</td>
                        <td className="px-4 py-3">
                          <button disabled={busy || line.status === 'paid' || line.status === 'reconciled'} onClick={() => void disburseLine(line.id)} className="h-7 px-2.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold disabled:opacity-50 flex items-center gap-1">
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

      <Modal
        isOpen={salaryModalOpen}
        onClose={() => { setSalaryModalOpen(false); setEditingProfileId(null); }}
        title={editingProfileId ? 'Modifier le profil salarial' : 'Ajouter un profil salarial'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setSalaryModalOpen(false); setEditingProfileId(null); }}
              className="h-9 px-4 rounded-md border border-border text-secondary text-sm font-semibold hover:bg-surface"
            >
              Annuler
            </button>
            <button
              disabled={busy || !salaryUserId || !salaryAmount || !canWritePayroll}
              onClick={() => void saveSalaryProfile()}
              className="h-9 px-4 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Saving…' : editingProfileId ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-secondary">Employee User ID</label>
            <input
              value={salaryUserId}
              onChange={(e) => setSalaryUserId(e.target.value)}
              placeholder="usr_..."
              disabled={!!editingProfileId}
              className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary disabled:opacity-60"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-secondary">Monthly salary</label>
              <input
                type="number"
                step="0.01"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-secondary">Overtime multiplier</label>
              <input
                type="number"
                step="0.01"
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-surface text-sm text-primary"
              />
            </div>
          </div>
          {!canWritePayroll && (
            <p className="text-xs text-rose-400">Permission requise : hrm.payroll.write</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default FinancePayrollPage;
