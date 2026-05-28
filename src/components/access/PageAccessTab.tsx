// Access Control Center — phase 3.
// Module & Page Access tab: tree of modules → pages with a Visible/Hidden
// toggle per page, draft state, Save/Reset buttons, super_admin lock.
//
// Save path is atomic and only sends pages whose toggle actually
// changed. The backend re-projects RolePermission and writes one
// PermissionAuditLog row per real change.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Lock, RotateCcw, Save, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import {
  accessControlApi,
  type AccPageAccessTree,
  type AccModuleNode,
  type AccPageNode,
} from '../../services/accessControlApi';

interface PageAccessTabProps {
  roleId: string;
  /** Bumped by the parent when a save elsewhere should invalidate this view. */
  refreshKey?: number;
  /** Optional callback to notify the parent that the role counters need a refetch. */
  onSaved?: () => void;
}

// `tree` holds the server snapshot, `draft` holds pending toggle state
// keyed by pageId. A page is "dirty" when draft[pageId] differs from
// the snapshot's canView. We never mutate `tree` outside of refresh —
// Reset just empties `draft`.
const PageAccessTab: React.FC<PageAccessTabProps> = ({ roleId, refreshKey, onSaved }) => {
  const { user } = useAuth();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const [tree, setTree] = useState<AccPageAccessTree | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Load whenever the selected role changes (or the parent bumps refreshKey).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDraft({});
    accessControlApi.getPageAccess(roleId, user?.id)
      .then((t) => { if (!cancelled) setTree(t); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load page access.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roleId, refreshKey, user?.id]);

  const locked = tree?.role.locked ?? false;

  // Effective toggle: draft wins over snapshot.
  const effectiveCanView = useCallback(
    (page: AccPageNode): boolean => (page.id in draft ? draft[page.id] : page.canView),
    [draft],
  );

  // Dirty page ids — used for the Save button counter, summary line,
  // and to build the PATCH payload.
  const dirtyChanges = useMemo(() => {
    if (!tree) return [] as Array<{ pageId: string; canView: boolean }>;
    const out: Array<{ pageId: string; canView: boolean }> = [];
    for (const m of tree.modules) {
      for (const p of m.pages) {
        if (p.id in draft && draft[p.id] !== p.canView) {
          out.push({ pageId: p.id, canView: draft[p.id] });
        }
      }
    }
    return out;
  }, [tree, draft]);

  const filteredModules = useMemo(() => {
    if (!tree) return [] as AccModuleNode[];
    const q = search.trim().toLowerCase();
    if (!q) return tree.modules;
    return tree.modules
      .map((m) => ({
        ...m,
        pages: m.pages.filter((p) =>
          p.pageName.toLowerCase().includes(q)
          || p.pageKey.toLowerCase().includes(q)
          || (p.route || '').toLowerCase().includes(q),
        ),
      }))
      .filter((m) => m.pages.length > 0 || m.moduleName.toLowerCase().includes(q));
  }, [tree, search]);

  const handleToggle = useCallback((page: AccPageNode) => {
    if (locked) return;
    setDraft((prev) => {
      const next = { ...prev };
      const current = page.id in next ? next[page.id] : page.canView;
      const flipped = !current;
      if (flipped === page.canView) {
        // Reverted to snapshot state — drop the draft entry.
        delete next[page.id];
      } else {
        next[page.id] = flipped;
      }
      return next;
    });
  }, [locked]);

  const handleModuleToggleAll = useCallback((module: AccModuleNode, target: boolean) => {
    if (locked) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of module.pages) {
        if (target === p.canView) {
          delete next[p.id];
        } else {
          next[p.id] = target;
        }
      }
      return next;
    });
  }, [locked]);

  const handleReset = useCallback(() => {
    setDraft({});
  }, []);

  const handleSave = useCallback(async () => {
    if (!tree || dirtyChanges.length === 0 || saving || locked) return;
    setSaving(true);
    try {
      const result = await accessControlApi.savePageAccess(
        roleId, dirtyChanges, user?.id, user?.name,
      );
      // Refetch the tree so we have the server's canonical canView state.
      const fresh = await accessControlApi.getPageAccess(roleId, user?.id);
      setTree(fresh);
      setDraft({});
      notify(`Saved ${result.saved} page${result.saved === 1 ? '' : 's'}.`, 'success');
      onSaved?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [tree, dirtyChanges, saving, locked, roleId, user?.id, user?.name, onSaved, notify]);

  const toggleCollapse = useCallback((moduleId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  // ── render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[12px] text-muted">
        <Loader2 size={14} className="mr-2 animate-spin" />
        Loading page access…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-[12px] text-rose-300">
        {error}
      </div>
    );
  }

  if (!tree) return null;

  return (
    <div className="space-y-4">
      {/* Locked banner for super_admin. */}
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">super_admin is locked.</p>
            <p className="text-amber-300/80">
              This role retains full access to every module and page by design.
              Toggles are read-only here to prevent accidental lock-out.
            </p>
          </div>
        </div>
      )}

      {/* Sticky toolbar: search + dirty counter + Save / Reset. */}
      <div className="flex items-center gap-2 sticky top-0 z-10 bg-app/95 backdrop-blur-sm py-2 -mt-2 border-b border-border/40">
        <div className="relative flex-1 max-w-md">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules and pages…"
            className="w-full rounded-lg border border-border/70 bg-surface pl-8 pr-3 py-1.5 text-[12px] text-primary placeholder:text-muted focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-muted">
          {dirtyChanges.length > 0
            ? `${dirtyChanges.length} pending change${dirtyChanges.length === 1 ? '' : 's'}`
            : 'No pending changes'}
        </span>
        <button
          type="button"
          onClick={handleReset}
          disabled={dirtyChanges.length === 0 || saving || locked}
          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={dirtyChanges.length === 0 || saving || locked}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save changes
        </button>
      </div>

      {/* Module list. */}
      <div className="space-y-3">
        {filteredModules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-8 text-center">
            <p className="text-[12px] text-muted">No module or page matches “{search}”.</p>
          </div>
        ) : (
          filteredModules.map((m) => {
            const isCollapsed = collapsed.has(m.id);
            const visibleCount = m.pages.reduce((n, p) => n + (effectiveCanView(p) ? 1 : 0), 0);
            return (
              <div key={m.id} className="rounded-xl border border-border/60 bg-surface/40">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(m.id)}
                    className="p-0.5 rounded hover:bg-surface text-muted hover:text-primary"
                    aria-label={isCollapsed ? 'Expand module' : 'Collapse module'}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <span className="text-[13px] font-semibold text-primary">{m.moduleName}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    {visibleCount}/{m.pages.length} visible
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => handleModuleToggleAll(m, true)}
                    disabled={locked}
                    className="text-[10px] text-emerald-300 hover:text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Allow all
                  </button>
                  <span className="text-[10px] text-muted">·</span>
                  <button
                    type="button"
                    onClick={() => handleModuleToggleAll(m, false)}
                    disabled={locked}
                    className="text-[10px] text-rose-300 hover:text-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Hide all
                  </button>
                </div>
                {!isCollapsed && (
                  <ul className="divide-y divide-border/40">
                    {m.pages.map((p) => {
                      const v = effectiveCanView(p);
                      const dirty = p.id in draft && draft[p.id] !== p.canView;
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-primary truncate">{p.pageName}</span>
                              {dirty && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                  pending
                                </span>
                              )}
                              {!p.isSidebarVisible && (
                                <span
                                  title="Hidden from the sidebar by configuration."
                                  className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface text-muted border border-border/60"
                                >
                                  off-sidebar
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="text-[10px] text-muted font-mono">{p.pageKey}</code>
                              {p.route && (
                                <span className="text-[10px] text-muted">{p.route}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggle(p)}
                            disabled={locked}
                            aria-pressed={v}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-colors ${
                              v
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                : 'bg-rose-500/5 border-rose-500/20 text-rose-300/80 hover:bg-rose-500/10'
                            } ${locked ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
                          >
                            {v ? <Eye size={11} /> : <EyeOff size={11} />}
                            {v ? 'Visible' : 'Hidden'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint — reminds the user that nothing is saved until they click Save. */}
      <div className="rounded-lg border border-border/40 bg-surface/30 px-3 py-2 text-[11px] text-muted">
        <ShieldAlert size={12} className="inline -mt-0.5 mr-1 text-blue-300" />
        Changes are not applied until you click <strong className="text-primary">Save changes</strong>.
        Each save writes one audit log entry per modified page and reprojects the role's permissions.
      </div>
    </div>
  );
};

export default PageAccessTab;
