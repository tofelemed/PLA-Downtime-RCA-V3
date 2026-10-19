import { useQuery } from '@tanstack/react-query';
import { v2Request, type V2Method } from '../client';
import type { QueryParams } from '../request-url';
import { sameTenantQuery } from './placeholder';
import { v2Keys, type V2Resource } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** One administration call; returns the response body. POST commands carry the attempt's key. */
export async function adminCall<T>(
  method: V2Method,
  path: string,
  options: { query?: QueryParams; body?: unknown; idempotencyKey?: string; ifMatch?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await v2Request<T>({ method, path, ...options });
  return response.data;
}

/** A single administration record (detail page), cached per tenant; disabled without an id. */
export function useAdminRecord<T>(resource: V2Resource, id: string | null | undefined, path: string, variant?: string) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', resource, id ?? '-', variant),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME[resource],
    queryFn: ({ signal }) => adminCall<T>('GET', path, { signal }),
  });
}

/** A small administration read keyed like a list (summaries, lookups), keeping the previous result. */
export function useAdminRead<T>(resource: V2Resource, path: string, query: QueryParams = {}, enabled = true) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', resource, { filters: { path, ...query } }),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME[resource],
    queryFn: ({ signal }) => adminCall<T>('GET', path, { query, signal }),
    placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
  });
}

/**
 * An administration command: `run` gets the input and the attempt's Idempotency-Key; success refreshes
 * the cached results of `entityType` (see `RELATED_RESOURCES`). No automatic retry: these are user actions.
 */
export function useAdminCommand<TInput, TResult>(
  entityType: string,
  run: (input: TInput, idempotencyKey: string) => Promise<TResult>,
) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType } : null),
    retries: 0,
  });
}

/** Query parameters without empty values, so cache keys do not change with blank filters. */
export function compactQuery(query: QueryParams): QueryParams {
  const entries = Object.entries(query).filter(
    ([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0),
  );
  return Object.fromEntries(entries);
}
