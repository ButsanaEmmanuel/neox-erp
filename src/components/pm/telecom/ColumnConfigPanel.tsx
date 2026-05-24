// DH7 — Slide-in panel for configuring the telecom WorkItems columns.
// Drag-and-drop reordering via @dnd-kit (already in package.json).
// Persisted via PUT /api/v1/preferences/columns.

import React, { useEffect, useState } from 'react';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TELECOM_COLUMN_REGISTRY, TELECOM_DEFAULT_COLUMNS, columnByKey } from './telecomColumns';
import { fetchColumnPreference, saveColumnPreference } from '../../../services/pm/columnPreferences.service';
import { useAuth } from '../../../contexts/AuthContext';

const CONTEXT = 'telecom_workitems';

interface RowProps {
  columnKey: string;
  checked: boolean;
  onToggle: (key: string) => void;
}

const SortableRow: React.FC<RowProps> = ({ columnKey, checked, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: columnKey });
  const def = columnByKey.get(columnKey);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-surface">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted hover:text-primary cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(columnKey)}
          className="rounded bg-surface border-input"
        />
        <span className="text-xs text-primary">{def?.label || columnKey}</span>
      </label>
    </div>
  );
};

interface ColumnConfigPanelProps {
  open: boolean;
  onClose: () => void;
  onApplied: (columns: string[]) => void;
  initialColumns: string[];
}

const ColumnConfigPanel: React.FC<ColumnConfigPanelProps> = ({ open, onClose, onApplied, initialColumns }) => {
  const { user } = useAuth();
  // Working list = ordered selection. Hidden columns kept after to allow
  // toggling them back on without losing the user's prior position.
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Build a stable order: user's saved ordering first, then any registry
    // column that isn't in the saved list (unselected, at the bottom).
    const inSaved = new Set(initialColumns);
    const tail = TELECOM_COLUMN_REGISTRY.map((c) => c.key).filter((k) => !inSaved.has(k));
    setOrder([...initialColumns, ...tail]);
    setSelected(new Set(initialColumns));
    setError(null);
  }, [open, initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const reset = () => {
    const inDefault = new Set(TELECOM_DEFAULT_COLUMNS);
    const tail = TELECOM_COLUMN_REGISTRY.map((c) => c.key).filter((k) => !inDefault.has(k));
    setOrder([...TELECOM_DEFAULT_COLUMNS, ...tail]);
    setSelected(new Set(TELECOM_DEFAULT_COLUMNS));
  };

  const apply = async () => {
    if (!user?.id) {
      setError('Not authenticated.');
      return;
    }
    const finalColumns = order.filter((k) => selected.has(k));
    if (finalColumns.length === 0) {
      setError('Select at least one column.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveColumnPreference(CONTEXT, finalColumns, user.id);
      onApplied(saved.columns);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-card border-l border-border/60 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border/60">
          <div>
            <h2 className="text-sm font-semibold text-primary">Configure columns</h2>
            <p className="text-[11px] text-muted">{selected.size} of {TELECOM_COLUMN_REGISTRY.length} shown · drag to reorder</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((key) => (
                <SortableRow
                  key={key}
                  columnKey={key}
                  checked={selected.has(key)}
                  onToggle={toggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {error && <p className="px-4 py-2 text-[11px] text-rose-400 border-t border-border/60">{error}</p>}

        <div className="p-4 border-t border-border/60 flex items-center justify-between gap-2 bg-surface">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-primary border border-border/60"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-primary">Cancel</button>
            <button
              type="button"
              onClick={apply}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ColumnConfigPanel;
