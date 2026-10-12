import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { invalidateForChange, resyncTenant } from '@/api/v2/queries/invalidation';
import { SOCKET_BASE_URL } from '@/services/api/apiBaseUrl';
import { createInvalidationBatcher, INVALIDATION_BATCH_MS } from './invalidation-batcher';
import { realtimeBus } from './realtime-bus';
import { setRealtimeStatus } from './realtime-status';
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
  /** coalescing window of cache invalidations in ms (default 500; 0 = apply each notice at once) */
  batchMs?: number;
}

/**
 * Keeps one scoped realtime connection for the acting tenant (plan 3.1): notices are coalesced for
 * `batchMs` and then invalidate, once per entity type and merged window, the cached results they can
 * affect (event → events, overlapping periods, reports); a gap or an unknown position after reconnect
 * refetches the tenant's snapshot. A tenant change opens a new connection. The connection state feeds
 * the header's live indicator (`realtime-status.ts`).
 */
export function useScopedRealtime(options: ScopedRealtimeOptions): void {
  const queryClient = useQueryClient();
  const { tenantId } = options;
  const tokenRef = useRef(options.getAccessToken);
  tokenRef.current = options.getAccessToken;
  const factory = options.factory ?? defaultSocketFactory;
  const baseUrl = options.baseUrl ?? SOCKET_BASE_URL;
  const batchMs = options.batchMs ?? INVALIDATION_BATCH_MS;

  useEffect(() => {
    if (!tenantId || !tokenRef.current()) return undefined;
    const credentials = (): RealtimeCredentials | null => {
      const token = tokenRef.current();
      return token ? { token, tenantId } : null;
    };
    const batcher = createInvalidationBatcher((notices) => {
      for (const notice of notices) void invalidateForChange(queryClient, notice);
    }, batchMs);
    const client = new ScopedRealtimeClient(
      factory,
      {
        onNotice: (notice) => {
          const change = { tenantId, entityType: notice.entityType, entityId: notice.entityId, window: notice.window };
          if (batchMs > 0) batcher.add(change);
          else void invalidateForChange(queryClient, change);
          realtimeBus.publish({ kind: 'notice', notice });
        },
        onResync: (rooms) => {
          batcher.dispose();
          void resyncTenant(queryClient, tenantId);
          realtimeBus.publish({ kind: 'resync', rooms });
        },
        onConnectionChange: (connected) => setRealtimeStatus(connected ? 'live' : 'offline'),
      },
      credentials,
    );
    setRealtimeStatus('connecting');
    client.start(`${baseUrl}/realtime`);
    return () => {
      batcher.dispose();
      client.stop();
      setRealtimeStatus('idle');
    };
  }, [tenantId, queryClient, factory, baseUrl, batchMs]);
}
