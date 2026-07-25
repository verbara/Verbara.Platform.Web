import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { toast } from 'sonner';

export type NotificationCategory = 'Operational' | 'System' | 'Security' | 'Billing';
export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';

/**
 * Kept hand-written (openapi-typed-client-agent): matches `NotificationDto` field-for-field EXCEPT
 * the DTO widens `category`/`severity` to bare `string`, whereas consumers require the literal
 * unions above (notification-item's `SeverityIcon` prop; notification-drawer keying a
 * `Record<TabValue, number>` by `category`). A string-widening the swap-the-T idiom cannot bridge,
 * so it stays hand-written.
 */
export interface Notification {
  notificationId: string;
  type: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

/**
 * Domain shape for the unread-count badge. The wire response is the generated `UnreadCountDto`
 * (openapi-typed-client-agent, Platform/ADR-0035), whose `count` is now single-typed `number`
 * on the regenerated document (openapi-numeric-schema-truth, Platform/ADR-0036 strips the spurious
 * AOT `string` arm at the source), so the optimistic-update arithmetic (`previousCount.count - 1`)
 * and the bell's `count > 0` read it directly — no boundary coercion.
 */
export type UnreadCountResponse = components['schemas']['UnreadCountDto'];

export interface NotificationListParams {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildParams(params: NotificationListParams): Record<string, string> {
  const result: Record<string, string> = {};
  if (params.unreadOnly !== undefined) result.unreadOnly = String(params.unreadOnly);
  if (params.limit !== undefined) result.limit = String(params.limit);
  if (params.offset !== undefined) result.offset = String(params.offset);
  return result;
}

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () =>
      customFetch<Notification[]>({
        url: '/api/v1/notifications',
        method: 'GET',
        params: buildParams(params),
      }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      customFetch<components['schemas']['UnreadCountDto']>({
        url: '/api/v1/notifications/unread-count',
        method: 'GET',
      }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/notifications/${id}/read`,
        method: 'PUT',
      }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });

      const previousLists = qc.getQueriesData<Notification[]>({
        queryKey: ['notifications', 'list'],
      });
      const previousCount = qc.getQueryData<UnreadCountResponse>(['notifications', 'unread-count']);

      qc.setQueriesData<Notification[]>({ queryKey: ['notifications', 'list'] }, (old) =>
        old?.map((n) =>
          n.notificationId === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
      );

      if (previousCount) {
        qc.setQueryData<UnreadCountResponse>(['notifications', 'unread-count'], {
          count: Math.max(0, previousCount.count - 1),
        });
      }

      return { previousLists, previousCount };
    },
    onError: (err: Error, _id, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      if (context?.previousCount !== undefined) {
        qc.setQueryData(['notifications', 'unread-count'], context.previousCount);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/notifications/read-all',
        method: 'PUT',
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });

      const previousLists = qc.getQueriesData<Notification[]>({
        queryKey: ['notifications', 'list'],
      });
      const previousCount = qc.getQueryData<UnreadCountResponse>(['notifications', 'unread-count']);

      qc.setQueriesData<Notification[]>({ queryKey: ['notifications', 'list'] }, (old) =>
        old?.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() })),
      );

      qc.setQueryData<UnreadCountResponse>(['notifications', 'unread-count'], { count: 0 });

      return { previousLists, previousCount };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      if (context?.previousCount !== undefined) {
        qc.setQueryData(['notifications', 'unread-count'], context.previousCount);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
