import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Lock, RefreshCw } from 'lucide-react';
import {
  getBudgetDetail,
  getBudgetActuals,
  deleteBudgetLine,
  updateBudget,
  type Budget,
  type BudgetActuals,
  type BudgetActualLine,
} from '../../../services/finance/budgetsApi';
import { formatCurrency } from '../../../utils/formatters';
import BudgetLineEditor from './BudgetLineEditor';

interface Props {
  budgetId: string;
  onClose: () => void;
  onChanged: () => void;
}

function varianceTone(plannedAmount: number, actualAmount: number) {
  if (plannedAmount <= 0) return 'text-muted';
  const ratio = actualAmount / plannedAmount;
  if (ratio > 1) return 'text-rose-500';
  if (ratio >= 0.8) return 'text-amber-500';
  return 'text-emerald-500';
}

const BudgetDetailDrawer: React.FC<Props> = ({ budgetId, onClose, onChanged }) => {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [actuals, setActuals] = useState<BudgetActuals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getBudgetDetail(budgetId);
      setBudget(detail);
      // Detail already includes actuals (computed server-side via opts.budget), but we
      // refetch explicitly here so a manual refresh button works the same way.
      if (detail.actuals) {
        setActuals(detail.actuals);
      } else {
        const fresh = await getBudgetActuals(budgetId);
        setActuals(fresh);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load budget.');
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCloseBudget = async () => {
    if (!budget || busy) return;
    if (!window.confirm('Close this budget? Lines and metadata become read-only.')) return;
    setBusy(true);
    try {
      const updated = await updateBudget(budget.id, { status: 'closed' });
      setBudget(updated);
      setActuals(updated.actuals || actuals);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close budget.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!budget || busy) return;
    if (!window.confirm('Delete this line?')) return;
    setBusy(true);
    try {
      await deleteBudgetLine(budget.id, lineId);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete line.');
    } finally {
      setBusy(false);
    }
  };

  const scopeLabel = useMemo(() => {
    if (!budget) return '—';
    if (budget.project) return `Project · ${budget.project.name}`;
    if (budget.department) return `Department · ${budget.department.name}`;
    return '—';
  }, [budget]);

  const linesById = useMemo(() => {
    const map = new Map<string, BudgetActualLine>();
    (actuals?.lines || []).forEach((l) => map.set(l.lineId, l));
    return map;
  }, [actuals]);

  const totals = actuals?.totals;
  const closed = budget?.status === 'closed';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-card border-l border-border h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-primary">{budget?.name || 'Budget'}</h2>
            <p className="text-[11px] text-muted uppercase tracking-wide mt-0.5">
              {scopeLabel} · {budget?.currencyCode || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-muted hover:text-primary p-1.5 rounded disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-primary p-1.5"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {budget && (
          <div className="p-4 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Period</p>
                <p className="text-xs text-primary mt-1">
                  {new Date(budget.periodStart).toLocaleDateString()} →{' '}
                  {new Date(budget.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Status</p>
                <p
                  className={`text-xs mt-1 font-bold ${
                    budget.status === 'closed'
                      ? 'text-muted'
                      : budget.status === 'active'
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}
                >
                  {budget.status.toUpperCase()}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Variance</p>
                <p
                  className={`text-xs mt-1 font-bold tabular-nums ${
                    totals && totals.variance < 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {totals
                    ? `${formatCurrency(totals.variance)} (${
                        totals.variancePct === null ? '—' : `${totals.variancePct.toFixed(1)}%`
                      })`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Budget lines</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  disabled={closed || busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-500 text-black rounded-lg disabled:opacity-50"
                  title={closed ? 'Budget is closed' : 'Add line'}
                >
                  <Plus size={12} />
                  Add line
                </button>
                <button
                  type="button"
                  onClick={handleCloseBudget}
                  disabled={closed || busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-border text-muted hover:text-primary rounded-lg disabled:opacity-50"
                >
                  <Lock size={12} />
                  {closed ? 'Closed' : 'Close budget'}
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface text-muted uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-right px-3 py-2">Planned</th>
                    <th className="text-right px-3 py-2">Actual</th>
                    <th className="text-right px-3 py-2">Variance</th>
                    <th className="text-right px-3 py-2">%</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {(budget.lines || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-6">
                        No lines yet. Add a category to start tracking.
                      </td>
                    </tr>
                  ) : (
                    (budget.lines || []).map((line) => {
                      const actual = linesById.get(line.id);
                      const planned = Number(line.plannedAmount);
                      const actualAmount = actual?.actualAmount ?? 0;
                      const variance = actual?.variance ?? planned - actualAmount;
                      const variancePct = actual?.variancePct ?? null;
                      const tone = varianceTone(planned, actualAmount);
                      return (
                        <tr key={line.id} className="border-t border-border hover:bg-surface/50">
                          <td className="px-3 py-2 text-primary">
                            <div className="font-medium">{line.category?.name || '—'}</div>
                            <div className="text-[10px] text-muted">
                              {line.category?.code} · {line.category?.direction}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-primary">
                            {formatCurrency(planned)}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${tone}`}>
                            {formatCurrency(actualAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-primary">
                            {formatCurrency(variance)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted">
                            {variancePct === null ? '—' : `${variancePct.toFixed(1)}%`}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeleteLine(line.id)}
                              disabled={closed || busy}
                              className="text-muted hover:text-rose-500 disabled:opacity-30"
                              aria-label="Delete line"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {totals && (budget.lines || []).length > 0 && (
                  <tfoot className="bg-surface text-[11px]">
                    <tr>
                      <td className="px-3 py-2 font-bold text-primary uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                        {formatCurrency(totals.planned)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                        {formatCurrency(totals.actual)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-bold ${
                          totals.variance < 0 ? 'text-rose-500' : 'text-emerald-500'
                        }`}
                      >
                        {formatCurrency(totals.variance)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-muted">
                        {totals.variancePct === null ? '—' : `${totals.variancePct.toFixed(1)}%`}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {!budget && loading && (
          <div className="p-8 text-center text-muted text-sm">Loading budget…</div>
        )}
      </div>

      {editorOpen && budget && (
        <BudgetLineEditor
          budgetId={budget.id}
          budgetCurrencyCode={budget.currencyCode}
          existingLines={(budget.lines || []).map((l) => ({ id: l.id, categoryId: l.categoryId }))}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            void load();
            onChanged();
          }}
        />
      )}
    </div>
  );
};

export default BudgetDetailDrawer;
