// HRM-1.4 — Typeahead select for the WorkItem assignee field.
//
// The underlying DB column WorkItem.assignee is a string, not a FK.
// To stay backward-compatible with all existing data (telecom imports
// wrote team names there) and with all the legacy filters that match
// by substring (see backend/services/projects/projectCollaboration
// .service.mjs:611), this component still stores the assignee as a
// string — specifically, the employee's `name` from the picker.
// Free text is preserved as a fallback when no employee matches.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import {
  fetchAssignableEmployees,
  type AssignableEmployee,
} from '../../services/assignablesApi';

interface WorkItemAssigneeSelectProps {
  value: string;
  onChange: (value: string) => void;
  projectId?: string;
  placeholder?: string;
  /** When true, the field is rendered disabled. */
  disabled?: boolean;
}

const WorkItemAssigneeSelect: React.FC<WorkItemAssigneeSelectProps> = ({
  value,
  onChange,
  projectId,
  placeholder = 'Assign to an employee or contractor…',
  disabled,
}) => {
  const [employees, setEmployees] = useState<AssignableEmployee[] | null>(null);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAssignableEmployees({ projectId }).then((list) => {
      if (!cancelled) setEmployees(list);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Keep query in sync when the parent updates value externally.
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const filtered = useMemo(() => {
    const list = employees ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q)
          || e.email.toLowerCase().includes(q)
          || e.jobTitle.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [employees, query]);

  const handleSelect = (emp: AssignableEmployee) => {
    setQuery(emp.name);
    onChange(emp.name);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay closing so onMouseDown on a suggestion fires first.
            closeTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-surface pl-8 pr-7 py-2 text-xs text-primary placeholder:text-muted focus:border-ring focus:outline-none disabled:opacity-60"
        />
        {query && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              if (closeTimer.current !== null) {
                window.clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
              handleClear();
            }}
            title="Clear"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:bg-border hover:text-primary"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {employees === null ? (
            <p className="px-3 py-2 text-xs text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs">
              <p className="text-muted">No matching employee.</p>
              {query.trim() && (
                <p className="mt-1 inline-flex items-center gap-1 text-secondary">
                  <UserPlus size={12} />
                  Keeping &quot;{query.trim()}&quot; as free-text assignee.
                </p>
              )}
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      if (closeTimer.current !== null) {
                        window.clearTimeout(closeTimer.current);
                        closeTimer.current = null;
                      }
                      handleSelect(e);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-primary">{e.name || e.email}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {e.jobTitle || e.email || '—'}
                      </span>
                    </span>
                    {e.employmentType === 'contractor' && (
                      <span className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
                        contractor
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkItemAssigneeSelect;
