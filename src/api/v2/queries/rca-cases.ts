import { useQuery } from '@tanstack/react-query';
import type {
  EventEvidencePackageView,
  RcaActionView,
  RcaCaseSummaryView,
  RcaCaseView,
  RcaLinkView,
  RcaOutcomeView,
  RcaRecommendationView,
} from '../types/rca';
import type { ListResponse } from '../types/envelopes';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Server-side case search (plan 3.9 §16.2): status, unit, asset / reason / window of linked events, title. */
export interface RcaCaseFilters {
  status?: string;
  unitId?: string;
  assetId?: string;
  reasonCodeId?: string;
  q?: string;
  from?: string;
  to?: string;
}

export function useRcaCases(filters: RcaCaseFilters, enabled = true) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)));
  const list = useV2InfiniteList<RcaCaseSummaryView>({
    resource: 'rca-cases',
    path: '/rcas',
    query: { limit: 50, ...query },
    key: { filters: query },
    enabled,
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

function useRcaDetail<T>(id: string | null, variant: string | undefined, load: (id: string, signal: AbortSignal) => Promise<T>) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rca-cases', id ?? '-', variant),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['rca-cases'],
    queryFn: ({ signal }) => load(id as string, signal),
  });
}

export function useRcaCase(id: string | null) {
  return useRcaDetail(id, undefined, async (rcaId, signal) =>
    (await v2.get<RcaCaseView, '/api/v2/rcas/{id}'>('/api/v2/rcas/{id}', { path: { id: rcaId }, signal })).data,
  );
}

export function useRcaLinks(id: string | null) {
  return useRcaDetail(id, 'links', async (rcaId, signal) =>
    (await v2.get<RcaLinkView[], '/api/v2/rcas/{id}/links'>('/api/v2/rcas/{id}/links', { path: { id: rcaId }, signal })).data,
  );
}

export function useRcaActions(id: string | null) {
  return useRcaDetail(id, 'actions', async (rcaId, signal) =>
    (await v2.get<RcaActionView[], '/api/v2/rcas/{id}/actions'>('/api/v2/rcas/{id}/actions', { path: { id: rcaId }, signal })).data,
  );
}

/** Approved historical loss, claimed avoided loss and realized difference — three separate figures. */
export function useRcaOutcome(id: string | null) {
  return useRcaDetail(id, 'outcome', async (rcaId, signal) =>
    (await v2.get<RcaOutcomeView, '/api/v2/rcas/{id}/outcome'>('/api/v2/rcas/{id}/outcome', { path: { id: rcaId }, signal })).data,
  );
}

/** Evidence package an event would be linked with now (preview; nothing is stored). */
export function useEventRcaEvidence(eventId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rca-cases', eventId ?? '-', 'event-evidence'),
    enabled: Boolean(tenantId && eventId),
    staleTime: STALE_TIME['rca-cases'],
    queryFn: async ({ signal }) =>
      (await v2.get<EventEvidencePackageView, '/api/v2/production-events/{id}/rca-evidence'>(
        '/api/v2/production-events/{id}/rca-evidence',
        { path: { id: eventId as string }, signal },
      )).data,
  });
}

/** Open recommendations (RCARecommended) for some events, or for the whole scope when `eventIds` is empty. */
export function useRcaRecommendations(eventIds: readonly string[], enabled = true) {
  const tenantId = useV2TenantId();
  const ids = [...eventIds].sort();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'rca-recommendations', { filters: { eventIds: ids } }),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME['rca-recommendations'],
    queryFn: async ({ signal }) =>
      (await v2.get<ListResponse<RcaRecommendationView>, '/api/v2/rca-recommendations'>('/api/v2/rca-recommendations', {
        query: { eventIds: ids.length ? ids : undefined, limit: 200 },
        signal,
      })).data.items,
  });
}
