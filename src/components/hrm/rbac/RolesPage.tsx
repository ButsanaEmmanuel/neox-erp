// HRM-1.3 — Role catalogue page.
//
// Acts as a local router between list mode and the role editor. Owned
// by HRMConfiguration via the "roles" tab.

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useToast } from '../../ui/Toast';
import RoleCard from './RoleCard';
import RoleEditorPage from './RoleEditorPage';
import { rbacAdminApi, type RbacRoleSummary } from '../../../services/rbacAdminApi';

type ViewState =
  | { kind: 'list' }
  | { kind: 'editor'; roleId: string | null };

const RolesPage: React.FC = () => {
  const toast = useToast();
  const notify = (message: string, type: 'success' | 'error') => toast?.addToast(message, type);
  const [view, setView] = useState<ViewState>({ kind: 'list' });
  const [roles, setRoles] = useState<RbacRoleSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await rbacAdminApi.listRoles();
      setRoles(resp.roles);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles');
      setRoles(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view.kind === 'list') void reload();
  }, [view.kind, reload]);

  const handleDelete = async (role: RbacRoleSummary) => {
    if (!confirm(`Delete role "${role.label}"? This cannot be undone via the UI.`)) return;
    try {
      await rbacAdminApi.deleteRole(role.id);
      notify('Role deleted', 'success');
      void reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete role';
      notify(msg, 'error');
    }
  };

  if (view.kind === 'editor') {
    return (
      <RoleEditorPage
        roleId={view.roleId}
        onBack={() => setView({ kind: 'list' })}
        onSaved={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {roles
            ? `${roles.length} role${roles.length === 1 ? '' : 's'} — ${roles.filter((r) => r.isSystem).length} system`
            : 'Loading roles…'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-border"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setView({ kind: 'editor', roleId: null })}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 transition-all hover:bg-brand/90"
          >
            <Plus size={14} /> New role
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[12px] font-medium hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface/40" />
          ))}
        </div>
      ) : roles && roles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/30 p-10 text-center">
          <p className="text-[13px] text-muted">No role defined yet.</p>
          <button
            type="button"
            onClick={() => setView({ kind: 'editor', roleId: null })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg hover:bg-brand/90"
          >
            <Plus size={14} /> Create the first role
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={(r) => setView({ kind: 'editor', roleId: r.id })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RolesPage;
