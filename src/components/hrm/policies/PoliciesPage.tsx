// HRM-2.4 — Policies page on the new DB-driven API.
//
// Two-tab shell:
//   - "À lire" (default) — published policies for the current user
//     with Lu / À signer badges and an Acknowledge action.
//   - "Admin" (visible iff hrm.policies.write) — full catalogue with
//     draft / publish / archive actions, gated by hrm.policies.execute
//     on the lifecycle buttons.
//
// Migrated off the deprecated can() shim (6/10 pages now on
// usePermissions: LeavePage + RecruitmentPage + OnboardingPage +
// OffboardingPage + TrainingPage + this one).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle, AlertCircle, Plus, RefreshCw, Send, Archive } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import Drawer from '../../ui/Drawer';
import Modal from '../../ui/Modal';
import StatusChip from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import { policiesApi, type PolicyRow, type PolicyStatus } from '../../../services/policiesApi';

type Tab = 'read' | 'admin';

const CATEGORIES = ['conduct', 'safety', 'leave', 'it', 'other'] as const;

const PoliciesPage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const actorUserId = user?.id ?? '';
  const canWrite   = isReady && has('hrm.policies.write');
  const canExecute = isReady && has('hrm.policies.execute');

  const [tab, setTab] = useState<Tab>('read');
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PolicyRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    try {
      // "À lire" tab — only published, ack-aware. "Admin" — full catalogue.
      const { policies: p } = await policiesApi.list(
        tab === 'read'
          ? { status: 'published', forUserId: actorUserId }
          : { forUserId: actorUserId },
      );
      setPolicies(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [actorUserId, tab]);

  useEffect(() => { void reload(); }, [reload]);

  const counts = useMemo(() => {
    const list = policies ?? [];
    const acknowledged = list.filter((p) => p.isAcknowledgedByMe).length;
    const pending = list.filter((p) => !p.isAcknowledgedByMe).length;
    return { acknowledged, pending };
  }, [policies]);

  const openDetail = useCallback(async (p: PolicyRow) => {
    setSelected(p);
    setDrawerOpen(true);
    // Refresh detail in the background — drawer renders from the row,
    // we only need the freshest ack state if the user just signed.
    try {
      const { policy } = await policiesApi.get(p.id, actorUserId);
      setSelected(policy);
    } catch { /* keep stale row in the drawer */ }
  }, [actorUserId]);

  const onAcknowledge = useCallback(async (p: PolicyRow) => {
    try {
      await policiesApi.acknowledge(p.id, actorUserId);
      notify('Policy acknowledged');
      await reload();
      // Refresh the drawer's row from the freshly reloaded list.
      setSelected((curr) => curr && curr.id === p.id ? { ...curr, isAcknowledgedByMe: true } : curr);
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string }; message?: string };
      if (err?.payload?.code === 'ALREADY_ACKNOWLEDGED') {
        notify('Already acknowledged', 'error');
      } else {
        notify(err?.message || 'Acknowledge failed', 'error');
      }
    }
  }, [actorUserId, reload]);

  const onPublish = useCallback(async (p: PolicyRow) => {
    try {
      await policiesApi.publish(p.id, actorUserId);
      notify('Policy published');
      await reload();
    } catch (e) { notify(e instanceof Error ? e.message : 'Publish failed', 'error'); }
  }, [actorUserId, reload]);

  const onArchive = useCallback(async (p: PolicyRow) => {
    try {
      await policiesApi.archive(p.id, actorUserId);
      notify('Policy archived');
      await reload();
    } catch (e) { notify(e instanceof Error ? e.message : 'Archive failed', 'error'); }
  }, [actorUserId, reload]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Policies & Acknowledgements"
        subtitle={
          tab === 'read'
            ? `${counts.acknowledged}/${(policies ?? []).length} acknowledged`
            : `${(policies ?? []).length} policies in catalogue`
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-[12px] text-secondary hover:bg-surface">
              <RefreshCw size={13} /> Refresh
            </button>
            {canWrite && tab === 'admin' && (
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90">
                <Plus size={14} /> New policy
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex-none px-6 pt-3 flex items-center gap-2 border-b border-border/60 bg-card">
        <button onClick={() => setTab('read')}
          className={`px-3 py-2 -mb-px text-[13px] font-medium border-b-2 transition-colors ${tab === 'read' ? 'border-emerald-500 text-primary' : 'border-transparent text-muted hover:text-secondary'}`}>
          À lire
        </button>
        {canWrite && (
          <button onClick={() => setTab('admin')}
            className={`px-3 py-2 -mb-px text-[13px] font-medium border-b-2 transition-colors ${tab === 'admin' ? 'border-emerald-500 text-primary' : 'border-transparent text-muted hover:text-secondary'}`}>
            Admin
          </button>
        )}
      </div>

      {/* Summary (read tab only) */}
      {tab === 'read' && (
        <div className="flex-none px-8 py-4 border-b border-border/60 flex gap-4">
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[12px] font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle size={14} /> {counts.acknowledged} Lu
          </div>
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[12px] font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle size={14} /> {counts.pending} À signer
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => void reload()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 space-y-3">
        {loading && policies === null ? (
          [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-card/40" />)
        ) : (policies ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
              <FileText size={28} className="text-muted" />
            </div>
            <p className="text-[15px] font-semibold text-muted">
              {tab === 'read' ? 'Aucune politique publiée à lire' : 'Aucune politique dans le catalogue'}
            </p>
            <p className="text-[13px] text-muted mt-1">
              {tab === 'read' ? 'Toutes les politiques publiées apparaîtront ici.' : canWrite ? 'Click + New policy to add one.' : 'Ask an HR admin to add policies.'}
            </p>
          </div>
        ) : (
          policies?.map((policy) => {
            const signed = Boolean(policy.isAcknowledgedByMe);
            return (
              <div key={policy.id}
                className="bg-card rounded-xl border border-border/60 p-5 flex items-center justify-between hover:border-border transition-all cursor-pointer group"
                onClick={() => void openDetail(policy)}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-none ${signed ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    <FileText size={18} className={signed ? 'text-emerald-400' : 'text-amber-400'} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-semibold text-primary group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                      {policy.title}
                      {tab === 'admin' && <StatusChip status={policy.statusCode} />}
                    </h4>
                    <p className="text-[12px] text-muted">
                      {policy.category} · v{policy.version}
                      {policy.publishedAt ? ` · Published ${new Date(policy.publishedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {tab === 'read' ? (
                    signed ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle size={12} /> Lu {policy.myAcknowledgedAt ? new Date(policy.myAcknowledgedAt).toLocaleDateString() : ''}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400">À signer</span>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {policy.statusCode === 'draft' && canExecute && (
                        <button onClick={() => void onPublish(policy)} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20">
                          <Send size={11} /> Publish
                        </button>
                      )}
                      {policy.statusCode === 'published' && canExecute && (
                        <button onClick={() => void onArchive(policy)} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/10 border border-slate-500/20 rounded text-[11px] font-semibold text-slate-400 hover:bg-slate-500/20">
                          <Archive size={11} /> Archive
                        </button>
                      )}
                      <span className="text-[11px] text-muted">{policy._count?.acknowledgements ?? 0} ack</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={selected?.title || 'Policy'} width="max-w-lg">
        {selected && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 text-[12px] text-muted flex-wrap">
              <StatusChip status={selected.statusCode} />
              <span>Version {selected.version}</span>
              <span>·</span>
              <span>{selected.category}</span>
              {selected.publishedAt && <><span>·</span><span>Published {new Date(selected.publishedAt).toLocaleDateString()}</span></>}
            </div>

            <div className="bg-app rounded-xl border border-border/60 p-5">
              <p className="text-[13px] text-secondary leading-relaxed whitespace-pre-wrap">{selected.content}</p>
            </div>

            {selected.statusCode === 'published' && !selected.isAcknowledgedByMe && (
              <button
                onClick={() => void onAcknowledge(selected)}
                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Acknowledge Policy
              </button>
            )}
            {selected.isAcknowledgedByMe && (
              <div className="text-center py-3 text-[13px] text-emerald-400 font-medium flex items-center justify-center gap-2">
                <CheckCircle size={16} /> You have acknowledged this policy
              </div>
            )}
          </div>
        )}
      </Drawer>

      {createOpen && (
        <CreatePolicyModal
          actorUserId={actorUserId}
          onClose={(refresh) => {
            setCreateOpen(false);
            if (refresh) void reload();
          }}
          notify={notify}
        />
      )}
    </div>
  );
};

interface CreatePolicyModalProps {
  actorUserId: string;
  onClose: (refresh: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({ actorUserId, onClose, notify }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PolicyStatus extends never ? string : string>('other');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('1.0');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) { notify('Title required', 'error'); return; }
    if (!content.trim()) { notify('Content required', 'error'); return; }
    setSubmitting(true);
    try {
      await policiesApi.create({ title: title.trim(), category, content, version }, actorUserId);
      notify('Policy created (draft)');
      onClose(true);
    } catch (e) { notify(e instanceof Error ? e.message : 'Create failed', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal isOpen onClose={() => onClose(false)} title="New policy">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[12px] text-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] text-muted">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Version</span>
            <input value={version} onChange={(e) => setVersion(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
          </label>
        </div>
        <label className="block">
          <span className="text-[12px] text-muted">Content (markdown or URL)</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none font-mono" />
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => onClose(false)} className="px-3 py-1.5 text-[13px] text-muted hover:text-secondary">Cancel</button>
          <button onClick={() => void submit()} disabled={submitting} className="px-3 py-1.5 bg-brand text-brand-fg rounded text-[13px] font-semibold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Create draft'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PoliciesPage;
