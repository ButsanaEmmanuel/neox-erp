import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectSse, type SseConnection } from '../../lib/sseClient';
import { apiRequest } from '../../lib/apiClient';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationApprovalMeta {
  entityType: string;
  entityId: string;
}

export interface AppNotification {
  id: string;
  type: string;
  uiType: NotificationType;
  title: string;
  message: string;
  sender?: string;
  details?: string;
  link?: string;
  department?: string;
  metadata?: Record<string, unknown>;
  approval?: NotificationApprovalMeta | null;
  isActionable?: boolean;
  isRead: boolean;
  createdAt: string;
  targetUserId?: string;
  targetRole?: string[];
  targetDepartmentId?: string[];
}

function normalizeArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
}

export function matchesNotificationTarget(
  notification: AppNotification,
  userId: string,
  userRole: string,
  userDepartmentId?: string,
): boolean {
  const targetRoles = normalizeArray(notification.targetRole);
  const targetDepartments = normalizeArray(notification.targetDepartmentId);
  const matchesUser = !notification.targetUserId || notification.targetUserId === userId;
  const matchesRole = targetRoles.length === 0 || targetRoles.map((r) => r.toUpperCase()).includes(String(userRole || '').toUpperCase());
  const matchesDept = targetDepartments.length === 0 || (userDepartmentId ? targetDepartments.includes(userDepartmentId) : false);
  return matchesUser && matchesRole && matchesDept;
}

interface NotificationStore {
  notifications: AppNotification[];
  syncNotifications: (userId: string, take?: number) => Promise<void>;
  // Backward-compat alias (older components/HMR snapshots)
  syncProjectTeamNotifications: (userId: string, take?: number) => Promise<void>;
  startRealtime: (userId: string) => void;
  stopRealtime: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (userId: string, userRole: string, userDepartmentId?: string) => void;
  clearRead: () => void;
}

function mapUiType(type: string): NotificationType {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('error') || normalized.includes('rejected')) return 'error';
  if (normalized.includes('warning') || normalized.includes('pending')) return 'warning';
  if (normalized.includes('success') || normalized.includes('approved') || normalized.includes('synced')) return 'success';
  return 'info';
}

const realtimeRef: { connection: SseConnection | null } = { connection: null };

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],

      syncNotifications: async (userId: string, take = 50) => {
        if (!userId) return;
        try {
          const response = await apiRequest<{ notifications: Array<Record<string, unknown>> }>(
            `/api/v1/notifications?userId=${encodeURIComponent(userId)}&take=${take}`,
          );
          const incoming: AppNotification[] = (response.notifications || []).map((row) => ({
            id: String(row.id || crypto.randomUUID()),
            type: String(row.type || row.actionType || 'INFO'),
            uiType: mapUiType(String(row.type || row.actionType || 'info')),
            title: String(row.title || 'Notification'),
            message: String(row.message || row.details || ''),
            sender: row.sender ? String(row.sender) : undefined,
            details: row.details ? String(row.details) : undefined,
            link: row.link ? String(row.link) : undefined,
            department: row.department ? String(row.department) : undefined,
            metadata: (row.metadata && typeof row.metadata === 'object') ? (row.metadata as Record<string, unknown>) : undefined,
            approval: (row.approval && typeof row.approval === 'object')
              ? {
                  entityType: String((row.approval as Record<string, unknown>).entityType || ''),
                  entityId: String((row.approval as Record<string, unknown>).entityId || ''),
                }
              : null,
            isActionable: Boolean(row.isActionable),
            isRead: false,
            createdAt: String(row.createdAt || new Date().toISOString()),
            targetUserId: row.targetUserId ? String(row.targetUserId) : undefined,
            targetRole: normalizeArray((row as Record<string, unknown>).targetRole),
            targetDepartmentId: normalizeArray((row as Record<string, unknown>).targetDepartmentId),
          }));

          set((state) => {
            const prior = new Map(state.notifications.map((n) => [n.id, n]));
            const merged = incoming.map((n) => {
              const existing = prior.get(n.id);
              return existing ? { ...n, isRead: existing.isRead } : n;
            });
            const extras = state.notifications.filter((n) => !merged.some((m) => m.id === n.id));
            return { notifications: [...merged, ...extras].slice(0, 300) };
          });
        } catch (error) {
          console.error('Failed to sync notifications', error);
        }
      },

      syncProjectTeamNotifications: async (userId: string, take = 50) => {
        return get().syncNotifications(userId, take);
      },

      startRealtime: (userId: string) => {
        if (!userId) return;
        if (realtimeRef.connection) return;
        realtimeRef.connection = connectSse(userId, {
          notification_created: (payload) => {
            const raw = payload || {};
            const id = String(raw.id || crypto.randomUUID());
            set((state) => {
              if (state.notifications.some((n) => n.id === id)) return state;
              const next: AppNotification = {
                id,
                type: String(raw.type || raw.actionType || 'INFO'),
                uiType: mapUiType(String(raw.type || raw.actionType || 'info')),
                title: String(raw.title || `Project update: ${String(raw.projectName || 'Project')}`),
                message: String(raw.message || raw.details || 'New notification'),
                sender: raw.sender ? String(raw.sender) : undefined,
                details: raw.details ? String(raw.details) : undefined,
                link: raw.link
                  ? String(raw.link)
                  : (raw.projectId ? `/projects/${encodeURIComponent(String(raw.projectId))}/work-items` : undefined),
                department: raw.department ? String(raw.department) : undefined,
                metadata: (raw.meta && typeof raw.meta === 'object') ? (raw.meta as Record<string, unknown>) : undefined,
                approval: (raw.approval && typeof raw.approval === 'object')
                  ? {
                      entityType: String((raw.approval as Record<string, unknown>).entityType || ''),
                      entityId: String((raw.approval as Record<string, unknown>).entityId || ''),
                    }
                  : null,
                isActionable: Boolean(raw.isActionable),
                isRead: false,
                createdAt: String(raw.createdAt || new Date().toISOString()),
                targetUserId: raw.targetUserId ? String(raw.targetUserId) : undefined,
                targetRole: normalizeArray(raw.targetRole),
                targetDepartmentId: normalizeArray(raw.targetDepartmentId),
              };
              return { notifications: [next, ...state.notifications].slice(0, 300) };
            });
          },
        });
      },

      stopRealtime: () => {
        realtimeRef.connection?.close();
        realtimeRef.connection = null;
      },

      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      })),

      markAllAsRead: (userId, userRole, userDepartmentId) => set((state) => ({
        notifications: state.notifications.map((n) => {
          if (matchesNotificationTarget(n, userId, userRole, userDepartmentId) && !n.isRead) return { ...n, isRead: true };
          return n;
        }),
      })),

      clearRead: () => set((state) => ({
        notifications: state.notifications.filter((n) => !n.isRead),
      })),
    }),
    { name: 'neox-notifications-storage' },
  ),
);
