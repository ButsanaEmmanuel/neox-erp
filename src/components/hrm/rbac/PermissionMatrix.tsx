// HRM-1.3 — Permission selection grid.
//
// Renders one row per (module, resource), four columns
// Read / Write / Delete / Execute. A "—" placeholder is shown for
// (resource, action) combinations that don't exist in the catalogue.
// Read-only mode disables every input (used for system roles).

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RbacPermission, RbacPermissionGroup } from '../../../services/rbacAdminApi';

const ACTION_COLUMNS = ['read', 'write', 'delete', 'execute'] as const;

interface PermissionMatrixProps {
  modules: RbacPermissionGroup[];
  /** Set of selected Permission IDs. */
  selected: Set<string>;
  /** Called with the new selection set on every toggle. Ignored if readOnly. */
  onChange?: (next: Set<string>) => void;
  readOnly?: boolean;
}

type Cell =
  | { type: 'perm'; permission: RbacPermission }
  | { type: 'missing' };

interface RowGroup {
  module: string;
  rows: Array<{ resource: string; cells: Record<string, Cell> }>;
}

function groupByResource(modules: RbacPermissionGroup[]): RowGroup[] {
  return modules.map((group) => {
    const byResource = new Map<string, Record<string, Cell>>();
    for (const perm of group.permissions) {
      let row = byResource.get(perm.resource);
      if (!row) {
        row = {};
        byResource.set(perm.resource, row);
      }
      row[perm.action] = { type: 'perm', permission: perm };
    }
    // Fill missing cells with a placeholder so layout stays aligned.
    const rows = Array.from(byResource.entries()).map(([resource, cells]) => {
      const filled: Record<string, Cell> = {};
      for (const action of ACTION_COLUMNS) {
        filled[action] = cells[action] ?? { type: 'missing' };
      }
      // Surface any non-standard action (e.g. 'admin') after the four cols.
      for (const [action, cell] of Object.entries(cells)) {
        if (!ACTION_COLUMNS.includes(action as (typeof ACTION_COLUMNS)[number])) {
          filled[action] = cell;
        }
      }
      return { resource, cells: filled };
    });
    rows.sort((a, b) => a.resource.localeCompare(b.resource));
    return { module: group.module, rows };
  });
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ modules, selected, onChange, readOnly }) => {
  const groups = useMemo(() => groupByResource(modules), [modules]);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const toggle = (permissionId: string) => {
    if (readOnly || !onChange) return;
    const next = new Set(selected);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    onChange(next);
  };

  // Extra non-standard actions across the dataset (e.g. 'admin' on hrm.leave).
  const extraActions = useMemo(() => {
    const set = new Set<string>();
    for (const group of groups) {
      for (const row of group.rows) {
        for (const action of Object.keys(row.cells)) {
          if (!ACTION_COLUMNS.includes(action as (typeof ACTION_COLUMNS)[number])) set.add(action);
        }
      }
    }
    return Array.from(set).sort();
  }, [groups]);

  const allActions = [...ACTION_COLUMNS, ...extraActions];

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.module);
        return (
          <div key={group.module} className="rounded-lg border border-border bg-surface/40">
            <button
              type="button"
              onClick={() => {
                const next = new Set(collapsed);
                if (next.has(group.module)) next.delete(group.module);
                else next.add(group.module);
                setCollapsed(next);
              }}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-primary">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {group.module}
              </span>
              <span className="text-[11px] text-muted">
                {group.rows.reduce(
                  (n, r) =>
                    n
                    + Object.values(r.cells).filter(
                      (c) => c.type === 'perm' && selected.has(c.permission.id),
                    ).length,
                  0,
                )}{' '}
                / {group.rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.type === 'perm').length, 0)} selected
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full border-separate border-spacing-y-1 text-[12px]">
                  <thead>
                    <tr className="text-muted">
                      <th className="px-2 py-1 text-left font-medium uppercase tracking-wide">Resource</th>
                      {allActions.map((action) => (
                        <th key={action} className="px-2 py-1 text-center font-medium uppercase tracking-wide">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.resource} className="bg-surface/60">
                        <td className="rounded-l-md px-2 py-1 font-medium text-primary">{row.resource}</td>
                        {allActions.map((action) => {
                          const cell = row.cells[action] ?? { type: 'missing' };
                          if (cell.type === 'missing') {
                            return (
                              <td
                                key={action}
                                className="px-2 py-1 text-center text-muted/40 last:rounded-r-md"
                                aria-label={`${row.resource}.${action} not in catalogue`}
                              >
                                —
                              </td>
                            );
                          }
                          const checked = selected.has(cell.permission.id);
                          return (
                            <td
                              key={action}
                              className="px-2 py-1 text-center last:rounded-r-md"
                              title={cell.permission.description ?? cell.permission.key}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={readOnly}
                                onChange={() => toggle(cell.permission.id)}
                                className="h-4 w-4 cursor-pointer rounded border-border accent-brand disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={cell.permission.key}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
