// HRM-2.2 — Onboarding page on the new DB-driven API.
//
// Visual shell preserved (list of checklists -> detail with tasks
// grouped by owner). Data sourced from /api/v1/hrm/onboarding/*.
// Self-service: a user without hrm.onboarding.execute only sees their
// own checklists; with execute they see everyone.
//
// Migrated off the deprecated can() shim (3/10 pages now on the new
// usePermissions API — LeavePage + RecruitmentPage + this one).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Circle, User, Monitor, Shield, Briefcase, CheckCircle2, Activity, RefreshCw, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '../../ui/PageHeader';
import StatusChip from '../../ui/StatusChip';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import {
  onboardingApi,
  type ChecklistDetail,
  type ChecklistSummary,
  type ChecklistTaskRow,
  type TaskStatus,
} from '../../../services/onboardingApi';
import TemplateManagerModal from './TemplateManagerModal';

type TaskOwner = 'employee' | 'manager' | 'hr' | 'it';

const OWNER_ICON: Record<TaskOwner, React.ReactNode> = {
    employee: <User size={13} />,
    manager: <Briefcase size={13} />,
    hr: <Shield size={13} />,
    it: <Monitor size={13} />,
};
const OWNER_COLOR: Record<TaskOwner, string> = {
    employee: 'text-blue-400',
    manager: 'text-amber-400',
    hr: 'text-purple-400',
    it: 'text-emerald-400',
};
const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
    pending: <Circle size={14} className="text-muted" />,
    done: <CheckCircle size={14} className="text-emerald-400" />,
    skipped: <Clock size={14} className="text-amber-400" />,
};

function ownerOf(role: string | null | undefined): TaskOwner {
  const r = String(role || 'employee').toLowerCase();
  if (r === 'manager' || r === 'hr' || r === 'it' || r === 'employee') return r;
  return 'employee';
}

function progressOf(checklist: { tasks?: Array<{ statusCode: TaskStatus }> }): number {
  const tasks = checklist.tasks ?? [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.statusCode === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

const OnboardingPage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const { departments } = useHRMStore();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const actorUserId = user?.id ?? '';
  const canExecute = isReady && has('hrm.onboarding.execute');
  const canManageTemplates = isReady && has('hrm.onboarding.write');
  const scope: 'self' | 'all' = canExecute ? 'all' : 'self';

  const [checklists, setChecklists] = useState<ChecklistSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const departmentName = useCallback(
    (departmentId: string | null | undefined) => departments.find((d) => d.id === departmentId)?.name ?? '—',
    [departments],
  );

  const reload = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await onboardingApi.listChecklists(scope === 'self' ? { forUserId: actorUserId } : {});
      setChecklists(r.checklists);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load onboarding checklists');
    } finally {
      setLoading(false);
    }
  }, [actorUserId, scope]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    onboardingApi.getChecklist(selectedId)
      .then((r) => { if (!cancelled) setDetail(r.checklist); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load checklist'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const handleCycleTask = async (task: ChecklistTaskRow) => {
    if (!detail) return;
    if (!canExecute && detail.userId !== actorUserId) {
      notify('Permission denied: hrm.onboarding.execute required to complete others\' tasks', 'error');
      return;
    }
    const next: TaskStatus = task.statusCode === 'done' ? 'pending'
      : task.statusCode === 'pending' ? 'done' : 'done';
    try {
      await onboardingApi.updateTask(detail.id, task.id, { statusCode: next }, actorUserId);
      // Refresh detail + list to pick up the rolled-up checklist status.
      const r = await onboardingApi.getChecklist(detail.id);
      setDetail(r.checklist);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Update task failed', 'error');
    }
  };

  const handleCompleteChecklist = async () => {
    if (!detail) return;
    try {
      await onboardingApi.completeChecklist(detail.id, actorUserId);
      notify('🎉 Onboarding complete — employee is now active!', 'success');
      setSelectedId(null);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Complete failed', 'error');
    }
  };

  // ── Plan Detail View ──
  if (selectedId && detail) {
    const grouped: Record<TaskOwner, ChecklistTaskRow[]> = { employee: [], manager: [], hr: [], it: [] };
    for (const t of detail.tasks) {
      grouped[ownerOf(t.templateTask.assignedRole)].push(t);
    }
    const allRequiredDone = detail.tasks.length > 0
      && detail.tasks.filter((t) => t.templateTask.isRequired).every((t) => t.statusCode === 'done');
    const canCompleteNow = canExecute && detail.statusCode !== 'completed';
    const progress = progressOf(detail);

    return (
      <div className="h-full flex flex-col overflow-hidden bg-app">
        <PageHeader
          title={`Onboarding: ${detail.user.name ?? detail.user.email ?? detail.userId}`}
          subtitle={`${departmentName(detail.user.departmentId ?? null)} · ${detail.template.name} · Started ${new Date(detail.startDate).toLocaleDateString()}`}
          actions={
            <div className="flex items-center gap-2">
              {canCompleteNow && (
                <button
                  onClick={handleCompleteChecklist}
                  disabled={!allRequiredDone}
                  title={!allRequiredDone ? 'Complete all required tasks first' : 'Mark onboarding as complete'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                    allRequiredDone
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-surface text-muted border border-input cursor-not-allowed opacity-60'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  {allRequiredDone
                    ? 'Complete onboarding'
                    : `Complete (${detail.tasks.filter((t) => t.statusCode === 'done').length}/${detail.tasks.length})`}
                </button>
              )}
              {detail.statusCode === 'completed' && (
                <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[12px] font-semibold text-emerald-400">
                  <CheckCircle2 size={13} /> Completed
                </span>
              )}
              <button
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface"
              >
                ← Back
              </button>
            </div>
          }
        />

        <div className="px-8 py-4 border-b border-border/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-muted">Progress</span>
            <span className="text-[13px] font-bold text-emerald-400">{progress}%</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <motion.div className="h-full bg-emerald-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {detailLoading && <p className="text-[13px] text-muted">Refreshing…</p>}
          {(Object.entries(grouped) as Array<[TaskOwner, ChecklistTaskRow[]]>)
            .filter(([, tasks]) => tasks.length > 0)
            .map(([owner, tasks]) => (
              <div key={owner} className="bg-card rounded-xl border border-border/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
                  <span className={OWNER_COLOR[owner]}>{OWNER_ICON[owner]}</span>
                  <span className="text-[13px] font-semibold text-primary capitalize">{owner}</span>
                  <span className="text-[11px] text-muted ml-auto">
                    {tasks.filter((t) => t.statusCode === 'done').length}/{tasks.length}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {tasks.map((task) => (
                    <div key={task.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
                      <button
                        onClick={() => handleCycleTask(task)}
                        disabled={detail.statusCode === 'completed'}
                        className="flex-none"
                        title="Toggle done"
                      >
                        {STATUS_ICON[task.statusCode]}
                      </button>
                      <span className={`text-[13px] flex-1 ${task.statusCode === 'done' ? 'text-muted line-through' : 'text-primary'}`}>
                        {task.templateTask.title}
                        {task.templateTask.isRequired && (
                          <span className="ml-1.5 text-[9px] font-bold text-red-400/60 uppercase">req</span>
                        )}
                      </span>
                      {task.completedAt && (
                        <span className="text-[11px] text-muted">
                          {new Date(task.completedAt).toLocaleDateString()}{task.completedBy?.name ? ` · ${task.completedBy.name}` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ── Plan List View ──
  return (
    <div className="h-full flex flex-col overflow-hidden bg-app">
      <PageHeader
        title="Onboarding"
        subtitle={`${checklists?.length ?? 0} ${scope === 'self' ? 'of yours' : 'across the org'}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-secondary hover:bg-border">
              <RefreshCw size={14} /> Refresh
            </button>
            {canManageTemplates && (
              <button onClick={() => setTemplatesOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90">
                <Plus size={14} /> Templates
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => void reload()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        {loading && !checklists ? (
          <div className="space-y-3">
            {[0,1,2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/40" />)}
          </div>
        ) : checklists && checklists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-muted" />
            </div>
            <p className="text-[15px] font-semibold text-muted">No onboarding checklist</p>
            <p className="text-[13px] text-muted mt-1">Hire a candidate from the Recruitment board to create one automatically.</p>
          </div>
        ) : (
          checklists?.map((cl) => {
            const progress = progressOf(cl);
            const total = cl.tasks?.length ?? 0;
            const done = cl.tasks?.filter((t) => t.statusCode === 'done').length ?? 0;
            return (
              <motion.div
                key={cl.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedId(cl.id)}
                className="bg-card rounded-xl border border-border/60 p-5 cursor-pointer hover:border-border transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-primary group-hover:text-emerald-400 transition-colors">
                      {cl.user.name ?? cl.user.email ?? cl.userId}
                    </h3>
                    <p className="text-[12px] text-muted">{cl.template.name} · Started {new Date(cl.startDate).toLocaleDateString()}</p>
                  </div>
                  <StatusChip status={cl.statusCode} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[12px] font-semibold text-muted w-12 text-right">{done}/{total}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
                  <Activity size={10} /> {progress}% complete
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {templatesOpen && (
        <TemplateManagerModal
          scope="onboarding"
          actorUserId={actorUserId}
          onClose={() => { setTemplatesOpen(false); void reload(); }}
        />
      )}
    </div>
  );
};

export default OnboardingPage;
