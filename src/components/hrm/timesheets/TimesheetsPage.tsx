// HRM-2.5 — Timesheets page on the DB-driven API.
//
// Self-service: every authenticated user can write their own entries
// (hrm.timesheets.write) and submit them. Managers with
// hrm.timesheets.execute also see the Approvals tab listing every
// week awaiting validation across the org.
//
// One TimesheetEntry row per (userId, workDate, projectId-or-null) —
// the week view groups them by project for a familiar weekly grid.
//
// Migrated off the deprecated can() shim (7/10 pages now on
// usePermissions: LeavePage + RecruitmentPage + OnboardingPage +
// OffboardingPage + TrainingPage + PoliciesPage + CasesPage +
// this one).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, addDays, parseISO, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Send, Check, X, RefreshCw, Clock } from 'lucide-react';
import StatusChip from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import {
  timesheetsApi,
  type TimesheetEntry,
  type WeekRollup,
  type PendingWeek,
  type TimesheetStatus,
} from '../../../services/timesheetsApi';

type Tab = 'my' | 'approvals';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoMonday(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

// Bucket entries by projectId (a "row" in the weekly grid).
function bucketByProject(entries: TimesheetEntry[]) {
  const buckets = new Map<string, { projectId: string | null; entries: (TimesheetEntry | null)[] }>();
  for (const e of entries) {
    const key = e.projectId ?? '__internal__';
    const bucket = buckets.get(key) ?? { projectId: e.projectId, entries: Array(7).fill(null) };
    const dayIndex = (new Date(e.workDate).getUTCDay() + 6) % 7; // Monday-first
    bucket.entries[dayIndex] = e;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values());
}

const TimesheetsPage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const actorUserId = user?.id ?? '';
  const canWrite   = isReady && has('hrm.timesheets.write');
  const canExecute = isReady && has('hrm.timesheets.execute');

  const [tab, setTab] = useState<Tab>('my');
  const [weekStart, setWeekStart] = useState<string>(() => isoMonday(new Date()));
  const [week, setWeek] = useState<WeekRollup | null>(null);
  const [pending, setPending] = useState<PendingWeek[] | null>(null);
  const [reviewing, setReviewing] = useState<PendingWeek | null>(null);
  const [reviewWeek, setReviewWeek] = useState<WeekRollup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadMyWeek = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true); setError(null);
    try {
      const r = await timesheetsApi.getWeek(actorUserId, weekStart, actorUserId);
      setWeek(r.week);
    } catch (e) { setError(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [actorUserId, weekStart]);

  const reloadPending = useCallback(async () => {
    if (!actorUserId || !canExecute) return;
    setLoading(true); setError(null);
    try {
      const r = await timesheetsApi.listPending(actorUserId);
      setPending(r.pending);
    } catch (e) { setError(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [actorUserId, canExecute]);

  useEffect(() => { if (tab === 'my') void reloadMyWeek(); }, [tab, reloadMyWeek]);
  useEffect(() => { if (tab === 'approvals') void reloadPending(); }, [tab, reloadPending]);

  // ---------- My week handlers ----------

  const updateHours = useCallback(async (existing: TimesheetEntry | null, dayIndex: number, projectId: string | null, hours: number) => {
    if (!week) return;
    const workDate = format(addDays(parseISO(week.weekStartDate), dayIndex), 'yyyy-MM-dd');
    try {
      if (existing) {
        if (hours === 0) {
          await timesheetsApi.remove(existing.id, actorUserId);
        } else {
          await timesheetsApi.upsert({ id: existing.id, userId: actorUserId, workDate, hours, projectId: projectId ?? undefined }, actorUserId);
        }
      } else if (hours > 0) {
        await timesheetsApi.upsert({ userId: actorUserId, workDate, hours, projectId: projectId ?? undefined }, actorUserId);
      }
      await reloadMyWeek();
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string }; message?: string };
      if (err?.payload?.code === 'ENTRY_APPROVED') notify('Cette entrée est déjà approuvée', 'error');
      else if (err?.payload?.code === 'ENTRY_SUBMITTED') notify('Soumise — rejeter d\'abord pour rééditer', 'error');
      else notify(err?.message || 'Save failed', 'error');
    }
  }, [week, actorUserId, reloadMyWeek]);

  const addProjectRow = useCallback(async () => {
    if (!week) return;
    const projectId = window.prompt('Project ID (laisser vide pour Internal/Admin) :') ?? '';
    const workDate = format(parseISO(week.weekStartDate), 'yyyy-MM-dd');
    try {
      await timesheetsApi.upsert({ userId: actorUserId, workDate, hours: 0, projectId: projectId.trim() || undefined }, actorUserId);
      await reloadMyWeek();
    } catch (e) {
      // 0-hour rows are valid placeholders — if the backend rejects, fall back to a no-op.
      notify(e instanceof Error ? e.message : 'Add failed', 'error');
    }
  }, [week, actorUserId, reloadMyWeek]);

  const submitMyWeek = useCallback(async () => {
    if (!week) return;
    try {
      await timesheetsApi.submitWeek(actorUserId, format(parseISO(week.weekStartDate), 'yyyy-MM-dd'), actorUserId);
      notify('Semaine soumise pour validation');
      await reloadMyWeek();
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string }; message?: string };
      if (err?.payload?.code === 'ENTRY_APPROVED') notify('Cette semaine contient des entrées déjà approuvées', 'error');
      else notify(err?.message || 'Submit failed', 'error');
    }
  }, [week, actorUserId, reloadMyWeek]);

  // ---------- Approvals handlers ----------

  const openReview = useCallback(async (p: PendingWeek) => {
    setReviewing(p);
    setReviewWeek(null);
    try {
      const r = await timesheetsApi.getWeek(p.userId, format(parseISO(p.weekStartDate), 'yyyy-MM-dd'), actorUserId);
      setReviewWeek(r.week);
    } catch (e) { notify(e instanceof Error ? e.message : 'Load failed', 'error'); }
  }, [actorUserId]);

  const approve = useCallback(async () => {
    if (!reviewing) return;
    try {
      await timesheetsApi.approveWeek(reviewing.userId, format(parseISO(reviewing.weekStartDate), 'yyyy-MM-dd'), actorUserId);
      notify('Semaine approuvée');
      setReviewing(null); setReviewWeek(null);
      await reloadPending();
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string; currentStatus?: string }; message?: string };
      if (err?.payload?.code === 'ENTRY_NOT_SUBMITTED') {
        notify(`Une entrée n'est pas soumise (status: ${err.payload.currentStatus ?? '?'})`, 'error');
      } else {
        notify(err?.message || 'Approve failed', 'error');
      }
    }
  }, [reviewing, actorUserId, reloadPending]);

  const reject = useCallback(async () => {
    if (!reviewing) return;
    const comment = window.prompt('Motif du rejet (optionnel) :') ?? undefined;
    try {
      await timesheetsApi.rejectWeek(reviewing.userId, format(parseISO(reviewing.weekStartDate), 'yyyy-MM-dd'), comment, actorUserId);
      notify('Semaine rejetée');
      setReviewing(null); setReviewWeek(null);
      await reloadPending();
    } catch (e) { notify(e instanceof Error ? e.message : 'Reject failed', 'error'); }
  }, [reviewing, actorUserId, reloadPending]);

  const projectRows = useMemo(() => bucketByProject(week?.entries ?? []), [week]);
  const reviewProjectRows = useMemo(() => bucketByProject(reviewWeek?.entries ?? []), [reviewWeek]);

  const endOfWeekLabel = useMemo(() => {
    if (!week) return '';
    return format(addDays(parseISO(week.weekStartDate), 6), 'MMM d, yyyy');
  }, [week]);

  // ---------- Render ----------

  // Review detail view
  if (tab === 'approvals' && reviewing) {
    const totalHours = reviewWeek?.totalHours ?? reviewing.totalHours;
    return (
      <div className="h-full flex flex-col bg-app overflow-hidden">
        <div className="flex-none px-8 py-4 border-b border-border/60 flex items-center gap-4 bg-app">
          <button onClick={() => { setReviewing(null); setReviewWeek(null); }} className="p-2 hover:bg-card/[0.06] rounded-lg text-muted hover:text-primary">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-primary">
              Reviewing {reviewing.user.name ?? reviewing.user.email ?? reviewing.userId}
            </h2>
            <p className="text-[12px] text-muted">
              Week of {format(parseISO(reviewing.weekStartDate), 'MMM d, yyyy')} · Total {Number(totalHours).toFixed(1)}h
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void reject()} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[13px] font-bold hover:bg-rose-500/20">
              <X size={14} /> Reject
            </button>
            <button onClick={() => void approve()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-bold hover:bg-emerald-500">
              <Check size={14} /> Approve
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <WeekGrid weekStart={reviewing.weekStartDate} rows={reviewProjectRows} readOnly />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-app overflow-hidden">
      {/* Top bar */}
      <div className="flex-none px-8 py-6 border-b border-border/60 flex items-center justify-between bg-app">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-[24px] font-bold text-primary tracking-tight">Timesheets</h1>
            <p className="text-[13px] text-muted mt-1">Track work, manage approvals</p>
          </div>
          {canExecute && (
            <div className="flex bg-card/[0.04] p-1 rounded-lg border border-border/60 ml-4">
              {(['my', 'approvals'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all flex items-center gap-2 ${tab === t ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted hover:text-primary'}`}>
                  {t === 'my' ? 'My Timesheet' : 'Approvals'}
                  {t === 'approvals' && pending && pending.length > 0 && (
                    <span className="bg-card/20 text-primary text-[10px] px-1.5 rounded-full">{pending.length}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => tab === 'my' ? void reloadMyWeek() : void reloadPending()} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-[12px] text-secondary hover:bg-surface">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => tab === 'my' ? void reloadMyWeek() : void reloadPending()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
        </div>
      )}

      {/* Content */}
      {tab === 'my' ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Week header */}
          <div className="flex-none px-8 py-6 border-b border-border/60 flex items-center justify-between bg-app">
            <div>
              <h2 className="text-[18px] font-bold text-primary flex items-center gap-3">
                My Timesheet
                {week && <StatusChip status={week.statusCode} />}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center bg-card/[0.04] rounded-lg p-0.5 border border-border/60">
                  <button onClick={() => setWeekStart(format(subWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-card/[0.08] rounded text-muted hover:text-primary">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 text-[13px] font-medium text-secondary tabular-nums">
                    {format(parseISO(weekStart), 'MMM d')} – {endOfWeekLabel}
                  </span>
                  <button onClick={() => setWeekStart(format(addWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd'))} className="p-1 hover:bg-card/[0.08] rounded text-muted hover:text-primary">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-surface rounded-lg border border-border/60">
                <p className="text-[10px] font-bold uppercase text-muted tracking-wider">Total</p>
                <p className="text-[16px] font-bold text-primary tabular-nums">{Number(week?.totalHours ?? 0).toFixed(1)}h</p>
              </div>
              {canWrite && week && (week.statusCode === 'draft' || week.statusCode === 'rejected') && week.totalHours > 0 && (
                <button onClick={() => void submitMyWeek()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-bold rounded-lg shadow-lg shadow-emerald-900/20">
                  <Send size={14} /> Submit for Approval
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto">
              {loading && !week ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg border border-border/60 bg-card/40" />)}
                </div>
              ) : (
                <>
                  {week?.statusCode === 'rejected' && week.entries[0]?.reviewerComment && (
                    <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-[12px] text-rose-300">
                      <span className="font-semibold text-rose-400">Rejected: </span>
                      {week.entries[0].reviewerComment}
                    </div>
                  )}
                  <WeekGrid
                    weekStart={week?.weekStartDate ?? weekStart}
                    rows={projectRows}
                    readOnly={week ? (week.statusCode === 'submitted' || week.statusCode === 'approved') : !canWrite}
                    onChange={(row, dayIdx, hours) => void updateHours(row.entries[dayIdx], dayIdx, row.projectId, hours)}
                  />
                  {canWrite && (week?.statusCode === 'draft' || week?.statusCode === 'rejected' || !week) && (
                    <button onClick={() => void addProjectRow()} className="mt-3 flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-muted hover:text-primary hover:bg-surface rounded-lg w-full">
                      <Plus size={14} /> Add project row
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-4">
            {loading && pending === null ? (
              [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-card/40" />)
            ) : (pending ?? []).length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
                <Clock className="mx-auto text-muted mb-4" size={32} />
                <h3 className="text-muted font-medium">All caught up!</h3>
                <p className="text-muted text-sm mt-1">No timesheets pending approval.</p>
              </div>
            ) : (
              pending?.map((p) => (
                <div key={`${p.userId}|${p.weekStartDate}`} onClick={() => void openReview(p)}
                  className="group bg-card hover:bg-card border border-border/60 hover:border-emerald-500/30 rounded-xl p-5 cursor-pointer transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                        {(p.user.name ?? p.user.email ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-primary group-hover:text-emerald-400">{p.user.name ?? p.user.email ?? p.userId}</h4>
                        <p className="text-[12px] text-muted">Week of {format(parseISO(p.weekStartDate), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted font-bold tracking-wider">Total</p>
                        <p className="text-[16px] font-bold text-primary tabular-nums">{Number(p.totalHours).toFixed(1)}h</p>
                      </div>
                      <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-[12px] font-medium rounded-lg border border-emerald-500/20">
                        Review
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- WeekGrid sub-component ----------

interface ProjectRow {
  projectId: string | null;
  entries: (TimesheetEntry | null)[];
}

interface WeekGridProps {
  weekStart: string;
  rows: ProjectRow[];
  readOnly?: boolean;
  onChange?: (row: ProjectRow, dayIndex: number, hours: number) => void;
}

const WeekGrid: React.FC<WeekGridProps> = ({ weekStart, rows, readOnly = false, onChange }) => {
  const totalForRow = (r: ProjectRow) => r.entries.reduce((sum, e) => sum + (e ? Number(e.hours) : 0), 0);
  const totalForDay = (idx: number) => rows.reduce((sum, r) => sum + (r.entries[idx] ? Number(r.entries[idx]!.hours) : 0), 0);
  const totalAll = rows.reduce((sum, r) => sum + totalForRow(r), 0);

  if (rows.length === 0) {
    return (
      <div className="bg-app border border-border/60 rounded-xl p-12 text-center text-muted">
        <p>No activities logged for this week.</p>
      </div>
    );
  }

  return (
    <div className="bg-app border border-border/60 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[2fr_repeat(7,1fr)_auto] gap-px bg-surface border-b border-border/60 text-[12px] font-medium text-muted">
        <div className="px-4 py-3">Project</div>
        {DAYS.map((d, i) => (
          <div key={d} className="px-2 py-3 text-center">
            <div>{d}</div>
            <div className="text-[10px] mt-0.5 text-muted/70">{format(addDays(parseISO(weekStart), i), 'd')}</div>
          </div>
        ))}
        <div className="px-4 py-3 text-center w-14">Total</div>
      </div>

      {rows.map((row) => (
        <div key={row.projectId ?? '__internal__'} className="group grid grid-cols-[2fr_repeat(7,1fr)_auto] gap-px border-b border-border/60 hover:bg-card/[0.01] items-center text-sm">
          <div className="px-4 py-2 text-primary text-[13px] truncate">{row.projectId ?? 'Internal / Admin'}</div>
          {row.entries.map((e, i) => (
            <div key={i} className="px-1 py-2 text-center">
              {readOnly ? (
                <span className={e && Number(e.hours) > 0 ? 'text-secondary' : 'text-muted'}>
                  {e && Number(e.hours) > 0 ? Number(e.hours) : '-'}
                </span>
              ) : (
                <input type="number" min={0} max={24} step={0.5}
                  defaultValue={e && Number(e.hours) > 0 ? Number(e.hours) : ''}
                  onBlur={(ev) => {
                    const v = ev.target.value === '' ? 0 : parseFloat(ev.target.value);
                    const current = e ? Number(e.hours) : 0;
                    if (v !== current) onChange?.(row, i, v);
                  }}
                  className={`w-full text-center bg-transparent border border-transparent hover:border-border focus:border-emerald-500 rounded p-1.5 outline-none ${e && Number(e.hours) > 0 ? 'text-emerald-400 font-medium bg-emerald-500/[0.03]' : 'text-muted'}`}
                />
              )}
            </div>
          ))}
          <div className="px-4 py-2 text-center font-bold text-primary tabular-nums w-14">
            {totalForRow(row) > 0 ? Number(totalForRow(row)).toFixed(1) : <span className="text-muted">-</span>}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-[2fr_repeat(7,1fr)_auto] gap-px bg-surface/50 text-[12px] font-semibold text-secondary">
        <div className="px-4 py-3 text-right">Daily total</div>
        {DAYS.map((_, i) => (
          <div key={i} className="px-2 py-3 text-center tabular-nums">
            {totalForDay(i) > 0 ? Number(totalForDay(i)).toFixed(1) : '-'}
          </div>
        ))}
        <div className="px-4 py-3 text-center font-bold text-primary tabular-nums w-14">{Number(totalAll).toFixed(1)}</div>
      </div>
    </div>
  );
};

export default TimesheetsPage;
