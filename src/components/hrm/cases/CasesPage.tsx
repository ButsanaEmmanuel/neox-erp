// HRM-2.4 — Cases page on the new DB-driven API.
//
// Self-service: a user with hrm.cases.read but without
// hrm.cases.execute sees only cases they reported or are assigned to;
// hrm.cases.execute unlocks the global list + lifecycle buttons
// (escalate / close). hrm.cases.write is required to open a new case
// and to add notes.
//
// Migrated off the deprecated can() shim (6/10 — bundled with
// PoliciesPage in this commit).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, AlertTriangle, MessageSquare, RefreshCw, ArrowRight, X } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import DataTable, { Column } from '../../ui/DataTable';
import StatusChip from '../../ui/StatusChip';
import Drawer from '../../ui/Drawer';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import {
  casesApi,
  type CaseRow,
  type CaseDetail,
  type CaseStatus,
  type CaseType,
  type CasePriority,
} from '../../../services/casesApi';
import { fetchAssignableEmployees, type AssignableEmployee } from '../../../services/assignablesApi';

const CASE_TYPES: CaseType[] = ['grievance', 'incident', 'disciplinary', 'inquiry'];
const PRIORITIES: CasePriority[] = ['low', 'medium', 'high'];

const NEXT_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open:          ['investigating', 'escalated', 'resolved'],
  investigating: ['resolved', 'escalated'],
  resolved:      ['closed', 'investigating'],
  escalated:     ['investigating', 'resolved', 'closed'],
  closed:        [],
};

const CasesPage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const actorUserId = user?.id ?? '';
  const canRead    = isReady && has('hrm.cases.read');
  const canWrite   = isReady && has('hrm.cases.write');
  const canExecute = isReady && has('hrm.cases.execute');

  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [newNote, setNewNote] = useState('');

  const reload = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await casesApi.list({
        actorUserId,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setCases(r.cases);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [actorUserId, statusFilter]);

  useEffect(() => { void reload(); }, [reload]);

  const reloadDetail = useCallback(async (id: string) => {
    try {
      const r = await casesApi.get(id, actorUserId);
      setDetail(r.case);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to load case', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorUserId]);

  const openCase = useCallback((row: CaseRow) => {
    setDrawerOpen(true);
    setDetail(null);
    void reloadDetail(row.id);
  }, [reloadDetail]);

  const onTransition = useCallback(async (id: string, next: CaseStatus, note?: string) => {
    try {
      if (next === 'escalated') await casesApi.escalate(id, note, actorUserId);
      else if (next === 'closed') await casesApi.close(id, note, actorUserId);
      else await casesApi.changeStatus(id, next, note, actorUserId);
      notify(`Case → ${next.replace('_', ' ')}`);
      await Promise.all([reload(), reloadDetail(id)]);
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string; from?: string; to?: string }; message?: string };
      if (err?.payload?.code === 'ILLEGAL_TRANSITION') {
        notify(`Illegal transition ${err.payload.from} → ${err.payload.to}`, 'error');
      } else if (err?.payload?.code === 'NOT_AUTHORIZED_FOR_STATUS_CHANGE') {
        notify('You must be the case assignee or have hrm.cases.execute', 'error');
      } else {
        notify(err?.message || 'Status change failed', 'error');
      }
    }
  }, [actorUserId, reload, reloadDetail]);

  const addNote = useCallback(async () => {
    if (!detail || !newNote.trim()) return;
    try {
      await casesApi.addNote(detail.id, newNote.trim(), actorUserId);
      setNewNote('');
      notify('Note added');
      await reloadDetail(detail.id);
    } catch (e) { notify(e instanceof Error ? e.message : 'Add note failed', 'error'); }
  }, [detail, newNote, actorUserId, reloadDetail]);

  const columns: Column<CaseRow>[] = useMemo(() => [
    {
      key: 'title', header: 'Case', width: '2fr', sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-primary truncate">{row.title}</div>
          <div className="text-[11px] text-muted truncate">{row.caseType} · {row.description}</div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', width: '90px', render: (row) => <StatusChip status={row.priority} /> },
    { key: 'status',   header: 'Status',   width: '110px', render: (row) => <StatusChip status={row.statusCode} /> },
    {
      key: 'assignee', header: 'Assignee', width: '1fr',
      render: (row) => (
        <span className="text-[13px] text-secondary">
          {row.assignee?.name ?? row.assignee?.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'date', header: 'Created', width: '110px',
      render: (row) => <span className="text-[12px] text-muted">{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
  ], []);

  if (isReady && !canRead) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Employee Cases" subtitle="Access restricted" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle size={40} className="text-amber-500 mx-auto mb-3" />
            <p className="text-[15px] text-primary font-semibold">Access Restricted</p>
            <p className="text-[13px] text-muted mt-1">You need the hrm.cases.read permission to view cases.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Employee Cases"
        subtitle={
          cases === null ? 'Loading…' :
          canExecute ? `${cases.length} case${cases.length === 1 ? '' : 's'} (global view)` :
                       `${cases.length} case${cases.length === 1 ? '' : 's'} (your cases)`
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-[12px] text-secondary hover:bg-surface">
              <RefreshCw size={13} /> Refresh
            </button>
            {canWrite && (
              <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
                <Plus size={15} /> New Case
              </button>
            )}
          </div>
        }
      />

      <div className="flex-none px-6 py-3 flex items-center gap-3 border-b border-border/60">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | CaseStatus)} className="px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => void reload()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && cases === null ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg border border-border/60 bg-card/40" />)}
          </div>
        ) : (cases ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-muted" />
            </div>
            <p className="text-[15px] font-semibold text-muted">No cases</p>
            <p className="text-[13px] text-muted mt-1">
              {canWrite ? 'Click + New Case to open one.' : 'Your HR team will surface cases here.'}
            </p>
          </div>
        ) : (
          <DataTable columns={columns} data={cases ?? []} keyExtractor={(r) => r.id} onRowClick={openCase} emptyTitle="No cases" />
        )}
      </div>

      <Drawer isOpen={drawerOpen} onClose={() => { setDrawerOpen(false); setDetail(null); }} title={detail?.title || 'Case'} width="max-w-md">
        {!detail ? (
          <div className="p-6 space-y-3">
            {[0,1,2].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg border border-border/60 bg-card/40" />)}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between items-center"><span className="text-muted">Type</span><span className="text-primary capitalize">{detail.caseType}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted">Priority</span><StatusChip status={detail.priority} /></div>
              <div className="flex justify-between items-center"><span className="text-muted">Status</span><StatusChip status={detail.statusCode} /></div>
              <div className="flex justify-between items-center"><span className="text-muted">Reporter</span><span className="text-primary">{detail.reporter.name ?? detail.reporter.email}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted">Assignee</span><span className="text-primary">{detail.assignee?.name ?? detail.assignee?.email ?? '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted">Created</span><span className="text-primary">{new Date(detail.createdAt).toLocaleDateString()}</span></div>
            </div>

            <div className="bg-surface rounded-xl border border-border/60 p-4">
              <p className="text-[13px] text-secondary whitespace-pre-wrap">{detail.description}</p>
            </div>

            {/* Transitions */}
            {NEXT_TRANSITIONS[detail.statusCode].length > 0 && (
              <div className="flex flex-wrap gap-2">
                {NEXT_TRANSITIONS[detail.statusCode].map((next) => {
                  // Escalate + close require execute. Others go through /status
                  // which the service accepts for assignees too.
                  const isPrivileged = next === 'escalated' || next === 'closed';
                  const visible = isPrivileged ? canExecute : (canWrite || canExecute || detail.assignedToUserId === actorUserId);
                  if (!visible) return null;
                  return (
                    <button
                      key={next}
                      onClick={() => void onTransition(detail.id, next)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-input rounded-lg text-[12px] font-semibold text-secondary hover:bg-surface"
                    >
                      <ArrowRight size={11} /> {next.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            )}

            {/* History */}
            <div>
              <h4 className="text-[13px] font-semibold text-primary mb-3 flex items-center gap-2">
                <MessageSquare size={14} /> History ({detail.events.length})
              </h4>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="bg-surface rounded-lg p-3 border border-border/60">
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span className="font-semibold text-secondary">
                        {ev.author?.name ?? ev.author?.email ?? ev.authorUserId}
                      </span>
                      <span className="text-muted">{new Date(ev.createdAt).toLocaleString()}</span>
                    </div>
                    {ev.eventType === 'status_change' ? (
                      <p className="text-[12px] text-secondary">
                        <span className="inline-flex items-center gap-1">
                          {ev.fromStatus ?? '—'} <ArrowRight size={10} /> {ev.toStatus}
                        </span>
                        {ev.note && <span className="block text-muted mt-1">{ev.note}</span>}
                      </p>
                    ) : (
                      <p className="text-[12px] text-secondary whitespace-pre-wrap">{ev.note}</p>
                    )}
                  </div>
                ))}
              </div>

              {canWrite && detail.statusCode !== 'closed' && (
                <div className="flex gap-2">
                  <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-2 bg-surface border border-input rounded-lg text-[12px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50" />
                  <button onClick={() => void addNote()} disabled={!newNote.trim()} className="px-3 py-2 bg-surface border border-input rounded-lg text-[12px] text-secondary hover:bg-surface font-medium disabled:opacity-50">Add</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {addOpen && (
        <AddCaseModal
          actorUserId={actorUserId}
          canAssign={canExecute}
          onClose={(refresh) => { setAddOpen(false); if (refresh) void reload(); }}
          notify={notify}
        />
      )}
    </div>
  );
};

interface AddCaseModalProps {
  actorUserId: string;
  canAssign: boolean;
  onClose: (refresh: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const AddCaseModal: React.FC<AddCaseModalProps> = ({ actorUserId, canAssign, onClose, notify }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseType, setCaseType] = useState<CaseType>('inquiry');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canAssign) return;
    void fetchAssignableEmployees().then(setEmployees);
  }, [canAssign]);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      notify('Title + description required', 'error'); return;
    }
    setSubmitting(true);
    try {
      await casesApi.create({
        title: title.trim(),
        description,
        caseType,
        priority,
        assignedToUserId: assignedToUserId || undefined,
      }, actorUserId);
      notify('Case opened');
      onClose(true);
    } catch (e) { notify(e instanceof Error ? e.message : 'Create failed', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal isOpen onClose={() => onClose(false)} title="New case" footer={
      <>
        <button onClick={() => onClose(false)} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-surface">Cancel</button>
        <button onClick={() => void submit()} disabled={submitting} className="px-4 py-2 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
          {submitting ? 'Opening…' : (<><X size={14} className="rotate-45" /> Create case</>)}
        </button>
      </>
    }>
      <div className="space-y-3">
        <label className="block">
          <span className="text-[12px] text-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] text-muted">Type</span>
            <select value={caseType} onChange={(e) => setCaseType(e.target.value as CaseType)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
              {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as CasePriority)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {canAssign && (
          <label className="block">
            <span className="text-[12px] text-muted">Assign to (optional)</span>
            <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
              <option value="">— Unassigned —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
            </select>
          </label>
        )}
      </div>
    </Modal>
  );
};

export default CasesPage;
