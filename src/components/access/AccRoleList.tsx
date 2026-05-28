// Access Control Center — searchable role list (read-only).
//
// Backed by GET /api/v1/access-control/roles. Phase 2 has no create/
// delete/rename — these arrive in phase 3.

import React, { useMemo } from 'react';
import { Search, Shield, ShieldCheck } from 'lucide-react';
import type { AccRole } from '../../services/accessControlApi';

interface AccRoleListProps {
  roles: AccRole[];
  loading: boolean;
  error: string | null;
  selectedRoleId: string | null;
  search: string;
  onSearchChange: (next: string) => void;
  onSelect: (roleId: string) => void;
}

const AccRoleList: React.FC<AccRoleListProps> = ({
  roles, loading, error, selectedRoleId, search, onSearchChange, onSelect,
}) => {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      [r.code, r.name, r.label, r.description ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }, [roles, search]);

  return (
    <div className="w-80 shrink-0 border-r border-border/60 bg-surface/20 flex flex-col">
      <div className="p-3 border-b border-border/60">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search roles…"
            className="w-full bg-app border border-input rounded-lg pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/40"
          />
        </div>
        <p className="mt-2 text-[10px] text-muted">
          {loading ? 'Loading…' : `${filtered.length} of ${roles.length} roles`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {error && (
          <p className="text-[11px] text-rose-400 px-2 py-3">{error}</p>
        )}
        {!error && filtered.length === 0 && !loading && (
          <p className="text-[11px] text-muted px-2 py-3">No roles match your search.</p>
        )}
        {filtered.map((r) => {
          const isActive = r.id === selectedRoleId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500/30 text-primary'
                  : 'bg-transparent border-transparent hover:bg-surface text-secondary'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {r.isSystem ? (
                  <ShieldCheck size={12} className="text-blue-300 shrink-0" />
                ) : (
                  <Shield size={12} className="text-muted shrink-0" />
                )}
                <span className="truncate text-[12px] font-medium">{r.label || r.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted truncate">
                <span className="font-mono">{r.code}</span>
                <span className="mx-1">·</span>
                <span>{r.counts.members} member{r.counts.members !== 1 ? 's' : ''}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AccRoleList;
