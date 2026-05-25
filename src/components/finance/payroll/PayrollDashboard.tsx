// F2.6 — Payroll orchestrator. Owns all state and data fetching, passes
// slices + callbacks down to focused children. No JSX heavy-lifting here
// beyond the layout shell + shared modals (Salary edit + ConfirmDialog).

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import { useToast } from '../../ui/Toast';
import ConfirmDialog from '../../ui/ConfirmDialog';
import SalaryProfileModal from './SalaryProfileModal';
import type { PayrollBatch, PayrollRun, PayrollSchedule, SalaryProfile } from '../../../types/payroll';
import {
  listPayrollSchedules, listPayrollRuns, listPayrollBatches, listSalaryProfiles,
  getPayrollRunDetail as fetchPayrollRunDetail,
  getPayrollBatchDetail as fetchPayrollBatchDetail,
  upsertPayrollSchedule, upsertSalaryProfile,
  executePayrollRun as execPayrollRun,
  postPayrollRun as postRunRequest,
  adjustPayrollRunEmployee as adjustRunEmployee,
  reconcilePayrollBatch as reconcileBatchRequest,
  disbursePayrollLine as disburseLineRequest,
  runDuePayrollSchedules,
} from '../../../services/finance/payrollEngineApi';

import PayrollSchedulesPanel from './PayrollSchedulesPanel';
import PayrollRunsList from './PayrollRunsList';
import PayrollRunDetail from './PayrollRunDetail';
import PayrollBatchDetail from './PayrollBatchDetail';

interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const PayrollDashboard: React.FC = () => {
  // ── Data state ──────────────────────────────────────────────────
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<PayrollSchedule[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<PayrollRun | null>(null);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);

  // ── UI state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runDueBusy, setRunDueBusy] = useState(false);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);

  // ── Schedule form state ─────────────────────────────────────────
  const [scheduleName, setScheduleName] = useState('Default Monthly Payroll');
  const [executionRule, setExecutionRule] = useState<'day_of_month' | 'last_working_day'>('day_of_month');
  const [dayOfMonth, setDayOfMonth] = useState('25');
  const [validationMode, setValidationMode] = useState<'review_before_posting' | 'automatic_posting'>('review_before_posting');

  // ── Adjustment + Salary modal state ─────────────────────────────
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [salaryUserId, setSalaryUserId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('1.5');
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // ── Confirm dialog state (shared) ───────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<ConfirmRequest | null>(null);

  // ── Auth / permissions ──────────────────────────────────────────
  const { user } = useAuth();
  const { has } = usePermissions();
  const toast = useToast();
  const canExecutePayroll = has('hrm.payroll.execute');
  const canWritePayroll = has('hrm.payroll.write');
  const actor = useMemo(() => ({ actorUserId: user?.id, actorDisplayName: user?.name }), [user?.id, user?.name]);

  // ── Fetch ───────────────────────────────────────────────────────
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
        setExecutionRule(active.executionRule === 'last_working_day' ? 'last_working_day' : 'day_of_month');
        setDayOfMonth(String(active.dayOfMonth || 25));
        setValidationMode(active.validationMode === 'automatic_posting' ? 'automatic_posting' : 'review_before_posting');
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

  const refreshBatchDetail = async (batchId: string) => {
    const batch = await fetchPayrollBatchDetail(batchId);
    if (batch) setBatches((prev) => prev.map((row) => (row.id === batchId ? batch : row)));
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selectedRunId) { setRunDetail(null); return; }
    void refreshRunDetail(selectedRunId);
  }, [selectedRunId]);

  // ── Derived ─────────────────────────────────────────────────────
  const selectedBatch = useMemo(() => batches.find((row) => row.id === selectedBatchId) || null, [batches, selectedBatchId]);
  const selectedLine = useMemo(() => selectedBatch?.lines?.find((row) => row.id === selectedLineId) || null, [selectedBatch, selectedLineId]);
  const selectedRunEmployee = useMemo(() => {
    if (!runDetail?.employees?.length) return null;
    return runDetail.employees.find((row) => row.inclusionStatus === 'included') || null;
  }, [runDetail]);

  // ── Mutations ───────────────────────────────────────────────────
  const saveSchedule = async () => {
    setBusy(true); setError(null);
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
    } finally { setBusy(false); }
  };

  const executeRun = async () => {
    setBusy(true); setError(null);
    try {
      const run = await execPayrollRun({
        scheduleId: schedules[0]?.id,
        validationMode,
        triggerType: 'manual',
        actorDisplayName: 'Finance Operator',
      });
      await load();
      if (run?.id) { setSelectedRunId(run.id); await refreshRunDetail(run.id); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute payroll run.');
    } finally { setBusy(false); }
  };

  const postRun = async () => {
    if (!selectedRunId) return;
    setBusy(true); setError(null);
    try {
      await postRunRequest(selectedRunId, {
        registerProofReference: `REGISTER-${Date.now()}`,
        actorDisplayName: 'Finance Approver',
      });
      await refreshRunDetail(selectedRunId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post payroll run.');
    } finally { setBusy(false); }
  };

  const applyAdjustment = async () => {
    if (!selectedRunEmployee) return;
    setBusy(true); setError(null);
    try {
      await adjustRunEmployee(selectedRunEmployee.id, {
        adjustedAmount: Number(adjustAmount),
        reason: adjustReason,
        actorDisplayName: 'Finance Manager',
      });
      if (selectedRunId) await refreshRunDetail(selectedRunId);
      await load();
      setAdjustAmount(''); setAdjustReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust payroll line.');
    } finally { setBusy(false); }
  };

  const saveSalaryProfile = async () => {
    if (!salaryUserId || !salaryAmount) return;
    setBusy(true); setError(null);
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
      setSalaryUserId(''); setSalaryAmount(''); setOvertimeRate('1.5');
      setEditingProfileId(null); setSalaryModalOpen(false);
      await load();
      toast?.addToast(editingProfileId ? 'Salary profile updated' : 'Salary profile created', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save salary profile.');
      toast?.addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally { setBusy(false); }
  };

  const openSalaryModal = (profile?: SalaryProfile) => {
    if (profile) {
      setEditingProfileId(profile.id);
      setSalaryUserId(profile.userId);
      setSalaryAmount(String(profile.monthlyBaseSalary || ''));
      setOvertimeRate(String(profile.overtimeMultiplier || '1.5'));
    } else {
      setEditingProfileId(null);
      setSalaryUserId(''); setSalaryAmount(''); setOvertimeRate('1.5');
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
    } finally { setRunDueBusy(false); }
  };

  const toggleScheduleActive = async (schedule: PayrollSchedule) => {
    if (togglingScheduleId) return;
    const nextActive = !(schedule.isActive ?? true);
    setTogglingScheduleId(schedule.id);
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
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, isActive: !nextActive } : s)));
      toast?.addToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    } finally { setTogglingScheduleId(null); }
  };

  const disburseLine = async (lineId: string) => {
    setBusy(true);
    try {
      await disburseLineRequest(lineId, { proofReference: `BANK-${Date.now()}`, actorDisplayName: 'Finance Cashier' });
      if (selectedBatchId) await refreshBatchDetail(selectedBatchId);
    } finally { setBusy(false); }
  };

  const reconcileBatch = async (batchId: string) => {
    setBusy(true);
    try {
      await reconcileBatchRequest(batchId, { notes: 'Payroll reconciliation completed.' });
      await load();
      toast?.addToast('Batch reconciled', 'success');
    } catch (err) {
      toast?.addToast(err instanceof Error ? err.message : 'Reconcile failed', 'error');
    } finally { setBusy(false); }
  };

  const disburseAllPending = async (batch: PayrollBatch) => {
    const pending = batch.lines.filter((l) => l.status !== 'paid' && l.status !== 'reconciled');
    if (pending.length === 0) return;
    setBusy(true);
    try {
      for (const line of pending) {
        await disburseLineRequest(line.id, {
          proofReference: `BANK-${Date.now()}-${line.id.slice(-6)}`,
          actorDisplayName: actor.actorDisplayName,
          actorUserId: actor.actorUserId,
        });
      }
      await refreshBatchDetail(batch.id);
      await load();
      toast?.addToast(`${pending.length} ligne${pending.length > 1 ? 's' : ''} disbursée${pending.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      toast?.addToast(err instanceof Error ? err.message : 'Disburse failed', 'error');
    } finally { setBusy(false); }
  };

  // ── Render ──────────────────────────────────────────────────────
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
        <PayrollSchedulesPanel
          schedules={schedules}
          salaryProfiles={salaryProfiles}
          scheduleName={scheduleName}
          executionRule={executionRule}
          dayOfMonth={dayOfMonth}
          validationMode={validationMode}
          busy={busy}
          runDueBusy={runDueBusy}
          togglingScheduleId={togglingScheduleId}
          canWritePayroll={canWritePayroll}
          canExecutePayroll={canExecutePayroll}
          onChangeScheduleName={setScheduleName}
          onChangeExecutionRule={setExecutionRule}
          onChangeDayOfMonth={setDayOfMonth}
          onChangeValidationMode={setValidationMode}
          onSaveSchedule={() => void saveSchedule()}
          onExecuteRun={() => void executeRun()}
          onRunDueNow={() => void runDueNow()}
          onToggleScheduleActive={(s) => void toggleScheduleActive(s)}
          onOpenSalaryModal={openSalaryModal}
        />

        <div className="col-span-12 xl:col-span-8 bg-card border border-border rounded-xl overflow-hidden">
          <PayrollRunsList
            runs={runs}
            selectedRunId={selectedRunId}
            loading={loading}
            onSelectRun={setSelectedRunId}
          />
          <PayrollRunDetail
            runDetail={runDetail}
            busy={busy}
            canExecutePayroll={canExecutePayroll}
            selectedRunEmployee={selectedRunEmployee}
            adjustAmount={adjustAmount}
            adjustReason={adjustReason}
            onChangeAdjustAmount={setAdjustAmount}
            onChangeAdjustReason={setAdjustReason}
            onApplyAdjustment={() => void applyAdjustment()}
            onPostRun={() => void postRun()}
            onRequestConfirm={setConfirmDialog}
          />
        </div>
      </div>

      <PayrollBatchDetail
        batches={batches}
        selectedBatch={selectedBatch}
        selectedBatchId={selectedBatchId}
        selectedLine={selectedLine}
        selectedLineId={selectedLineId}
        loading={loading}
        busy={busy}
        canExecutePayroll={canExecutePayroll}
        onSelectBatch={(id) => { setSelectedBatchId(id); setSelectedLineId(null); }}
        onSelectLine={setSelectedLineId}
        onDisburseLine={(id) => void disburseLine(id)}
        onDisburseAllPending={(b) => void disburseAllPending(b)}
        onReconcileBatch={(id) => void reconcileBatch(id)}
        onRequestConfirm={setConfirmDialog}
      />

      <SalaryProfileModal
        isOpen={salaryModalOpen}
        editingProfileId={editingProfileId}
        salaryUserId={salaryUserId}
        salaryAmount={salaryAmount}
        overtimeRate={overtimeRate}
        busy={busy}
        canWritePayroll={canWritePayroll}
        onChangeUserId={setSalaryUserId}
        onChangeAmount={setSalaryAmount}
        onChangeRate={setOvertimeRate}
        onClose={() => { setSalaryModalOpen(false); setEditingProfileId(null); }}
        onSubmit={() => void saveSalaryProfile()}
      />

      <ConfirmDialog
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => { confirmDialog?.onConfirm(); }}
        title={confirmDialog?.title || ''}
        description={confirmDialog?.description || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        destructive={false}
      />
    </div>
  );
};

export default PayrollDashboard;
