import { apiRequest } from '../lib/apiClient';
import type { NotificationApprovalMeta } from '../store/notifications/useNotificationStore';

export async function triggerNotificationAction(params: {
  notificationId: string;
  action: 'approve' | 'reject';
  approval: NotificationApprovalMeta | null | undefined;
  actorUserId?: string;
  actorDisplayName?: string;
  comment?: string;
  reason?: string;
}) {
  return apiRequest<{ ok: boolean; result?: unknown; message?: string }>('/api/v1/notifications/action', {
    method: 'POST',
    body: {
      notificationId: params.notificationId,
      action: params.action,
      approval: params.approval || null,
      actorUserId: params.actorUserId,
      actorDisplayName: params.actorDisplayName,
      comment: params.comment,
      reason: params.reason,
    },
  });
}
