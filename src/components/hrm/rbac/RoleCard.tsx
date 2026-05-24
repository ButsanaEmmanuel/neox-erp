// HRM-1.3 — Compact role card for RolesPage list.
//
// Displays code/label, isSystem badge, permission count and active user
// count. Delete button is disabled (with tooltip) when isSystem is true.

import React from 'react';
import { Shield, Lock, Users, Edit2, Trash2 } from 'lucide-react';
import type { RbacRoleSummary } from '../../../services/rbacAdminApi';

interface RoleCardProps {
  role: RbacRoleSummary;
  onEdit: (role: RbacRoleSummary) => void;
  onDelete: (role: RbacRoleSummary) => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, onEdit, onDelete }) => {
  const deleteDisabled = role.isSystem || role._count.userRoles > 0;
  const deleteReason = role.isSystem
    ? 'System role — cannot be deleted'
    : role._count.userRoles > 0
      ? 'Role still has active assignments — revoke them first'
      : 'Delete role';

  return (
    <div className="rounded-xl border border-border bg-surface/60 backdrop-blur-sm p-4 transition-colors hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-primary">{role.label}</h3>
            {role.isSystem && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <Lock size={10} /> System
              </span>
            )}
          </div>
          <code className="block truncate text-[11px] font-mono text-muted">{role.code}</code>
          {role.description && (
            <p className="mt-1.5 line-clamp-2 text-[12px] text-secondary">{role.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Shield size={12} /> {role._count.permissions} perms
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> {role._count.userRoles} users
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(role)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] font-medium text-secondary transition-colors hover:bg-border"
        >
          <Edit2 size={12} /> {role.isSystem ? 'View' : 'Edit'}
        </button>
        <button
          type="button"
          disabled={deleteDisabled}
          title={deleteReason}
          onClick={() => onDelete(role)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12px] font-medium text-secondary transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-secondary dark:hover:text-red-400"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
};

export default RoleCard;
