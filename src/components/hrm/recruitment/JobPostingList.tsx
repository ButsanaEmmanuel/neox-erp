// HRM-2.1 — Compact panel listing job postings, with a filter
// callback so the parent kanban can scope candidates to a posting.

import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, RefreshCw, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { recruitmentApi, type JobPostingSummary } from '../../../services/recruitmentApi';
import type { Department } from '../../../types/hrm';

interface JobPostingListProps {
  actorUserId: string;
  departments: Department[];
  canManage: boolean;
  selectedPostingId: string | null;
  onSelectPosting: (id: string | null) => void;
}

const STATUS_COLOR: Record<string, string> = {
  draft:  'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30',
  open:   'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  closed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  filled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30',
};

const JobPostingList: React.FC<JobPostingListProps> = ({ actorUserId, departments, canManage, selectedPostingId, onSelectPosting }) => {
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error') => toast?.addToast(msg, type);
  const [postings, setPostings] = useState<JobPostingSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Editor state
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [statusCode, setStatusCode] = useState<'draft' | 'open'>('open');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await recruitmentApi.listPostings();
      setPostings(r.postings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load postings');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !departmentId || !description.trim()) return;
    try {
      await recruitmentApi.createPosting({
        title: title.trim(),
        departmentId,
        description: description.trim(),
        requirements: requirements.trim() || undefined,
        statusCode,
      }, actorUserId);
      notify('Job posting created', 'success');
      setCreating(false);
      setTitle(''); setDescription(''); setRequirements(''); setStatusCode('open');
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Create failed', 'error');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface/40 backdrop-blur-sm p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-muted" />
          <span className="text-[13px] font-semibold text-primary">
            Job postings {postings ? `(${postings.length})` : ''}
          </span>
          {selectedPostingId && (
            <button
              type="button"
              onClick={() => onSelectPosting(null)}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300 hover:bg-emerald-500/20"
            >
              filtered <X size={10} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-secondary hover:bg-border"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[12px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90"
            >
              <Plus size={12} /> New
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !postings ? (
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0,1,2,3].map((i) => <div key={i} className="h-10 animate-pulse rounded-md border border-border/60 bg-surface/40" />)}
        </div>
      ) : postings && postings.length === 0 ? (
        <p className="px-2 py-3 text-center text-[12px] text-muted">No job posting yet.</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {postings?.map((p) => {
            const isSelected = selectedPostingId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPosting(isSelected ? null : p.id)}
                className={`group flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 text-primary'
                    : 'border-border bg-surface text-secondary hover:bg-border'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-primary">{p.title}</span>
                  <span className="block truncate text-[10px] text-muted">
                    {p.department.name} · {p._count?.candidates ?? 0} cand
                  </span>
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${STATUS_COLOR[p.statusCode] ?? ''}`}>
                  {p.statusCode}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal
          isOpen={true}
          onClose={() => setCreating(false)}
          title="New job posting"
          footer={
            <>
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-border">Cancel</button>
              <button
                type="button"
                disabled={!title.trim() || !departmentId || !description.trim()}
                onClick={handleCreate}
                className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create posting
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-muted">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold uppercase text-muted">Department *</label>
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none">
                  <option value="">— select —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold uppercase text-muted">Status</label>
                <select value={statusCode} onChange={(e) => setStatusCode(e.target.value as 'draft' | 'open')} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none">
                  <option value="open">open</option>
                  <option value="draft">draft</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-muted">Description *</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-muted">Requirements</label>
              <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-emerald-500/50 focus:outline-none" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default JobPostingList;
