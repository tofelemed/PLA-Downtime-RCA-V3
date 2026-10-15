import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { NotificationView } from '../types/notifications';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

const PAGE = 20;

/** The newest notifications of the signed-in user in the acting plant (refreshed by realtime hints). */
export function useNotifications(enabled = true) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'notifications', { filters: { limit: PAGE } }),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME.notifications,
    queryFn: async ({ signal }) => (await v2Request<ListResponse<NotificationView>>({ method: 'GET', path: '/notifications', query: { limit: PAGE }, signal })).data,
  });
}

/** How many of them are unread (the header badge). */
export function useUnreadNotificationCount() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'notifications', 'unread-count'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.notifications,
    queryFn: async ({ signal }) => (await v2Request<{ unread: number }>({ method: 'GET', path: '/notifications/unread-count', signal })).data,
  });
}

function useNotificationCommand<TInput>(path: (input: TInput) => string) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, unknown>({
    run: async ({ input, idempotencyKey }) => (await v2Request<unknown>({ method: 'POST', path: path(input), body: {}, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'user_notification' } : null),
    retries: 1,
  });
}

export function useMarkNotificationRead() {
  return useNotificationCommand<{ id: string }>(({ id }) => `/notifications/${id}/read`);
}

export function useMarkAllNotificationsRead() {
  return useNotificationCommand<void>(() => '/notifications/read-all');
}
