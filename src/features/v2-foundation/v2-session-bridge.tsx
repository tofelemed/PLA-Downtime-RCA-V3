import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { configureV2Session } from '@/api/v2/config';
import { etagCache } from '@/api/v2/etag-cache';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { createLogger } from '@/lib/logger';
import { httpClient } from '@/services/api/httpClient';
import { sessionAuthorityKey } from '@/features/auth/session-authority-key';

const log = createLogger('V2Session');

/**
 * Connects the v2 client to the session (plan 3.1, UX02): token and acting tenant are read at call time;
 * a 401 that survives a refresh ends the session. The whole query cache (and the ETag cache) is cleared
 * when the acting tenant changes or the session ends, so no screen ever shows another tenant's data.
 * The v1 `httpClient` reads the same acting tenant, so v1 and v2 requests always name the same plant.
 */
export function V2SessionBridge(): null {
  const queryClient = useQueryClient();
  const { session, getAccessToken, getSessionKey, refreshSession, expireSession } = useAuth();
  const tenantId = useV2TenantId();
  const latest = useRef({ tenantId, getAccessToken, getSessionKey, refreshSession, expireSession });
  latest.current = { tenantId, getAccessToken, getSessionKey, refreshSession, expireSession };

  useEffect(() => {
    const unconfigure = configureV2Session({
      getAccessToken: () => latest.current.getAccessToken(),
      getTenantId: () => latest.current.tenantId,
      getSessionKey: () => latest.current.getSessionKey?.() ?? '',
      refresh: () => latest.current.refreshSession(),
      onSessionExpired: () => {
        log.warn('Session expired; signing out');
        latest.current.expireSession();
      },
    });
    httpClient.setTenantProvider(() => latest.current.tenantId);
    return () => {
      httpClient.setTenantProvider(undefined);
      unconfigure();
    };
  }, []);

  useCacheReset(queryClient, session ? `${sessionAuthorityKey(session.user)}:${tenantId ?? ''}` : null);
  return null;
}

/** Clears every cached query whenever `cacheOwner` (tenant while signed in, else null) changes. */
function useCacheReset(queryClient: ReturnType<typeof useQueryClient>, cacheOwner: string | null): void {
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== cacheOwner) {
      queryClient.clear();
      etagCache.clear();
    }
    previous.current = cacheOwner;
  }, [queryClient, cacheOwner]);
}
