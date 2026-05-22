import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, Transition } from '@headlessui/react';
import {
  Flag,
  Plus,
  Edit2,
  Trash2,
  Link2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useProjectStore } from '../../store/pm/useProjectStore';
import Modal from '../ui/Modal';
import ProfessionalEmptyState from '../ui/ProfessionalEmptyState';
import { ApiError } from '../../lib/apiClient';
import type { Milestone, MilestoneStatus } from '../../types/pm';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const STATUS_STYLES: Record<MilestoneStatus, { chip: string; dot: string }> = {
  planned: {
    chip: 'text-muted bg-surface border-border/60',
    dot: 'bg-muted',
  },
  in_progress: {
    chip: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  done: {
    chip: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  blocked: {
    chip: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    dot: 'bg-rose-400',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isoToInputDate(iso: string): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

function statusLabel(s: MilestoneStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function StatusBadge({ status, className = '' }: { status: MilestoneStatus; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.chip} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {statusLabel(status)}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const MilestonesPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const milestonesByProject = useProjectStore((s) => s.milestones);
  const loadingByProject = useProjectStore((s) => s.milestonesLoading);
  const fetchProjectMilestones = useProjectStore((s) => s.fetchProjectMilestones);
  const createMilestone = useProjectStore((s) => s.createMilestone);
  const updateMilestone = useProjectStore((s) => s.updateMilestone);
  const deleteMilestone = useProjectStore((s) => s.deleteMilestone);
  const projectMembersByProject = useProjectStore((s) => s.projectMembers);
  const fetchProjectMembers = useProjectStore((s) => s.fetchProjectMembers);

  const milestones = id ? (milestonesByProject[id] ?? []) : [];
  const loading = id ? Boolean(loadingByProject[id]) : false;
  const loaded = id ? Boolean(milestonesByProject[id]) : false;
  const members = id ? (projectMembersByProject[id] ?? []) : [];

  const [editing, setEditing] = useState<Milestone | 'new' | null>(null);
  const [depsModalFor, setDepsModalFor] = useState<Milestone | null>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBlockers, setDeleteBlockers] = useState<Array<{ id: string; title: string }> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (id && !milestonesByProject[id]) {
      fetchProjectMilestones(id).catch((err) => setErrorMsg(err?.message ?? 'Failed to load milestones'));
    }
    if (id && !projectMembersByProject[id]) {
      fetchProjectMembers(id).catch(() => { /* members optional */ });
    }
  }, [id]);

  const counts = useMemo(() => {
    const c = { planned: 0, in_progress: 0, done: 0, blocked: 0 };
    for (const m of milestones) c[m.status] += 1;
    return c;
  }, [milestones]);

  if (!id) {
    return <div className="p-8 text-sm text-muted">Select a project to view milestones.</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none border-b border-border/60 bg-card/70 backdrop-blur-sm px-8 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Flag size={20} className="text-blue-400" />
            <h1 className="text-xl font-semibold text-primary tracking-tight">Milestones</h1>
          </div>
          {loaded && milestones.length > 0 && (
            <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted">
              <span>{milestones.length} total</span>
              <span className="text-border">·</span>
              <span>{counts.in_progress} active</span>
              <span className="text-border">·</span>
              <span>{counts.done} done</span>
              {counts.blocked > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-rose-400">{counts.blocked} blocked</span>
                </>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand text-brand-fg text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Milestone
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Error banner */}
          {errorMsg && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[13px] flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 flex-none" />
              <div className="flex-1">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-300/70 hover:text-rose-300">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && !loaded && (
            <div className="flex items-center justify-center py-24 text-muted">
              <Loader2 size={20} className="animate-spin mr-3" />
              <span className="text-sm">Loading milestones…</span>
            </div>
          )}

          {/* Empty */}
          {loaded && milestones.length === 0 && (
            <ProfessionalEmptyState
              icon={Flag}
              title="No Milestones Yet"
              description="Create your first milestone to mark a key date or deliverable for this project."
              action={{
                label: 'Create Milestone',
                onClick: () => setEditing('new'),
                icon: Plus,
              }}
            />
          )}

          {/* Timeline */}
          {loaded && milestones.length > 0 && (
            <ol className="relative pl-8">
              {/* Rail vertical */}
              <div className="absolute left-2 top-1.5 bottom-1.5 w-px bg-border/60" aria-hidden />

              <AnimatePresence initial={false}>
                {milestones.map((m) => (
                  <motion.li
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="relative mb-5 last:mb-0"
                  >
                    {/* Dot */}
                    <span
                      className={`absolute -left-[26px] top-3.5 h-3 w-3 rounded-full ring-4 ring-app ${STATUS_STYLES[m.status].dot}`}
                      aria-hidden
                    />
                    <MilestoneCard
                      milestone={m}
                      members={members}
                      onEdit={() => setEditing(m)}
                      onDelete={() => { setDeleting(m); setDeleteError(null); }}
                      onShowDeps={() => setDepsModalFor(m)}
                      onCommitCompletion={async (pct) => {
                        try {
                          await updateMilestone(id, m.id, { completionPct: pct });
                        } catch (err) {
                          setErrorMsg(err instanceof Error ? err.message : 'Update failed');
                        }
                      }}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {editing && (
        <MilestoneFormModal
          mode={editing === 'new' ? 'create' : 'edit'}
          initial={editing === 'new' ? null : editing}
          allMilestones={milestones}
          members={members}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            try {
              if (editing === 'new') {
                await createMilestone(id, data);
              } else {
                await updateMilestone(id, editing.id, data);
              }
              setEditing(null);
            } catch (err) {
              const msg = err instanceof ApiError
                ? `${err.message}${err.payload && typeof err.payload === 'object' && 'code' in err.payload ? ` [${(err.payload as { code?: string }).code}]` : ''}`
                : err instanceof Error ? err.message : 'Save failed';
              throw new Error(msg);
            }
          }}
        />
      )}

      {/* Deps modal */}
      {depsModalFor && (
        <DependenciesModal
          milestone={depsModalFor}
          onClose={() => setDepsModalFor(null)}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <DeleteMilestoneModal
          milestone={deleting}
          error={deleteError}
          blockers={deleteBlockers}
          onClose={() => { setDeleting(null); setDeleteError(null); setDeleteBlockers(null); }}
          onConfirm={async () => {
            try {
              await deleteMilestone(id, deleting.id);
              setDeleting(null);
              setDeleteError(null);
              setDeleteBlockers(null);
            } catch (err) {
              // D14 — extract structured blockers[] from ApiError payload when present.
              if (err instanceof ApiError && err.payload && typeof err.payload === 'object') {
                const p = err.payload as { code?: string; blockers?: Array<{ id: string; title: string }> };
                if (p.code === 'MILESTONE_BLOCKED' && Array.isArray(p.blockers)) {
                  setDeleteBlockers(p.blockers);
                  setDeleteError(err.message);
                  return;
                }
              }
              const msg = err instanceof Error ? err.message : 'Delete failed';
              setDeleteError(msg);
              setDeleteBlockers(null);
            }
          }}
        />
      )}

      {/* Hidden navigation guard */}
      <button onClick={() => navigate(`/pm/projects/${id}/overview`)} className="hidden" aria-hidden />
    </div>
  );
};

// ── Card ───────────────────────────────────────────────────────────────────

interface MemberLike { userId: string; userName: string }

const MilestoneCard: React.FC<{
  milestone: Milestone;
  members: MemberLike[];
  onEdit: () => void;
  onDelete: () => void;
  onShowDeps: () => void;
  onCommitCompletion: (pct: number) => Promise<void>;
}> = ({ milestone, members, onEdit, onDelete, onShowDeps, onCommitCompletion }) => {
  const owner = members.find((u) => u.userId === milestone.ownerId);
  const due = milestone.dueDate ? new Date(milestone.dueDate) : null;
  const overdue = due && milestone.status !== 'done' && due.getTime() < Date.now();
  const depsCount = milestone.dependencies?.length ?? 0;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-semibold text-primary truncate">{milestone.title}</h3>
            <StatusBadge status={milestone.status} />
            {overdue && (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                <AlertCircle size={12} /> Overdue
              </span>
            )}
          </div>
          {milestone.description && (
            <p className="mt-1.5 text-[13px] text-secondary line-clamp-2">{milestone.description}</p>
          )}
          <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
            {due && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} />
                {format(due, 'MMM d, yyyy')}
                <span className="text-border">·</span>
                <span>{formatDistanceToNow(due, { addSuffix: true })}</span>
              </span>
            )}
            {owner && (
              <span className="inline-flex items-center gap-1.5">
                <User size={12} />
                {owner.userName}
              </span>
            )}
            {depsCount > 0 && (
              <button
                onClick={onShowDeps}
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Link2 size={12} />
                depends on {depsCount}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-none">
          <CompletionPopover value={milestone.completionPct} onCommit={onCommitCompletion} />
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface transition-colors"
            aria-label="Edit milestone"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            aria-label="Delete milestone"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            milestone.status === 'done' ? 'bg-emerald-400' : milestone.status === 'blocked' ? 'bg-rose-400' : 'bg-blue-400'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, milestone.completionPct))}%` }}
        />
      </div>
    </div>
  );
};

// ── Completion Popover ────────────────────────────────────────────────────

const CompletionPopover: React.FC<{
  value: number;
  onCommit: (pct: number) => Promise<void>;
}> = ({ value, onCommit }) => {
  const [draft, setDraft] = useState<number>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <Popover.Button className="px-2 py-1 rounded-md text-[12px] font-medium text-secondary bg-surface hover:bg-surface/60 border border-border/60 hover:border-border transition-colors min-w-[44px]">
            {value}%
          </Popover.Button>
          <Transition
            as={React.Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute right-0 mt-2 z-30 w-56 bg-popover border border-border/60 rounded-lg shadow-2xl p-3">
              <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Completion %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={draft}
                  onChange={(e) => setDraft(Number(e.target.value))}
                  className="flex-1 bg-surface border border-border/60 rounded-md px-2 py-1.5 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
                />
                <button
                  onClick={async () => {
                    const pct = Math.max(0, Math.min(100, Math.round(draft)));
                    setSaving(true);
                    try {
                      await onCommit(pct);
                      close();
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || draft === value}
                  className="px-2.5 py-1.5 rounded-md bg-brand text-brand-fg text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

// ── Form Modal (Create / Edit) ────────────────────────────────────────────

interface MilestoneFormData {
  title: string;
  dueDate: string;
  description?: string;
  status: MilestoneStatus;
  ownerId: string | null;
  completionPct: number;
  dependsOnIds: string[];
}

const MilestoneFormModal: React.FC<{
  mode: 'create' | 'edit';
  initial: Milestone | null;
  allMilestones: Milestone[];
  members: MemberLike[];
  onClose: () => void;
  onSubmit: (data: Partial<MilestoneFormData> & { title: string; dueDate: string }) => Promise<void>;
}> = ({ mode, initial, allMilestones, members, onClose, onSubmit }) => {
  const [form, setForm] = useState<MilestoneFormData>({
    title: initial?.title ?? '',
    dueDate: initial?.dueDate ? isoToInputDate(initial.dueDate) : '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'planned',
    ownerId: initial?.ownerId ?? null,
    completionPct: initial?.completionPct ?? 0,
    dependsOnIds: initial?.dependencies?.map((d) => d.dependsOnId) ?? [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = form.title.trim().length > 0 && form.dueDate.length > 0 && !submitting;

  const dependencyCandidates = allMilestones.filter((m) => m.id !== initial?.id);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const dueIso = new Date(form.dueDate).toISOString();
      const payload = {
        title: form.title.trim(),
        dueDate: dueIso,
        description: form.description?.trim() || undefined,
        status: form.status,
        ownerId: form.ownerId,
        completionPct: form.completionPct,
        dependsOnIds: form.dependsOnIds,
      };
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'create' ? 'New Milestone' : 'Edit Milestone'}
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-secondary hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-brand text-brand-fg text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-none" />
            <span>{submitError}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Phase 1 Kickoff"
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Due date *</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as MilestoneStatus })}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Owner</label>
            <select
              value={form.ownerId ?? ''}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value || null })}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
            >
              <option value="">— None —</option>
              {members.map((u) => (
                <option key={u.userId} value={u.userId}>{u.userName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Completion %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.completionPct}
              onChange={(e) => setForm({ ...form, completionPct: Number(e.target.value) })}
              className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Optional context for this milestone"
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-400/60 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] text-muted mb-1.5 uppercase tracking-wider">
            Depends on ({form.dependsOnIds.length})
          </label>
          {dependencyCandidates.length === 0 ? (
            <p className="text-[12px] text-muted italic">No other milestones available.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto bg-surface border border-border/60 rounded-md p-2 space-y-1">
              {dependencyCandidates.map((m) => {
                const checked = form.dependsOnIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-card/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.dependsOnIds, m.id]
                          : form.dependsOnIds.filter((x) => x !== m.id);
                        setForm({ ...form, dependsOnIds: next });
                      }}
                      className="rounded border-border/60 bg-app text-blue-400 focus:ring-blue-400/40"
                    />
                    <span className="text-[13px] text-primary flex-1 truncate">{m.title}</span>
                    <StatusBadge status={m.status} />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ── Dependencies Modal (read-only) ────────────────────────────────────────

const DependenciesModal: React.FC<{
  milestone: Milestone;
  onClose: () => void;
}> = ({ milestone, onClose }) => {
  const deps = milestone.dependencies ?? [];
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Dependencies of "${milestone.title}"`}
      size="sm"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-secondary hover:bg-surface transition-colors"
        >
          Close
        </button>
      }
    >
      {deps.length === 0 ? (
        <p className="text-[13px] text-muted">This milestone has no dependencies.</p>
      ) : (
        <ul className="space-y-2">
          {deps.map((d) => (
            <li key={d.dependsOnId} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface border border-border/60">
              <div className="min-w-0">
                <div className="text-[13px] text-primary truncate">{d.dependsOn.title}</div>
                {d.dependsOn.dueDate && (
                  <div className="text-[11px] text-muted mt-0.5">
                    Due {format(new Date(d.dependsOn.dueDate), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
              <StatusBadge status={d.dependsOn.status} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

// ── Delete Modal (with blockers from 409) ─────────────────────────────────

const DeleteMilestoneModal: React.FC<{
  milestone: Milestone;
  error: string | null;
  blockers: Array<{ id: string; title: string }> | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ milestone, error, blockers, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  // D14 — prefer the structured blockers[] payload over message-sniffing.
  const isBlocked = (blockers?.length ?? 0) > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isBlocked ? 'Cannot delete milestone' : 'Delete milestone?'}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-secondary hover:bg-surface transition-colors"
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>
          {!isBlocked && (
            <button
              onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-rose-500 text-white text-[13px] font-medium disabled:opacity-50 hover:bg-rose-600 transition-colors inline-flex items-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Delete
            </button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[13px] text-secondary">
          <span className="font-medium text-primary">{milestone.title}</span> will be soft-deleted and hidden from the timeline.
        </p>
        {isBlocked ? (
          <>
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px] flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-none" />
              <span>
                Still blocks <strong>{blockers!.length}</strong> active milestone
                {blockers!.length > 1 ? 's' : ''}:
              </span>
            </div>
            <ul className="space-y-1.5 pl-1">
              {blockers!.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface border border-border/60 text-[12px] text-primary"
                >
                  <Link2 size={12} className="text-muted flex-none" />
                  <span className="truncate">{b.title}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-muted">
              Remove or reassign these dependents first, then try again.
            </p>
          </>
        ) : error ? (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px] flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-none" />
            <span className="break-words">{error}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default MilestonesPage;
