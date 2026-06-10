import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { upsertBudgetLine, listBudgetCategories, type BudgetLine } from '../../../services/finance/budgetsApi';

interface CategoryOption {
  id: string;
  code: string;
  name: string;
  direction: string;
  isActive: boolean;
}

interface Props {
  budgetId: string;
  budgetCurrencyCode: string;
  existingLines: Array<{ id: string; categoryId: string }>;
  initialLine?: BudgetLine | null;
  onClose: () => void;
  onSaved: (line: BudgetLine) => void;
}

const BudgetLineEditor: React.FC<Props> = ({
  budgetId,
  budgetCurrencyCode,
  existingLines,
  initialLine,
  onClose,
  onSaved,
}) => {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(initialLine?.categoryId || '');
  const [plannedAmount, setPlannedAmount] = useState<string>(
    initialLine?.plannedAmount !== undefined ? String(initialLine.plannedAmount) : '',
  );
  const [notes, setNotes] = useState<string>(initialLine?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    listBudgetCategories()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats.filter((c) => c.isActive));
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load categories. Try again.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usedCategoryIds = useMemo(() => {
    const initialId = initialLine?.categoryId;
    return new Set(existingLines.filter((l) => l.categoryId !== initialId).map((l) => l.categoryId));
  }, [existingLines, initialLine?.categoryId]);

  const availableCategories = useMemo(
    () => categories.filter((c) => !usedCategoryIds.has(c.id)),
    [categories, usedCategoryIds],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError('Category is required.');
      return;
    }
    const amount = Number(plannedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Planned amount must be a non-negative number.');
      return;
    }
    setSaving(true);
    try {
      const line = await upsertBudgetLine(budgetId, {
        categoryId,
        plannedAmount: amount,
        notes: notes.trim() || null,
      });
      onSaved(line);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save budget line.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-primary">
            {initialLine ? 'Edit budget line' : 'Add budget line'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={loadingCategories || !!initialLine}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary"
            >
              <option value="">{loadingCategories ? 'Loading…' : 'Select a category'}</option>
              {(initialLine ? categories : availableCategories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) — {c.direction}
                </option>
              ))}
            </select>
            {!loadingCategories && !initialLine && availableCategories.length === 0 && (
              <p className="text-[11px] text-amber-500 mt-1">All active categories already have a line.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Planned amount ({budgetCurrencyCode})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={plannedAmount}
              onChange={(e) => setPlannedAmount(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary"
            />
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
              {saving ? 'Saving…' : initialLine ? 'Save changes' : 'Add line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetLineEditor;
