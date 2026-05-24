// HRM-1.5 — Admin CRUD for leave policies.

import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Save } from 'lucide-react';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { leaveApi, type LeavePolicy } from '../../../services/leaveApi';

interface LeavePolicyManagerProps {
  actorUserId: string;
}

interface EditorState {
  mode: 'create' | 'edit';
  policy: Partial<LeavePolicy>;
}

const EMPTY_POLICY: Partial<LeavePolicy> = {
  name: '',
  leaveType: 'annual',
  daysPerYear: 0,
  carryOverMax: 0,
  requiresApproval: true,
  noticeDays: 0,
  isActive: true,
};

const LeavePolicyManager: React.FC<LeavePolicyManagerProps> = ({ actorUserId }) => {
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error') => toast?.addToast(msg, type);
  const [policies, setPolicies] = useState<LeavePolicy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await leaveApi.listPolicies(true);
      setPolicies(r.policies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const handleSave = async () => {
    if (!editor) return;
    setSubmitting(true);
    try {
      if (editor.mode === 'create') {
        await leaveApi.createPolicy(editor.policy, actorUserId);
        notify('Policy created', 'success');
      } else {
        await leaveApi.updatePolicy(String(editor.policy.id), editor.policy, actorUserId);
        notify('Policy updated', 'success');
      }
      setEditor(null);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: LeavePolicy) => {
    if (!confirm(`Archive policy "${p.name}"? It will no longer accept new requests.`)) return;
    try {
      await leaveApi.deletePolicy(p.id, actorUserId);
      notify('Policy archived', 'success');
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const patch = (data: Partial<LeavePolicy>) => setEditor((s) => (s ? { ...s, policy: { ...s.policy, ...data } } : s));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-primary">
          Leave policies {policies ? `(${policies.length})` : ''}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-secondary hover:bg-border"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setEditor({ mode: 'create', policy: { ...EMPTY_POLICY } })}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
          >
            <Plus size={14} /> New policy
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !policies ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/40" />
          ))}
        </div>
      ) : policies && policies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/30 p-8 text-center text-[13px] text-muted">
          No policy yet. Create one to start accepting leave requests.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {policies?.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border p-4 transition-colors ${
                p.isDeleted ? 'border-border/40 bg-surface/40 opacity-60' : 'border-border/60 bg-card/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-primary">{p.name}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted">
                    {p.leaveType} · {Number(p.daysPerYear)} d/y · carryover {Number(p.carryOverMax)}
                    {p.requiresApproval ? ' · approval required' : ' · auto-approve'}
                    {p.noticeDays > 0 ? ` · ${p.noticeDays}d notice` : ''}
                    {!p.isActive ? ' · INACTIVE' : ''}
                    {p.isDeleted ? ' · ARCHIVED' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={p.isDeleted}
                    onClick={() => setEditor({ mode: 'edit', policy: { ...p, daysPerYear: Number(p.daysPerYear), carryOverMax: Number(p.carryOverMax) } })}
                    className="rounded-md border border-border bg-surface p-1.5 text-secondary hover:bg-border disabled:opacity-40"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={p.isDeleted}
                    onClick={() => handleDelete(p)}
                    className="rounded-md border border-border bg-surface p-1.5 text-secondary hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
                    title="Archive"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <Modal
          isOpen={true}
          onClose={() => setEditor(null)}
          title={editor.mode === 'create' ? 'New leave policy' : 'Edit leave policy'}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-border"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !editor.policy.name?.trim()}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Save size={14} /> {submitting ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Name *</span>
                <input
                  type="text"
                  value={editor.policy.name ?? ''}
                  onChange={(e) => patch({ name: e.target.value })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Type</span>
                <select
                  value={editor.policy.leaveType ?? 'annual'}
                  onChange={(e) => patch({ leaveType: e.target.value })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="annual">annual</option>
                  <option value="sick">sick</option>
                  <option value="unpaid">unpaid</option>
                  <option value="maternity">maternity</option>
                  <option value="paternity">paternity</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Days per year</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={Number(editor.policy.daysPerYear ?? 0)}
                  onChange={(e) => patch({ daysPerYear: Number(e.target.value) })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Carry-over max</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={Number(editor.policy.carryOverMax ?? 0)}
                  onChange={(e) => patch({ carryOverMax: Number(e.target.value) })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Notice days</span>
                <input
                  type="number"
                  min={0}
                  value={Number(editor.policy.noticeDays ?? 0)}
                  onChange={(e) => patch({ noticeDays: Number(e.target.value) })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted">Active</span>
                <select
                  value={editor.policy.isActive === false ? 'no' : 'yes'}
                  onChange={(e) => patch({ isActive: e.target.value === 'yes' })}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              <input
                type="checkbox"
                checked={editor.policy.requiresApproval !== false}
                onChange={(e) => patch({ requiresApproval: e.target.checked })}
                className="accent-emerald-600"
              />
              Requires manager approval
            </label>
          </div>
        </Modal>
      )}
    </section>
  );
};

export default LeavePolicyManager;
