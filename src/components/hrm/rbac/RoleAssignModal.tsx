// HRM-1.3 — Modal to assign an existing role to a user.

import React, { useEffect, useState } from 'react';
import Modal from '../../ui/Modal';
import { rbacAdminApi, type RbacRoleSummary } from '../../../services/rbacAdminApi';

interface RoleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  excludeRoleIds: string[];
  onAssigned: () => void;
  actorUserId?: string | null;
}

const RoleAssignModal: React.FC<RoleAssignModalProps> = ({
  isOpen,
  onClose,
  userId,
  excludeRoleIds,
  onAssigned,
  actorUserId,
}) => {
  const [roles, setRoles] = useState<RbacRoleSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedId('');
    setRoles(null);
    rbacAdminApi
      .listRoles()
      .then((resp) => {
        const excluded = new Set(excludeRoleIds);
        setRoles(resp.roles.filter((r) => !excluded.has(r.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load roles'));
  }, [isOpen, excludeRoleIds]);

  const handleAssign = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await rbacAdminApi.assignRole(userId, selectedId, actorUserId);
      onAssigned();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign role">
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {!roles ? (
          <p className="text-[13px] text-muted">Loading roles…</p>
        ) : roles.length === 0 ? (
          <p className="text-[13px] text-muted">No additional role available — user already has every active role.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-surface/40 p-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface"
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={selectedId === r.id}
                  onChange={() => setSelectedId(r.id)}
                  className="mt-0.5 accent-brand"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-primary">
                    {r.label}
                    {r.isSystem && (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                        system
                      </span>
                    )}
                  </span>
                  <code className="block truncate text-[11px] font-mono text-muted">{r.code}</code>
                  {r.description && (
                    <span className="block text-[12px] text-secondary">{r.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
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
          disabled={!selectedId || submitting}
          onClick={handleAssign}
          className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-fg transition-all hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </Modal>
  );
};

export default RoleAssignModal;
