import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { QueryParams } from '../request-url';
import type { BodyOf, QueryOf } from '../schema-types';
import type { EventAttributedLossesView, EventSelectionView, ProductionEventHistoryView, ProductionEventView } from '../types/events';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type ProductionEventFilters = Omit<QueryOf<'/api/v2/production-events', 'get'>, 'cursor'>;

/** Keyset list of production events, filtered on the server (UX02: never the whole tenant). */
export function useProductionEvents(
  filters: ProductionEventFilters,
  tz?: string,
  options: { refetchInterval?: number; enabled?: boolean } = {},
) {
  const { from, to, unitIds, ...rest } = filters;
  return useV2InfiniteList<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query: filters as QueryParams,
    key: { scope: { unitIds }, window: { from, to, tz }, filters: rest },
    ...options,
  });
}

export function useProductionEvent(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-events', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['production-events'],
    queryFn: async ({ signal }) =>
      (await v2.get<ProductionEventView, '/api/v2/production-events/{id}'>('/api/v2/production-events/{id}', {
        path: { id: id as string },
        signal,
      })).data,
  });
}

export type EventSelectionQuery = QueryOf<'/api/v2/production-events/selection', 'get'>;

/**
 * SME D13: the events matching the list filters as a versioned snapshot, read when the user asks to code
 * "all matching" (never cached: the snapshot must be what the user confirms now).
 */
export function useEventSelection(query: EventSelectionQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'production-events', { filters: { selection: query } }),
    enabled: Boolean(tenantId && query),
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      (await v2.get<EventSelectionView, '/api/v2/production-events/selection'>('/api/v2/production-events/selection', {
        query: query as EventSelectionQuery,
        signal,
      })).data,
  });
}

export function useProductionEventHistory(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-events', id ?? '-', 'revisions'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['production-events'],
    queryFn: async ({ signal }) =>
      (await v2.get<ProductionEventHistoryView, '/api/v2/production-events/{id}/revisions'>(
        '/api/v2/production-events/{id}/revisions',
        { path: { id: id as string }, signal },
      )).data,
  });
}

/**
 * G-2(b): the loss lines whose cause is the event, per period revision (approved / provisional), as the
 * server stores them — quantities per kind and unit, values per currency; nothing is summed here.
 */
export function useEventAttributedLosses(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'production-events', id ?? '-', 'attributed-losses'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['production-events'],
    queryFn: async ({ signal }) =>
      (await v2.get<EventAttributedLossesView, '/api/v2/production-events/{id}/attributed-losses'>(
        '/api/v2/production-events/{id}/attributed-losses',
        { path: { id: id as string }, signal },
      )).data,
  });
}

export interface PatchEventInput {
  event: Pick<ProductionEventView, 'id' | 'rowVersion' | 'startTime' | 'endTime'>;
  changes: BodyOf<'/api/v2/production-events/{id}', 'patch'>;
}

/** Edits user fields with `If-Match` = the row version the user saw (412 → StaleRevisionError). */
export function usePatchProductionEvent() {
  const tenantId = useV2TenantId();
  return useV2Command<PatchEventInput, ProductionEventView>({
    run: async ({ input }) =>
      (await v2.patch<ProductionEventView, '/api/v2/production-events/{id}'>('/api/v2/production-events/{id}', {
        path: { id: input.event.id },
        body: input.changes,
        ifMatch: ifMatchOf(input.event.rowVersion),
      })).data,
    retries: 0,
    // the interval before and after the edit: periods and reports of both windows change
    changes: (input, result) =>
      tenantId
        ? [input.event, result].map((event) => ({
            tenantId,
            entityType: 'production_event',
            entityId: input.event.id,
            window: { from: event.startTime, to: event.endTime },
          }))
        : null,
  });
}
