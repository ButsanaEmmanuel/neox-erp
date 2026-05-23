// HRM-1.3 — Per-user permissions view: active roles + per-key overrides.
//
// Self-contained: includes a search input backed by the HRM store's
// employees list so an HR admin can pick anyone without leaving this
// tab. When an employee is selected we hit GET /api/v1/hrm/users/:id/permissions
// and render the result with add/remove controls.

import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserX, Shield, Plus, X, Clock } from 'lucide-react';
import { useHRMStore } from '../../../store/hrm/useHRMStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import RoleAssignModal from './RoleAssignModal';
import OverrideModal from './OverrideModal';
import { rbacAdminApi, type RbacUserAssignments } from '../../../services/rbacAdminApi';

const UserPermissionsPage: React.FC = () => {
  const { employees } = useHRMStore();
  const { user: actor } = useAuth();
  const toast = useToast();
  const notify = (message: string, type: 'success' | 'error') => toast?.addToast(message, type);

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [data, setData] = useState<RbacUserAssignments | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees.slice(0, 12);
    return employees
      .filter((e) => {
        const fields = [
          (e as { name?: string }).name,
          (e as { email?: string }).email,
          (e as { employeeCode?: string }).employeeCode,
          (e as { roleTitle?: string }).roleTitle,
        ];
        return fields.some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
      })
      .slice(0, 50);
  }, [employees, search]);

  const reload = async () => {
    if (!selectedUserId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await rbacAdminApi.getUserAssignments(selectedUserId);
      setData(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user permissions');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const handleRevokeRole = async (roleId: string, roleLabel: string) => {
    if (!selectedUserId) return;
    if (!confirm(`Revoke role "${roleLabel}" from this user?`)) return;
    try {
      await rbacAdminApi.revokeRole(selectedUserId, roleId);
      notify(`Revoked: ${roleLabel}`, 'success');
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to revoke', 'error');
    }
  };

  const handleRemoveOverride = async (permissionId: string, key: string) => {
    if (!selectedUserId) return;
    if (!confirm(`Remove override for "${key}"?`)) return;
    try {
      await rbacAdminApi.removeOverride(selectedUserId, permissionId);
      notify(`Override removed: ${key}`, 'success');
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to remove override', 'error');
    }
  };

  const excludeRoleIds = data?.roles.map((r) => r.roleId) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface/40 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees by name, email, code, role…"
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-1.5 text-[13px] text-primary placeholder:text-muted focus:border-ring focus:outline-none"
          />
        </div>
        <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full text-center text-[12px] text-muted">No employee matches.</p>
          ) : (
            filtered.map((e) => {
              const id = (e as { id: string }).id;
              const name = (e as { name?: string }).name || id;
              const email = (e as { email?: string }).email || '';
              const isSelected = id === selectedUserId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedUserId(id)}
                  className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors ${
                    isSelected
                      ? 'border-brand bg-brand/10 text-primary'
                      : 'border-border bg-surface text-secondary hover:bg-border'
                  }`}
                >
                  <span className="block font-medium text-primary">{name}</span>
                  {email && <span className="block truncate text-[11px] text-muted">{email}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!selectedUserId ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/30 p-10 text-center">
          <p className="text-[13px] text-muted">Select an employee above to manage their roles and overrides.</p>
        </div>
      ) : loading || !data ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-[13px] text-muted">
          Loading permissions…
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface/40 p-4">
            <p className="text-[14px] font-semibold text-primary">
              {data.user.name || data.user.email || data.user.id}
            </p>
            {data.user.email && <p className="text-[12px] text-muted">{data.user.email}</p>}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-primary">
                <Shield size={14} /> Active roles ({data.roles.length})
              </h3>
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[12px] font-semibold text-brand-fg hover:bg-brand/90"
              >
                <Plus size={12} /> Assign role
              </button>
            </div>
            {data.roles.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface/30 px-3 py-4 text-center text-[12px] text-muted">
                No active role assignment.
              </p>
            ) : (
              <ul className="space-y-1">
                {data.roles.map((ur) => (
                  <li
                    key={ur.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-primary">{ur.role.label}</span>
                      {ur.role.isSystem && (
                        <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                          system
                        </span>
                      )}
                      <code className="ml-2 text-[11px] font-mono text-muted">{ur.role.code}</code>
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted">
                        <Clock size={10} /> since {new Date(ur.validFrom).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeRole(ur.roleId, ur.role.label)}
                      title="Revoke role"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <UserX size={12} /> Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-primary">
                Individual overrides ({data.overrides.length})
              </h3>
              <button
                type="button"
                onClick={() => setOverrideOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[12px] font-semibold text-brand-fg hover:bg-brand/90"
              >
                <Plus size={12} /> Add override
              </button>
            </div>
            {data.overrides.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface/30 px-3 py-4 text-center text-[12px] text-muted">
                No individual override.
              </p>
            ) : (
              <ul className="space-y-1">
                {data.overrides.map((o) => {
                  const key = o.permission?.key ?? `${o.module}.${o.resource}.${o.action}`;
                  const permId = o.permission?.id;
                  return (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                    >
                      <div className="min-w-0">
                        <span
                          className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            o.effect === 'allow'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {o.effect}
                        </span>
                        <code className="text-[12px] font-mono text-primary">{key}</code>
                        {o.reason && <span className="ml-2 text-[11px] text-muted">— {o.reason}</span>}
                        {o.expiresAt && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted">
                            <Clock size={10} /> until {new Date(o.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {permId ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveOverride(permId, key)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <X size={12} /> Remove
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted" title="Legacy override without Permission FK">
                          legacy
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {selectedUserId && (
        <>
          <RoleAssignModal
            isOpen={assignOpen}
            onClose={() => setAssignOpen(false)}
            userId={selectedUserId}
            excludeRoleIds={excludeRoleIds}
            actorUserId={actor?.id ?? null}
            onAssigned={() => {
              notify('Role assigned', 'success');
              void reload();
            }}
          />
          <OverrideModal
            isOpen={overrideOpen}
            onClose={() => setOverrideOpen(false)}
            userId={selectedUserId}
            actorUserId={actor?.id ?? null}
            onSaved={() => {
              notify('Override saved', 'success');
              void reload();
            }}
          />
        </>
      )}
    </div>
  );
};

export default UserPermissionsPage;
