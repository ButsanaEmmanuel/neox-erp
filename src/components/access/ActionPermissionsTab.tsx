// Access Control Center — phase 4.
// Action Permissions tab: per-page checklist of business actions.
//
// Layout:
//   ┌── module ───────────────────────────────────┐
//   │  page · canView=true                        │
//   │    [ ] view  [x] create  [ ] approve  …    │
//   │  page · canView=false (disabled)            │
//   │    grey row · "Hidden — enable in Page Access" │
//   └─────────────────────────────────────────────┘
//
// Draft state + Save/Reset + super_admin lock mirror PageAccessTab.
// We never write actions for pages where canView=false: the UI grays
// them out, the backend also drops them silently with `skippedHidden`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, EyeOff, Loader2, Lock, RotateCcw, Save, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import {
  accessControlApi,
  type AccActionModuleNode,
  type AccActionPageNode,
  type AccActionPermissionsTree,
} from '../../services/accessControlApi';

interface ActionPermissionsTabProps {
  roleId: string;
  refreshKey?: number;
  onSaved?: () => void;
}

// Keyed by `${pageId}::${actionId}`.
type DraftKey = string;
const draftKeyOf = (pageId: string, actionId: string) => `${pageId}::${actionId}`;

const ActionPermissionsTab: React.FC<ActionPermissionsTabProps> = ({ roleId, refreshKey, onSaved }) => {
  const { user } = useAuth();
  const toast = useToast();
  const notify = (msg: string, type: 'success' | 'error' = 'success') => toast?.addToast(msg, type);

  const [tree, setTree] = useState<AccActionPermissionsTree | null>(null);
  const [draft, setDraft] = useState<Record<DraftKey, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Cache so we don't refetch when the parent toggles refreshKey for an
  // unrelated reason (page access save) and the tree's role hasn't
  // changed. roleId + refreshKey is the actual cache key.
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  useEffect(() => {
    const key = `${roleId}::${refreshKey ?? 0}`;
    if (key === lastLoaded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDraft({});
    accessControlApi.getActionPermissions(roleId, user?.id)
      .then((t) => { if (!cancelled) { setTree(t); setLastLoaded(key); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load action permissions.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roleId, refreshKey, user?.id, lastLoaded]);

  const locked = tree?.role.locked ?? false;

  const effectiveAllowed = useCallback(
    (pageId: string, actionId: string, snapshot: boolean): boolean => {
      const k = draftKeyOf(pageId, actionId);
      return k in draft ? draft[k] : snapshot;
    },
    [draft],
  );

  const dirtyChanges = useMemo(() => {
    if (!tree) return [] as Array<{ pageId: string; actionId: string; allowed: boolean }>;
    const out: Array<{ pageId: string; actionId: string; allowed: boolean }> = [];
    for (const m of tree.modules) {
      for (const p of m.pages) {
        if (!p.canView) continue; // never queue writes for hidden pages
        for (const a of p.actions) {
          const k = draftKeyOf(p.id, a.actionId);
          if (k in draft && draft[k] !== a.allowed) {
            out.push({ pageId: p.id, actionId: a.actionId, allowed: draft[k] });
          }
        }
      }
    }
    return out;
  }, [tree, draft]);

  const filteredModules = useMemo(() => {
    if (!tree) return [] as AccActionModuleNode[];
    const q = search.trim().toLowerCase();
    if (!q) return tree.modules;
    return tree.modules
      .map((m) => ({
        ...m,
        pages: m.pages.filter((p) =>
          p.pageName.toLowerCase().includes(q)
          || p.pageKey.toLowerCase().includes(q),
        ),
      }))
      .filter((m) => m.pages.length > 0 || m.moduleName.toLowerCase().includes(q));
  }, [tree, search]);

  const handleToggle = useCallback((page: AccActionPageNode, actionId: string, snapshotAllowed: boolean) => {
    if (locked || !page.canView) return;
    setDraft((prev) => {
      const next = { ...prev };
      const k = draftKeyOf(page.id, actionId);
      const current = k in next ? next[k] : snapshotAllowed;
      const flipped = !current;
      if (flipped === snapshotAllowed) delete next[k]; // reverted
      else next[k] = flipped;
      return next;
    });
  }, [locked]);

  const handlePageToggleAll = useCallback((page: AccActionPageNode, target: boolean) => {
    if (locked || !page.canView) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const a of page.actions) {
        const k = draftKeyOf(page.id, a.actionId);
        if (target === a.allowed) delete next[k];
        else next[k] = target;
      }
      return next;
    });
  }, [locked]);

  const handleReset = useCallback(() => setDraft({}), []);

  const handleSave = useCallback(async () => {
    if (!tree || dirtyChanges.length === 0 || saving || locked) return;
    setSaving(true);
    try {
      const result = await accessControlApi.saveActionPermissions(
        roleId, dirtyChanges, user?.id, user?.name,
      );
      const fresh = await accessControlApi.getActionPermissions(roleId, user?.id);
      setTree(fresh);
      setDraft({});
      const msg = `Saved ${result.saved} action${result.saved === 1 ? '' : 's'}.`
        + (result.skippedHidden > 0 ? ` ${result.skippedHidden} skipped (hidden pages).` : '');
      notify(msg, 'success');
      onSaved?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Save failed.', 'error');
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
        Loading action permissions…
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
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">super_admin is locked.</p>
            <p className="text-amber-300/80">
              Action permissions are read-only and forced to allowed for every page.
            </p>
          </div>
        </div>
      )}

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

      <div className="space-y-3">
        {filteredModules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-8 text-center">
            <p className="text-[12px] text-muted">No module or page matches “{search}”.</p>
          </div>
        ) : (
          filteredModules.map((m) => {
            const isCollapsed = collapsed.has(m.id);
            const editablePages = m.pages.filter((p) => p.canView);
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
                    {editablePages.length}/{m.pages.length} editable
                  </span>
                </div>
                {!isCollapsed && (
                  <ul className="divide-y divide-border/40">
                    {m.pages.map((p) => (
                      <PageActionRow
                        key={p.id}
                        page={p}
                        locked={locked}
                        effective={effectiveAllowed}
                        draft={draft}
                        onToggle={handleToggle}
                        onPageToggleAll={handlePageToggleAll}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-border/40 bg-surface/30 px-3 py-2 text-[11px] text-muted">
        <ShieldAlert size={12} className="inline -mt-0.5 mr-1 text-blue-300" />
        Pages hidden in <strong className="text-primary">Module &amp; Page Access</strong> are not editable here —
        enable a page first, then come back to grant actions.
        Each save writes one audit log entry per modified toggle and reprojects the role's permissions.
      </div>
    </div>
  );
};

// ── Page row with chip-style action toggles ──────────────────────────────

interface PageActionRowProps {
  page: AccActionPageNode;
  locked: boolean;
  effective: (pageId: string, actionId: string, snapshot: boolean) => boolean;
  draft: Record<string, boolean>;
  onToggle: (page: AccActionPageNode, actionId: string, snapshotAllowed: boolean) => void;
  onPageToggleAll: (page: AccActionPageNode, target: boolean) => void;
}

const PageActionRow: React.FC<PageActionRowProps> = ({
  page, locked, effective, draft, onToggle, onPageToggleAll,
}) => {
  const disabled = !page.canView || locked;
  const allowedCount = page.actions.reduce(
    (n, a) => n + (effective(page.id, a.actionId, a.allowed) ? 1 : 0),
    0,
  );

  return (
    <li className={`px-4 py-3 ${disabled ? 'bg-surface/20' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-medium truncate ${disabled ? 'text-muted' : 'text-primary'}`}>
              {page.pageName}
            </span>
            {!page.canView && (
              <span
                title="Enable this page in Module & Page Access to edit its actions."
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface text-muted border border-border/60"
              >
                <EyeOff size={9} />
                Hidden
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-[10px] text-muted font-mono">{page.pageKey}</code>
            {!disabled && (
              <span className="text-[10px] text-muted">{allowedCount}/{page.actions.length} actions</span>
            )}
          </div>
        </div>
        {!disabled && (
          <>
            <button
              type="button"
              onClick={() => onPageToggleAll(page, true)}
              className="text-[10px] text-emerald-300 hover:text-emerald-200"
            >
              Allow all
            </button>
            <span className="text-[10px] text-muted">·</span>
            <button
              type="button"
              onClick={() => onPageToggleAll(page, false)}
              className="text-[10px] text-rose-300 hover:text-rose-200"
            >
              Deny all
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {page.actions.map((a) => {
          const allowed = effective(page.id, a.actionId, a.allowed);
          const dirty = draftKeyOf(page.id, a.actionId) in draft
            && draft[draftKeyOf(page.id, a.actionId)] !== a.allowed;
          return (
            <button
              key={a.actionId}
              type="button"
              onClick={() => onToggle(page, a.actionId, a.allowed)}
              disabled={disabled}
              aria-pressed={allowed}
              title={a.actionName}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
                disabled
                  ? 'border-border/40 bg-surface/30 text-muted/60 cursor-not-allowed'
                  : allowed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-surface border-border/60 text-secondary hover:text-primary hover:bg-card'
              } ${dirty ? 'ring-1 ring-blue-400/60' : ''}`}
            >
              {a.actionName}
            </button>
          );
        })}
      </div>
    </li>
  );
};

export default ActionPermissionsTab;
