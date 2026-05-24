// HRM-1.3 — Modal to add a per-user permission override (allow/deny).

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../ui/Modal';
import {
  rbacAdminApi,
  type RbacPermission,
  type RbacPermissionGroup,
} from '../../../services/rbacAdminApi';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaved: () => void;
  actorUserId?: string | null;
}

const OverrideModal: React.FC<OverrideModalProps> = ({ isOpen, onClose, userId, onSaved, actorUserId }) => {
  const [modules, setModules] = useState<RbacPermissionGroup[] | null>(null);
  const [permissionId, setPermissionId] = useState<string>('');
  const [effect, setEffect] = useState<'allow' | 'deny'>('allow');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPermissionId('');
    setEffect('allow');
    setReason('');
    setExpiresAt('');
    setSearch('');
    setModules(null);
    rbacAdminApi
      .listPermissions()
      .then((resp) => setModules(resp.modules))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load permissions'));
  }, [isOpen]);

  const flat = useMemo(() => {
    if (!modules) return [];
    const list: RbacPermission[] = [];
    for (const g of modules) list.push(...g.permissions);
    return list;
  }, [modules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((p) => p.key.includes(q) || (p.description ?? '').toLowerCase().includes(q));
  }, [flat, search]);

  const handleSubmit = async () => {
    if (!permissionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await rbacAdminApi.upsertOverride(
        userId,
        {
          permissionId,
          effect,
          reason: reason.trim() || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
        actorUserId,
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save override');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add permission override">
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
            Effect
          </label>
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {(['allow', 'deny'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setEffect(opt)}
                className={`rounded px-3 py-1 text-[12px] font-medium transition-colors ${
                  effect === opt
                    ? opt === 'allow'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/15 text-red-700 dark:text-red-400'
                    : 'text-muted hover:text-primary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
            Permission
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key or description…"
            className="mb-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-primary placeholder:text-muted focus:border-ring focus:outline-none"
          />
          {!modules ? (
            <p className="text-[13px] text-muted">Loading…</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-surface/40 p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-1 text-[12px] text-muted">No permission matches.</p>
              ) : (
                filtered.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 transition-colors hover:bg-surface"
                  >
                    <input
                      type="radio"
                      name="perm"
                      value={p.id}
                      checked={permissionId === p.id}
                      onChange={() => setPermissionId(p.id)}
                      className="mt-0.5 accent-brand"
                    />
                    <span className="min-w-0">
                      <code className="block truncate text-[12px] font-mono text-primary">{p.key}</code>
                      {p.description && (
                        <span className="block truncate text-[11px] text-muted">{p.description}</span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why this override is granted (audit trail)"
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-primary placeholder:text-muted focus:border-ring focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-muted">
            Expires at (optional)
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-primary focus:border-ring focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-muted">Leave empty for a permanent override.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-border"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!permissionId || submitting}
          onClick={handleSubmit}
          className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg transition-all hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Save override'}
        </button>
      </div>
    </Modal>
  );
};

export default OverrideModal;
