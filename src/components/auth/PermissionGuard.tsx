// HRM-1.2 — Permission-based render gate.
//
// Usage:
//   <PermissionGuard permission="pm.projects.write">
//     <EditProjectForm />
//   </PermissionGuard>
//
//   <PermissionGuard permission={['pm.projects.write', 'pm.workItems.write']}>
//     ...     // requires both keys
//   </PermissionGuard>
//
//   <PermissionGuard permission={[...]} any fallback={<ReadOnlyBanner />}>
//     ...     // requires any of the listed keys
//   </PermissionGuard>
//
// When the user lacks the required permission(s) the component renders
// `fallback` (or a small default banner if no fallback is provided).
// It NEVER throws and NEVER shows a loading spinner — by HRM-1.2
// contract permission resolution is best-effort and degrades to deny.

import React, { ReactNode } from 'react';
import { PermissionKey, usePermissions } from '../../lib/rbac';

interface PermissionGuardProps {
  /** Single key or array of keys. With `any` all are sufficient; without, all are required. */
  permission: PermissionKey | readonly PermissionKey[];
  /** When `permission` is an array, set to true to require ANY match (default: ALL required). */
  any?: boolean;
  /** Rendered when access is denied. Defaults to a subtle banner. */
  fallback?: ReactNode;
  children: ReactNode;
}

function DefaultDeniedBanner({ required }: { required: string }) {
  return (
    <div
      role="status"
      className={[
        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        'bg-white/50 backdrop-blur-sm text-slate-700 ring-1 ring-slate-200',
        'dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-700',
      ].join(' ')}
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4 flex-shrink-0 text-amber-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 1.944A11.954 11.954 0 0 1 2.166 5C2.056 5.643 2 6.314 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.686-.057-1.357-.166-2.001A11.954 11.954 0 0 1 10 1.944zM11 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0-7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7z"
          clipRule="evenodd"
        />
      </svg>
      <span>
        Accès limité —{' '}
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{required}</span>
      </span>
    </div>
  );
}

export function PermissionGuard({ permission, any: matchAny, fallback, children }: PermissionGuardProps) {
  const { has } = usePermissions();

  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = matchAny
    ? required.some((k) => has(k as PermissionKey))
    : required.every((k) => has(k as PermissionKey));

  if (allowed) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return <DefaultDeniedBanner required={required.join(matchAny ? ' OR ' : ' AND ')} />;
}

export default PermissionGuard;
