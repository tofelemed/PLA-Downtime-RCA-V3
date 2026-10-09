import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { invalidateForChange, resyncTenant } from '@/api/v2/queries/invalidation';
import { SOCKET_BASE_URL } from '@/services/api/apiBaseUrl';
import { realtimeBus } from './realtime-bus';
import type { RealtimeCredentials, SocketFactory } from './realtime-types';
import { ScopedRealtimeClient } from './scoped-socket';

/** socket.io client on the `/realtime` namespace; the token travels in the handshake `auth` callback. */
export const defaultSocketFactory: SocketFactory = (url, auth) =>
  io(url, {
    auth,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
  });

export interface ScopedRealtimeOptions {
  tenantId: string | null;
  getAccessToken: () => string | null;
  factory?: SocketFactory;
  baseUrl?: string;
}

/**
 * Keeps one scoped realtime connection for the acting tenant (plan 3.1): every notice invalidates the
 * cached results it can affect (event → events, overlapping periods, reports); a gap or an unknown
 * position after reconnect refetches the tenant's snapshot. A tenant change opens a new connection.
 */
export function useScopedRealtime(options: ScopedRealtimeOptions): void {
  const queryClient = useQueryClient();
  const { tenantId } = options;
  const tokenRef = useRef(options.getAccessToken);
  tokenRef.current = options.getAccessToken;
  const factory = options.factory ?? defaultSocketFactory;
  const baseUrl = options.baseUrl ?? SOCKET_BASE_URL;

  useEffect(() => {
    if (!tenantId || !tokenRef.current()) return undefined;
    const credentials = (): RealtimeCredentials | null => {
      const token = tokenRef.current();
      return token ? { token, tenantId } : null;
    };
    const client = new ScopedRealtimeClient(
      factory,
      {
        onNotice: (notice) => {
          void invalidateForChange(queryClient, {
            tenantId,
            entityType: notice.entityType,
            entityId: notice.entityId,
            window: notice.window,
          });
          realtimeBus.publish({ kind: 'notice', notice });
        },
        onResync: (rooms) => {
          void resyncTenant(queryClient, tenantId);
          realtimeBus.publish({ kind: 'resync', rooms });
        },
      },
      credentials,
    );
    client.start(`${baseUrl}/realtime`);
    return () => client.stop();
  }, [tenantId, queryClient, factory, baseUrl]);
}
