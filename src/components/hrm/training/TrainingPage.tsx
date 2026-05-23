// HRM-2.3 — Training page on the new DB-driven API.
//
// Two-tab shell:
//   - Enrollments (default) — list scoped by hrm.training.execute.
//     Without it the page falls back to the current user's enrollments
//     (self-service). With it, every enrollment is visible plus a
//     "+ Enroll" action.
//   - Courses                — catalogue. hrm.training.write gates the
//     "+ New course" action.
//
// Migrated off the deprecated can() shim (5/10 pages now on
// usePermissions: LeavePage + RecruitmentPage + OnboardingPage +
// OffboardingPage + this one).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Award, AlertTriangle, Plus, RefreshCw, X } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import DataTable, { Column } from '../../ui/DataTable';
import StatusChip from '../../ui/StatusChip';
import Modal from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../lib/rbac';
import {
  trainingApi,
  type CourseSummary,
  type EnrollmentRow,
  type EnrollmentStatus,
} from '../../../services/trainingApi';
import { fetchAssignableEmployees, type AssignableEmployee } from '../../../services/assignablesApi';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  Compliance: <AlertTriangle size={14} className="text-amber-400" />,
  Technical: <BookOpen size={14} className="text-blue-400" />,
  Leadership: <Award size={14} className="text-purple-400" />,
};

type Tab = 'enrollments' | 'courses';

const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const { has, isReady } = usePermissions();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const actorUserId = user?.id ?? '';
  const canExecute = isReady && has('hrm.training.execute');
  const canWrite   = isReady && has('hrm.training.write');
  const scope: 'self' | 'all' = canExecute ? 'all' : 'self';

  const [tab, setTab] = useState<Tab>('enrollments');
  const [enrollments, setEnrollments] = useState<EnrollmentRow[] | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EnrollmentStatus>('all');

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<EnrollmentRow | null>(null);

  const reload = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ enrollments: er }, { courses: cs }] = await Promise.all([
        trainingApi.listEnrollments(scope === 'self' ? { forUserId: actorUserId } : {}),
        trainingApi.listCourses({ includeInactive: canWrite }),
      ]);
      setEnrollments(er);
      setCourses(cs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [actorUserId, scope, canWrite]);

  useEffect(() => { void reload(); }, [reload]);

  const filteredEnrollments = useMemo(() => {
    if (!enrollments) return [];
    const needle = search.trim().toLowerCase();
    return enrollments.filter((r) => {
      const haystack = `${r.course.title} ${r.user.name ?? ''} ${r.user.email ?? ''}`.toLowerCase();
      const matchSearch = needle === '' || haystack.includes(needle);
      const matchStatus = statusFilter === 'all' || r.statusCode === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [enrollments, search, statusFilter]);

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    const needle = search.trim().toLowerCase();
    return courses.filter((c) =>
      needle === '' || `${c.title} ${c.provider ?? ''} ${c.category ?? ''}`.toLowerCase().includes(needle),
    );
  }, [courses, search]);

  const onComplete = useCallback((row: EnrollmentRow) => {
    setCompleteFor(row);
  }, []);

  const onCancel = useCallback(async (row: EnrollmentRow) => {
    if (!canExecute) {
      notify("Permission denied: hrm.training.execute required to cancel", 'error');
      return;
    }
    try {
      await trainingApi.cancel(row.id, {}, actorUserId);
      notify('Enrollment cancelled');
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Cancel failed', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorUserId, canExecute, reload]);

  // Columns — enrollments
  const enrollmentColumns: Column<EnrollmentRow>[] = [
    {
      key: 'course', header: 'Training', width: '2fr', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center flex-none">
            {(row.course.category && CATEGORY_ICON[row.course.category]) || <BookOpen size={14} className="text-muted" />}
          </div>
          <div>
            <div className="text-[13px] font-medium text-primary flex items-center gap-2">
              {row.course.title}
              {row.course.isMandatory && (
                <span className="text-[10px] uppercase tracking-wide text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">Mandatory</span>
              )}
            </div>
            <div className="text-[11px] text-muted">{row.course.category ?? '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'employee', header: 'Employee', width: '1fr',
      render: (row) => (
        <span className="text-muted text-[13px]">{row.user.name ?? row.user.email ?? row.userId}</span>
      ),
    },
    {
      key: 'due', header: 'Due', width: '110px',
      render: (row) => (
        <span className="text-muted text-[12px]">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</span>
      ),
    },
    { key: 'status', header: 'Status', width: '110px', render: (row) => <StatusChip status={row.statusCode} /> },
    {
      key: 'action', header: '', width: '180px', align: 'right',
      render: (row) => {
        if (row.statusCode === 'completed') {
          return (
            <span className="text-[11px] text-emerald-500 inline-flex items-center gap-1">
              <Award size={12} /> {row.score != null ? `${Number(row.score).toFixed(0)}%` : 'Done'}
            </span>
          );
        }
        if (row.statusCode === 'cancelled') {
          return <span className="text-[11px] text-muted">Cancelled</span>;
        }
        if (!canExecute) return <span className="text-[11px] text-muted">—</span>;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(row); }}
              className="px-2.5 py-1 bg-surface border border-input rounded text-[11px] font-medium text-secondary hover:bg-surface transition-colors"
            >
              Complete
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); void onCancel(row); }}
              className="px-2 py-1 text-[11px] font-medium text-muted hover:text-red-400 transition-colors"
              title="Cancel enrollment"
            >
              <X size={12} />
            </button>
          </div>
        );
      },
    },
  ];

  // Columns — courses
  const courseColumns: Column<CourseSummary>[] = [
    {
      key: 'title', header: 'Course', width: '2fr', sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center flex-none">
            {(row.category && CATEGORY_ICON[row.category]) || <BookOpen size={14} className="text-muted" />}
          </div>
          <div>
            <div className="text-[13px] font-medium text-primary flex items-center gap-2">
              {row.title}
              {row.isMandatory && (
                <span className="text-[10px] uppercase tracking-wide text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">Mandatory</span>
              )}
              {!row.isActive && (
                <span className="text-[10px] uppercase tracking-wide text-muted border border-input rounded px-1.5 py-0.5">Inactive</span>
              )}
            </div>
            <div className="text-[11px] text-muted">{row.category ?? row.provider ?? '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'provider', header: 'Provider', width: '1fr', render: (row) => <span className="text-muted text-[13px]">{row.provider ?? (row.isInternal ? 'Internal' : '—')}</span> },
    { key: 'duration', header: 'Hours', width: '90px', render: (row) => <span className="text-muted text-[12px]">{row.durationHours ?? '—'}</span> },
    { key: 'enrolled', header: 'Enrolled', width: '90px', render: (row) => <span className="text-muted text-[12px]">{row._count?.enrollments ?? 0}</span> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Training & Certifications"
        subtitle={
          enrollments === null
            ? 'Loading…'
            : tab === 'enrollments'
              ? `${enrollments.length} enrollment${enrollments.length === 1 ? '' : 's'}`
              : `${courses?.length ?? 0} course${(courses?.length ?? 0) === 1 ? '' : 's'}`
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void reload()} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-[12px] text-secondary hover:bg-surface" title="Refresh">
              <RefreshCw size={13} /> Refresh
            </button>
            {canExecute && tab === 'enrollments' && (
              <button onClick={() => setEnrollOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90">
                <Plus size={14} /> Enroll
              </button>
            )}
            {canWrite && tab === 'courses' && (
              <button onClick={() => setCourseOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 hover:bg-brand/90">
                <Plus size={14} /> New course
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex-none px-6 pt-3 flex items-center gap-2 border-b border-border/60 bg-card">
        {(['enrollments', 'courses'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px text-[13px] font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-emerald-500 text-primary'
                : 'border-transparent text-muted hover:text-secondary'
            }`}
          >
            {t === 'enrollments' ? 'Enrollments' : 'Courses'}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex-none px-6 py-3 flex items-center gap-3 border-b border-border/60 bg-card">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'enrollments' ? 'Search by course or employee…' : 'Search courses…'}
          className="flex-1 max-w-xs pl-3 pr-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50"
        />
        {tab === 'enrollments' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | EnrollmentStatus)}
            className="px-3 py-2 bg-surface border border-input rounded-lg text-[13px] text-secondary focus:outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="enrolled">Enrolled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
      </div>

      {error && (
        <div role="alert" className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => void reload()} className="rounded border border-red-500/30 px-2 py-0.5 text-[11px] hover:bg-red-500/10">Retry</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && enrollments === null ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg border border-border/60 bg-card/40" />
            ))}
          </div>
        ) : tab === 'enrollments' ? (
          filteredEnrollments.length === 0 ? (
            <EmptyState
              title={scope === 'self' ? 'No training assigned to you yet' : 'No enrollments'}
              hint={canExecute ? 'Click + Enroll to assign a course to an employee.' : 'Your HR team will assign trainings here.'}
            />
          ) : (
            <DataTable columns={enrollmentColumns} data={filteredEnrollments} keyExtractor={(r) => r.id} emptyTitle="No matching enrollments" />
          )
        ) : (
          filteredCourses.length === 0 ? (
            <EmptyState
              title="No courses in the catalogue"
              hint={canWrite ? 'Click + New course to add one.' : 'Ask an HR admin to add courses.'}
            />
          ) : (
            <DataTable columns={courseColumns} data={filteredCourses} keyExtractor={(r) => r.id} emptyTitle="No matching courses" />
          )
        )}
      </div>

      {enrollOpen && (
        <EnrollModal
          courses={(courses ?? []).filter((c) => c.isActive && !c.isDeleted)}
          actorUserId={actorUserId}
          onClose={(reloadIt) => {
            setEnrollOpen(false);
            if (reloadIt) void reload();
          }}
          notify={notify}
        />
      )}
      {courseOpen && (
        <CourseModal
          actorUserId={actorUserId}
          onClose={(reloadIt) => {
            setCourseOpen(false);
            if (reloadIt) void reload();
          }}
          notify={notify}
        />
      )}
      {completeFor && (
        <CompleteModal
          enrollment={completeFor}
          actorUserId={actorUserId}
          onClose={(reloadIt) => {
            setCompleteFor(null);
            if (reloadIt) void reload();
          }}
          notify={notify}
        />
      )}
    </div>
  );
};

// ---------- Sub-components ----------

const EmptyState: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="h-16 w-16 rounded-2xl bg-surface border border-input flex items-center justify-center mb-4">
      <BookOpen size={28} className="text-muted" />
    </div>
    <p className="text-[15px] font-semibold text-muted">{title}</p>
    <p className="text-[13px] text-muted mt-1">{hint}</p>
  </div>
);

interface EnrollModalProps {
  courses: CourseSummary[];
  actorUserId: string;
  onClose: (reload: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const EnrollModal: React.FC<EnrollModalProps> = ({ courses, actorUserId, onClose, notify }) => {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchAssignableEmployees().then(setEmployees);
  }, []);

  const submit = async () => {
    if (!targetUserId || !courseId) {
      notify('Pick an employee and a course', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await trainingApi.enroll({ targetUserId, courseId, dueDate: dueDate || undefined, notes: notes || undefined }, actorUserId);
      notify('Employee enrolled');
      onClose(true);
    } catch (e: unknown) {
      const err = e as { payload?: { code?: string; currentStatus?: string }; message?: string };
      if (err?.payload?.code === 'ALREADY_ENROLLED') {
        notify(`Already enrolled (status: ${err.payload.currentStatus ?? 'active'})`, 'error');
      } else {
        notify(err?.message || 'Enroll failed', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={() => onClose(false)} title="Enroll an employee">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[12px] text-muted">Employee</span>
          <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
            <option value="">— Select —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
            {courses.length === 0 && <option value="">No active course — create one first</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.isMandatory ? ' (mandatory)' : ''}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Due date (optional)</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Notes (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => onClose(false)} className="px-3 py-1.5 text-[13px] text-muted hover:text-secondary">Cancel</button>
          <button onClick={() => void submit()} disabled={submitting || courses.length === 0} className="px-3 py-1.5 bg-brand text-brand-fg rounded text-[13px] font-semibold disabled:opacity-50">
            {submitting ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface CourseModalProps {
  actorUserId: string;
  onClose: (reload: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const CourseModal: React.FC<CourseModalProps> = ({ actorUserId, onClose, notify }) => {
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('Technical');
  const [durationHours, setDurationHours] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isInternal, setIsInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) { notify('Title required', 'error'); return; }
    setSubmitting(true);
    try {
      await trainingApi.createCourse({
        title: title.trim(),
        provider: provider.trim() || undefined,
        category: category.trim() || undefined,
        durationHours: durationHours ? Number(durationHours) : undefined,
        isMandatory,
        isInternal,
      }, actorUserId);
      notify('Course created');
      onClose(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Create failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={() => onClose(false)} title="New training course">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[12px] text-muted">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] text-muted">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none">
              <option value="Compliance">Compliance</option>
              <option value="Technical">Technical</option>
              <option value="Leadership">Leadership</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] text-muted">Duration (hours)</span>
            <input type="number" min={0} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
          </label>
        </div>
        <label className="block">
          <span className="text-[12px] text-muted">Provider (optional)</span>
          <input value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="flex items-center gap-4 text-[13px] text-secondary">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} /> Mandatory</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} /> Internal</label>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => onClose(false)} className="px-3 py-1.5 text-[13px] text-muted hover:text-secondary">Cancel</button>
          <button onClick={() => void submit()} disabled={submitting} className="px-3 py-1.5 bg-brand text-brand-fg rounded text-[13px] font-semibold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface CompleteModalProps {
  enrollment: EnrollmentRow;
  actorUserId: string;
  onClose: (reload: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const CompleteModal: React.FC<CompleteModalProps> = ({ enrollment, actorUserId, onClose, notify }) => {
  const [score, setScore] = useState('');
  const [certificate, setCertificate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await trainingApi.complete(enrollment.id, {
        score: score === '' ? undefined : Number(score),
        certificate: certificate || undefined,
        notes: notes || undefined,
      }, actorUserId);
      notify('Enrollment completed');
      onClose(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Complete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={() => onClose(false)} title={`Complete: ${enrollment.course.title}`}>
      <div className="space-y-3">
        <div className="text-[12px] text-muted">
          Enrollee: <span className="text-primary">{enrollment.user.name ?? enrollment.user.email}</span>
        </div>
        <label className="block">
          <span className="text-[12px] text-muted">Score (0–100, optional)</span>
          <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Certificate reference (URL / ID, optional)</span>
          <input value={certificate} onChange={(e) => setCertificate(e.target.value)} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Notes (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full bg-surface border border-input rounded px-2 py-2 text-[13px] text-primary outline-none" />
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => onClose(false)} className="px-3 py-1.5 text-[13px] text-muted hover:text-secondary">Cancel</button>
          <button onClick={() => void submit()} disabled={submitting} className="px-3 py-1.5 bg-brand text-brand-fg rounded text-[13px] font-semibold disabled:opacity-50">
            {submitting ? 'Saving…' : 'Mark completed'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TrainingPage;
