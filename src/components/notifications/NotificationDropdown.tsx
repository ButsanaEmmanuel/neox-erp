import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Trash2, Info, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, AppNotification, matchesNotificationTarget } from '../../store/notifications/useNotificationStore';
import { useAuth } from '../../contexts/AuthContext';
import { triggerNotificationAction } from '../../services/notifications.service';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

const getIconForType = (type: AppNotification['uiType']) => {
  switch (type) {
    case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />;
    case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
    case 'error': return <XCircle size={16} className="text-rose-500" />;
    default: return <Info size={16} className="text-blue-500" />;
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
};

const getDepartmentBadgeClass = (department?: string) => {
  const dep = String(department || '').toLowerCase();
  if (dep.includes('engineering')) return 'bg-blue-500/15 text-blue-300 border-blue-500/35';
  if (dep === 'hr' || dep.includes('human')) return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/35';
  if (dep.includes('scm') || dep.includes('supply')) return 'bg-orange-500/15 text-orange-300 border-orange-500/35';
  if (dep.includes('finance')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/35';
};

const resolveNotificationLink = (rawLink?: string) => {
  const link = String(rawLink || '').trim();
  if (!link) return '';
  try {
    const url = new URL(link, window.location.origin);
    if (url.pathname === '/projects/work-items') {
      const projectId = url.searchParams.get('projectId');
      const workItemId = url.searchParams.get('workItemId');
      if (projectId) {
        return `/projects/${encodeURIComponent(projectId)}/work-items${workItemId ? `?workItemId=${encodeURIComponent(workItemId)}` : ''}`;
      }
    }
  } catch {
    // non-URL values, keep as-is
  }
  return link;
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, isDark }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, markAsRead, markAllAsRead, clearRead } = useNotificationStore();
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setActionLoading(null);
      setActionError(null);
    }
  }, [isOpen]);

  const userNotifications = useMemo(() => notifications.filter((n) => {
    if (!user) return false;
    return matchesNotificationTarget(n, user.id, user.role, user.departmentId);
  }), [notifications, user]);

  if (!isOpen || !user) return null;

  const unreadCount = userNotifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    // Always open contextual preview first. Navigation becomes explicit via CTA.
    setSelected(notification);
    setActionError(null);
  };

  const runAction = async (action: 'approve' | 'reject') => {
    if (!selected) return;
    try {
      setActionLoading(action);
      setActionError(null);
      await triggerNotificationAction({
        notificationId: selected.id,
        action,
        approval: selected.approval || null,
        actorUserId: user.id,
        actorDisplayName: user.name,
      });
      setSelected(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Action impossible.';
      setActionError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const selectedEntityType = String(selected?.approval?.entityType || '').toLowerCase();
  const supportsQuickApproveReject = selectedEntityType === 'finance_entry';

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute top-full right-0 mt-2 w-[420px] rounded-xl shadow-2xl border overflow-hidden z-[200]',
        isDark ? 'bg-[#111822] border-[#2d3748]' : 'bg-white border-slate-200',
      )}
    >
      <div className={cn(
        'px-4 py-3 flex items-center justify-between border-b',
        isDark ? 'border-[#2d3748]' : 'border-slate-200',
      )}>
        <h3 className={cn('font-medium', isDark ? 'text-slate-200' : 'text-slate-800')}>
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-neox-emerald text-black">
              {unreadCount}
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead(user.id, user.role, user.departmentId)}
              className="px-2 py-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-neox-emerald transition-colors text-xs"
              title="Marquer tout comme lu"
            >
              <Check size={14} className="inline mr-1" />
              Tout lire
            </button>
          )}
          <button
            onClick={clearRead}
            className="p-1.5 rounded-md hover:bg-black/5 text-slate-500 hover:text-rose-500 transition-colors"
            title="Supprimer les lues"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {selected && (
        <div className={cn(
          'mx-4 mt-3 mb-2 p-3 rounded-lg border',
          isDark ? 'bg-[#0d1117] border-[#2d3748]' : 'bg-slate-50 border-slate-200',
        )}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>{selected.title}</p>
              <p className={cn('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-600')}>{selected.details || selected.message}</p>
            </div>
            {selected.link && (
              <button
                onClick={() => {
                  navigate(resolveNotificationLink(selected.link));
                  onClose();
                }}
                className="text-xs text-neox-emerald hover:underline inline-flex items-center gap-1"
              >
                Ouvrir <ExternalLink size={12} />
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            {supportsQuickApproveReject ? (
              <>
                <button
                  onClick={() => void runAction('approve')}
                  disabled={actionLoading !== null}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-60"
                >
                  {actionLoading === 'approve' ? 'Validation...' : 'Approuver'}
                </button>
                <button
                  onClick={() => void runAction('reject')}
                  disabled={actionLoading !== null}
                  className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs disabled:opacity-60"
                >
                  {actionLoading === 'reject' ? 'Refus...' : 'Refuser'}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (selected.link) navigate(resolveNotificationLink(selected.link));
                  onClose();
                }}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs"
              >
                Ouvrir le contexte
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              disabled={actionLoading !== null}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs',
                isDark ? 'bg-[#1e2d3d] text-slate-200' : 'bg-slate-200 text-slate-800',
              )}
            >
              Fermer
            </button>
          </div>
          {actionError && (
            <p className="text-xs text-rose-400 mt-2">{actionError}</p>
          )}
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto no-scrollbar">
        {userNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            <Bell size={32} className="mx-auto mb-3 opacity-20" />
            Aucune notification récente.
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {userNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'px-4 py-3 cursor-pointer hover:bg-black/5 transition-colors flex gap-3',
                  !notification.isRead && (isDark ? 'bg-[#1e2d3d]/50' : 'bg-blue-50/50'),
                )}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {getIconForType(notification.uiType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-sm font-medium leading-tight mb-1',
                      isDark ? 'text-slate-200' : 'text-slate-800',
                    )}>
                      {notification.title}
                    </p>
                    {notification.department && (
                      <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide', getDepartmentBadgeClass(notification.department))}>
                        {notification.department}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'text-[13px] leading-snug line-clamp-2',
                    isDark ? 'text-slate-400' : 'text-slate-600',
                  )}>
                    {notification.details || notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-500 font-medium">
                      {notification.sender ? `${notification.sender} · ` : ''}{formatTimeAgo(notification.createdAt)}
                    </p>
                    {notification.isActionable && (
                      <span className="text-[10px] text-amber-300">Action requise</span>
                    )}
                  </div>
                </div>
                {!notification.isRead && (
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-neox-emerald mt-1.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

