import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ProductionEventView } from '@/api/v2/types/events';
import { v2 } from '@/api/v2/v2';

/**
 * Detail data before the detail page opens: `prefetch` on row hover / focus (cheap: one GET, skipped
 * while fresh), `seed` on open puts the list row in the detail cache as already stale, so the page
 * renders at once and refreshes in the background.
 */
export function usePrefetchEvent() {
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const keyOf = useCallback((id: string) => v2Keys.detail(tenantId ?? '-', 'production-events', id), [tenantId]);

  const prefetch = useCallback(
    (id: string) => {
      if (!tenantId) return;
      void client.prefetchQuery({
        queryKey: keyOf(id),
        staleTime: 30_000,
        queryFn: async ({ signal }) =>
          (await v2.get<ProductionEventView, '/api/v2/production-events/{id}'>('/api/v2/production-events/{id}', { path: { id }, signal })).data,
      });
    },
    [client, keyOf, tenantId],
  );

  const seed = useCallback(
    (event: ProductionEventView) => {
      if (!tenantId || client.getQueryData(keyOf(event.id))) return;
      client.setQueryData(keyOf(event.id), event, { updatedAt: 0 });
    },
    [client, keyOf, tenantId],
  );

  return { prefetch, seed };
}
