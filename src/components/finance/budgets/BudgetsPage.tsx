import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X, PieChart, TrendingDown, TrendingUp } from 'lucide-react';
import {
  listBudgets,
  createBudget,
  listBudgetScopes,
  getBudgetEnvelope,
  type Budget,
  type BudgetStatus,
  type BudgetEnvelope,
  type CreateBudgetInput,
} from '../../../services/finance/budgetsApi';
import { formatCurrency } from '../../../utils/formatters';
import BudgetDetailDrawer from './BudgetDetailDrawer';

interface DepartmentRef {
  id: string;
  code: string;
  name: string;
}

interface ProjectRef {
  id: string;
  name: string;
  ownerDepartmentId?: string | null;
}

function sumPlanned(b: Budget): number {
  return (b.lines || []).reduce((acc, l) => acc + Number(l.plannedAmount || 0), 0);
}

function sumActual(b: Budget): number {
  return b.actuals?.totals.actual ?? 0;
}

const STATUS_FILTERS: Array<{ value: '' | BudgetStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];

const BudgetsPage: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | BudgetStatus>('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'department' | 'project'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listBudgets({
        status: status || undefined,
        take: 200,
        withActuals: true,
      });
      setBudgets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load budgets.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return budgets.filter((b) => {
      if (scopeFilter === 'department' && !b.departmentId) return false;
      if (scopeFilter === 'project' && !b.projectId) return false;
      if (q) {
        const hay = `${b.name} ${b.department?.name || ''} ${b.project?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [budgets, scopeFilter, searchQuery]);

  const totals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    for (const b of filtered) {
      planned += sumPlanned(b);
      actual += sumActual(b);
    }
    const variance = planned - actual;
    const variancePct = planned > 0 ? (variance / planned) * 100 : null;
    return { planned, actual, variance, variancePct };
  }, [filtered]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Budgets</h1>
          <p className="text-xs text-muted mt-1">
            Plan, track actuals from FinanceEntry, and lock budgets when the period closes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-500 text-black rounded-lg"
        >
          <Plus size={14} />
          New budget
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Planned"
          value={formatCurrency(totals.planned)}
          icon={<PieChart size={18} />}
          tone="blue"
        />
        <StatCard
          label="Total Actual"
          value={formatCurrency(totals.actual)}
          icon={<TrendingDown size={18} />}
          tone="amber"
        />
        <StatCard
          label="Variance"
          value={`${formatCurrency(totals.variance)} ${
            totals.variancePct === null ? '' : `(${totals.variancePct.toFixed(1)}%)`
          }`}
          icon={<TrendingUp size={18} />}
          tone={totals.variance < 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by name, department, project…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-primary"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded ${
                status === opt.value ? 'bg-emerald-500 text-black' : 'text-muted hover:text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(['all', 'department', 'project'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setScopeFilter(opt)}
              className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded capitalize ${
                scopeFilter === opt ? 'bg-emerald-500 text-black' : 'text-muted hover:text-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Scope</th>
              <th className="text-left px-4 py-3">Period</th>
              <th className="text-left px-4 py-3">Currency</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Planned</th>
              <th className="text-right px-4 py-3">Actual</th>
              <th className="text-right px-4 py-3">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-8">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-8">
                  No budgets match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const planned = sumPlanned(b);
                const actual = sumActual(b);
                const variance = planned - actual;
                return (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBudgetId(b.id)}
                    className="border-t border-border hover:bg-surface cursor-pointer"
                  >
                    <td className="px-4 py-3 text-primary font-medium">
                      {b.name}
                      {b.chargeCode ? (
                        <div className="text-[10px] font-mono text-emerald-500/80">{b.chargeCode}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {b.project ? `Project · ${b.project.name}` : b.department ? `Dept · ${b.department.name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(b.periodStart).toLocaleDateString()} →{' '}
                      {new Date(b.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{b.currencyCode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          b.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : b.status === 'closed'
                            ? 'bg-muted/10 text-muted'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(planned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(actual)}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        variance < 0 ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {formatCurrency(variance)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedBudgetId && (
        <BudgetDetailDrawer
          budgetId={selectedBudgetId}
          onClose={() => setSelectedBudgetId(null)}
          onChanged={() => void refresh()}
        />
      )}

      {createOpen && (
        <CreateBudgetModal
          onClose={() => setCreateOpen(false)}
          onCreated={(b) => {
            setCreateOpen(false);
            void refresh();
            setSelectedBudgetId(b.id);
          }}
        />
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'rose' | 'amber' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, tone }) => {
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-500'
      : tone === 'rose'
      ? 'bg-rose-500/10 text-rose-500'
      : tone === 'amber'
      ? 'bg-amber-500/10 text-amber-500'
      : 'bg-blue-500/10 text-blue-500';
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${toneClass}`}>{icon}</div>
      </div>
      <p className="text-[11px] font-bold text-muted uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-primary tabular-nums mt-1">{value}</p>
    </div>
  );
};

interface CreateModalProps {
  onClose: () => void;
  onCreated: (b: Budget) => void;
}

const CreateBudgetModal: React.FC<CreateModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [status, setStatus] = useState<BudgetStatus>('draft');
  const [scopeKind, setScopeKind] = useState<'department' | 'project'>('department');
  const [departmentId, setDepartmentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [parentBudgetId, setParentBudgetId] = useState('');
  const [deptBudgets, setDeptBudgets] = useState<Budget[]>([]);
  const [envelope, setEnvelope] = useState<BudgetEnvelope | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scopes, allBudgets] = await Promise.all([listBudgetScopes(), listBudgets({ take: 200 })]);
        if (cancelled) return;
        setDepartments(scopes.departments);
        setProjects(scopes.projects);
        // Candidate parents: department budgets still open (not closed).
        setDeptBudgets(allBudgets.filter((b) => b.departmentId && !b.projectId && b.status !== 'closed'));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? `Unable to load departments/projects: ${err.message}`
            : 'Unable to load departments and projects.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live department envelope for the selected parent (project scope only).
  useEffect(() => {
    let cancelled = false;
    if (scopeKind !== 'project' || !parentBudgetId) {
      setEnvelope(null);
      return;
    }
    (async () => {
      try {
        const env = await getBudgetEnvelope(parentBudgetId);
        if (!cancelled) setEnvelope(env);
      } catch {
        if (!cancelled) setEnvelope(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopeKind, parentBudgetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !periodStart || !periodEnd) {
      setError('Name, period start and period end are required.');
      return;
    }
    if (new Date(periodEnd) <= new Date(periodStart)) {
      setError('Period end must be after period start.');
      return;
    }
    const payload: CreateBudgetInput = {
      name: name.trim(),
      periodStart,
      periodEnd,
      currencyCode,
      status,
      departmentId: scopeKind === 'department' ? departmentId || null : null,
      projectId: scopeKind === 'project' ? projectId || null : null,
      parentBudgetId: scopeKind === 'project' ? parentBudgetId || null : null,
    };
    if (scopeKind === 'department' && !payload.departmentId) {
      setError('Select a department.');
      return;
    }
    if (scopeKind === 'project' && !payload.projectId) {
      setError('Select a project.');
      return;
    }
    setSaving(true);
    try {
      const created = await createBudget(payload);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create budget.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-primary">New budget</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="2026 Q3 Marketing"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Period end">
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <input
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                maxLength={3}
                className="input"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BudgetStatus)}
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </Field>
          </div>

          <div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Scope</p>
            <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 mb-2">
              <button
                type="button"
                onClick={() => setScopeKind('department')}
                className={`flex-1 px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded ${
                  scopeKind === 'department' ? 'bg-emerald-500 text-black' : 'text-muted hover:text-primary'
                }`}
              >
                Department
              </button>
              <button
                type="button"
                onClick={() => setScopeKind('project')}
                className={`flex-1 px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded ${
                  scopeKind === 'project' ? 'bg-emerald-500 text-black' : 'text-muted hover:text-primary'
                }`}
              >
                Project
              </button>
            </div>
            {scopeKind === 'department' ? (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="input"
              >
                <option value="">Select a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input"
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Parent department budget (optional)
                  </p>
                  <select
                    value={parentBudgetId}
                    onChange={(e) => setParentBudgetId(e.target.value)}
                    className="input"
                  >
                    <option value="">None — standalone project budget</option>
                    {deptBudgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.chargeCode ? ` · ${b.chargeCode}` : ''}
                      </option>
                    ))}
                  </select>
                  {envelope && (
                    <div className="mt-2 text-[11px] bg-surface border border-border rounded-lg px-3 py-2 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted">Voted envelope</span>
                        <span className="tabular-nums text-primary">{formatCurrency(envelope.votedTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Already allocated</span>
                        <span className="tabular-nums text-primary">{formatCurrency(envelope.allocated)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className={envelope.remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}>Remaining</span>
                        <span className={`tabular-nums ${envelope.remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {formatCurrency(envelope.remaining)}
                        </span>
                      </div>
                      {envelope.overAllocated && (
                        <p className="text-rose-500 font-bold pt-0.5">⚠ Department envelope over-allocated</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-primary border border-border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-500 text-black rounded-lg disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create budget'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: var(--surface, #1a1a1a);
          border: 1px solid var(--border, #2a2a2a);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--primary, #fff);
        }
      `}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

export default BudgetsPage;
