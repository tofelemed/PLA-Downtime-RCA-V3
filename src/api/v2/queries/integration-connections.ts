import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf, QueryOf } from '../schema-types';
import type { ConnectionTestView, ConnectionView, DiscoveryView, SourceSampleView } from '../types/integrations';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type ConnectionCreateBody = BodyOf<'/api/v2/connections', 'post'>;
export type ConnectionUpdateBody = BodyOf<'/api/v2/connections/{id}', 'patch'>;
export type SampleQuery = QueryOf<'/api/v2/connections/{id}/sample', 'get'>;

/** Connections of the acting tenant, secrets redacted (`hasSecret` only; plan 1.5 / 3.7). */
export function useConnections(includeInactive: boolean) {
  const list = useV2InfiniteList<ConnectionView>({
    resource: 'connections',
    path: '/connections',
    query: { limit: 100, includeInactive },
    key: { filters: { includeInactive } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

export function useConnection(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'connections', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME.connections,
    queryFn: async ({ signal }) =>
      (await v2.get<ConnectionView, '/api/v2/connections/{id}'>('/api/v2/connections/{id}', { path: { id: id as string }, signal })).data,
  });
}

function useConnectionCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>, mutates = true) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (mutates && tenantId ? { tenantId, entityType: 'integration_connection' } : null),
  });
}

/** Creates a connection; the secret travels once in the body and is never read back. */
export function useCreateConnection() {
  return useConnectionCommand<ConnectionCreateBody, ConnectionView>(async (body, idempotencyKey) =>
    (await v2.post<ConnectionView, '/api/v2/connections'>('/api/v2/connections', { body, idempotencyKey })).data,
  );
}

/** PATCH under If-Match (412 when someone else changed it); omit `secret` to keep the stored one. */
export function useUpdateConnection() {
  return useConnectionCommand<{ connection: Pick<ConnectionView, 'id' | 'rowVersion'>; body: ConnectionUpdateBody }, ConnectionView>(
    async (input) =>
      (await v2.patch<ConnectionView, '/api/v2/connections/{id}'>('/api/v2/connections/{id}', {
        path: { id: input.connection.id },
        body: input.body,
        ifMatch: ifMatchOf(input.connection.rowVersion),
      })).data,
  );
}

/** Staged diagnostics (PI01); started by the user, never on render. Writers only (403 otherwise). */
export function useTestConnection() {
  return useConnectionCommand<string, ConnectionTestView>(
    async (id, idempotencyKey) =>
      (await v2.post<ConnectionTestView, '/api/v2/connections/{id}/test'>('/api/v2/connections/{id}/test', { path: { id }, idempotencyKey })).data,
    false,
  );
}

/** Asset servers and AF databases of a PI connection (writers only); fetched when the panel opens. */
export function useDiscovery(id: string, enabled: boolean) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'connections', id, 'discover'),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME.connections,
    queryFn: async ({ signal }) =>
      (await v2.get<DiscoveryView, '/api/v2/connections/{id}/discover'>('/api/v2/connections/{id}/discover', { path: { id }, signal })).data,
  });
}

/** A bounded sample of recent source records (nothing is stored); null query = not requested yet. */
export function useSourceSample(id: string, query: SampleQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: [...v2Keys.detail(tenantId ?? '-', 'connections', id, 'sample'), query] as const,
    enabled: Boolean(tenantId && query),
    staleTime: STALE_TIME.connections,
    queryFn: async ({ signal }) =>
      (await v2.get<SourceSampleView, '/api/v2/connections/{id}/sample'>('/api/v2/connections/{id}/sample', {
        path: { id },
        query: query as SampleQuery,
        signal,
      })).data,
  });
}
