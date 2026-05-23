// HRM-2.2 — Template CRUD modal shared by OnboardingPage and
// OffboardingPage. Scope picks which API to hit.

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import {
  onboardingApi,
  offboardingApi,
  type TemplateSummary,
} from '../../../services/onboardingApi';

interface TemplateManagerModalProps {
  scope: 'onboarding' | 'offboarding';
  actorUserId: string;
  onClose: () => void;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ scope, actorUserId, onClose }) => {
  const api = scope === 'onboarding' ? onboardingApi : offboardingApi;
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);
  const { departments } = useHRMStore();

  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [tasks, setTasks] = useState<Array<{ title: string; assignedRole: string; isRequired: boolean; dueOffsetDays: number }>>([
    { title: '', assignedRole: 'employee', isRequired: true, dueOffsetDays: 0 },
  ]);

  const reload = useCallback(async () => {
    try {
      const r = await api.listTemplates({ includeInactive: true });
      setTemplates(r.templates);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to load templates', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createTemplate({
        name: name.trim(),
        departmentId: departmentId || undefined,
        isActive: true,
        tasks: tasks.filter((t) => t.title.trim()).map((t, i) => ({
          title: t.title.trim(),
          assignedRole: t.assignedRole,
          isRequired: t.isRequired,
          dueOffsetDays: Math.max(0, Number(t.dueOffsetDays) || 0),
          order: i,
        })),
      }, actorUserId);
      notify(`${scope === 'onboarding' ? 'Onboarding' : 'Offboarding'} template created`, 'success');
      setName(''); setDepartmentId('');
      setTasks([{ title: '', assignedRole: 'employee', isRequired: true, dueOffsetDays: 0 }]);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (t: TemplateSummary) => {
    if (!confirm(`Archive "${t.name}"?`)) return;
    try {
      await api.deleteTemplate(t.id, actorUserId);
      notify('Template archived', 'success');
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Archive failed', 'error');
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${scope === 'onboarding' ? 'Onboarding' : 'Offboarding'} templates`}
      size="lg"
      footer={
        <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-secondary bg-surface border border-input rounded-lg hover:bg-border">
          Done
        </button>
      }
    >
      <div className="space-y-4">
        <section>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Existing</h4>
          {!templates ? (
            <p className="text-[13px] text-muted">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-[13px] text-muted">No template yet.</p>
          ) : (
            <ul className="space-y-1">
              {templates.map((t) => (
                <li key={t.id} className={`flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[13px] ${t.isDeleted ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{t.name}</p>
                    <p className="text-[11px] text-muted">
                      {t.department?.name ?? 'Global'} · {t._count?.tasks ?? 0} tasks · {t._count?.checklists ?? 0} checklists
                      {!t.isActive && ' · INACTIVE'}{t.isDeleted && ' · ARCHIVED'}
                    </p>
                  </div>
                  {!t.isDeleted && (
                    <button
                      type="button"
                      onClick={() => handleArchive(t)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-secondary hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Archive
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Create new</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-brand/50 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">Department (optional)</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-md border border-input bg-surface px-3 py-2 text-[13px] text-primary focus:border-brand/50 focus:outline-none">
                <option value="">— global —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {tasks.map((t, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={t.title} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Task title…" className="col-span-5 rounded-md border border-input bg-surface px-2 py-1.5 text-[12px] text-primary focus:border-brand/50 focus:outline-none" />
                <select value={t.assignedRole} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, assignedRole: e.target.value } : x)))} className="col-span-3 rounded-md border border-input bg-surface px-2 py-1.5 text-[12px] text-primary focus:border-brand/50 focus:outline-none">
                  <option value="employee">employee</option>
                  <option value="manager">manager</option>
                  <option value="hr">hr</option>
                  <option value="it">it</option>
                </select>
                <input type="number" min={0} value={t.dueOffsetDays} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, dueOffsetDays: Number(e.target.value) } : x)))} className="col-span-2 rounded-md border border-input bg-surface px-2 py-1.5 text-[12px] text-primary focus:border-brand/50 focus:outline-none" title="Due offset days" />
                <label className="col-span-2 flex items-center gap-1 text-[11px] text-muted">
                  <input type="checkbox" checked={t.isRequired} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, isRequired: e.target.checked } : x)))} className="accent-brand" />
                  required
                </label>
              </div>
            ))}
            <button type="button" onClick={() => setTasks((arr) => [...arr, { title: '', assignedRole: 'employee', isRequired: true, dueOffsetDays: 0 }])} className="text-[11px] text-secondary hover:text-primary">
              + add task
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={handleCreate} disabled={creating || !name.trim()} className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed">
              {creating ? 'Creating…' : 'Create template'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default TemplateManagerModal;
