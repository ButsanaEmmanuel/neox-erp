// HRM-1.3 — Role editor screen. Used for both create (no roleId) and
// edit (with roleId). System roles render in read-only mode.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { useToast } from '../../ui/Toast';
import PermissionMatrix from './PermissionMatrix';
import {
  rbacAdminApi,
  type RbacPermissionGroup,
  type RbacRoleDetail,
} from '../../../services/rbacAdminApi';

interface RoleEditorPageProps {
  /** When null, the editor is in "create" mode. */
  roleId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

const RoleEditorPage: React.FC<RoleEditorPageProps> = ({ roleId, onBack, onSaved }) => {
  const toast = useToast();
  const notify = (message: string, type: 'success' | 'error') => toast?.addToast(message, type);
  const [modules, setModules] = useState<RbacPermissionGroup[]>([]);
  const [role, setRole] = useState<RbacRoleDetail | null>(null);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [perms, roleResp] = await Promise.all([
          rbacAdminApi.listPermissions(),
          roleId ? rbacAdminApi.getRole(roleId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setModules(perms.modules);
        if (roleResp) {
          const r = roleResp.role;
          setRole(r);
          setCode(r.code);
          setLabel(r.label);
          setDescription(r.description ?? '');
          setSelected(new Set(r.permissions.map((p) => p.id)));
        } else {
          setRole(null);
          setCode('');
          setLabel('');
          setDescription('');
          setSelected(new Set());
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load role data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roleId]);

  const isSystem = role?.isSystem ?? false;
  const totalPerms = useMemo(
    () => modules.reduce((n, g) => n + g.permissions.length, 0),
    [modules],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (roleId) {
        await rbacAdminApi.updateRole(roleId, {
          label: label.trim(),
          description: description.trim() || null,
          permissionIds: Array.from(selected),
        });
        notify('Role updated', 'success');
      } else {
        await rbacAdminApi.createRole({
          code: code.trim(),
          label: label.trim(),
          description: description.trim() || undefined,
          permissionIds: Array.from(selected),
        });
        notify('Role created', 'success');
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save role';
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-border"
        >
          <ArrowLeft size={14} /> Back to roles
        </button>
        <div className="flex items-center gap-2">
          {isSystem && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[12px] font-medium text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Lock size={12} /> System role — read only
            </span>
          )}
          <button
            type="button"
            disabled={isSystem || saving || !label.trim() || (!roleId && !code.trim())}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Save size={14} /> {saving ? 'Saving…' : roleId ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-[13px] text-muted">
          Loading role…
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded-lg border border-border bg-surface/40 p-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
                Code
              </label>
              <input
                type="text"
                value={code}
                disabled={Boolean(roleId) || isSystem}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. regional_manager"
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] font-mono text-primary placeholder:text-muted focus:border-ring focus:outline-none disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-muted">
                Lowercase letters, digits, underscores. Cannot be changed after creation.
              </p>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
                Label
              </label>
              <input
                type="text"
                value={label}
                disabled={isSystem}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Displayed in UI"
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-primary placeholder:text-muted focus:border-ring focus:outline-none disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
                Description
              </label>
              <textarea
                value={description}
                disabled={isSystem}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this role is for"
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-primary placeholder:text-muted focus:border-ring focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-primary">Permissions</h3>
            <span className="text-[12px] text-muted">
              {selected.size} / {totalPerms} selected
            </span>
          </div>

          <PermissionMatrix
            modules={modules}
            selected={selected}
            onChange={setSelected}
            readOnly={isSystem}
          />
        </>
      )}
    </div>
  );
};

export default RoleEditorPage;
