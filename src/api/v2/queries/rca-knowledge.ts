import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { RcaKnowledgeSimilarView, RcaKnowledgeView } from '../types/rca-knowledge';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Server-side filters of `GET /v2/rca-knowledge` (never applied in the browser). */
export interface RcaKnowledgeFilters {
  q?: string;
  unitId?: string;
  assetId?: string;
  reasonCodeId?: string;
  published?: boolean;
  from?: string;
  to?: string;
}

export const KNOWLEDGE_PAGE_SIZE = 25;

export function useRcaKnowledgeList(filters: RcaKnowledgeFilters) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
  const list = useV2InfiniteList<RcaKnowledgeView>({
    resource: 'rca-knowledge',
    path: '/rca-knowledge',
    query: { limit: KNOWLEDGE_PAGE_SIZE, ...query },
    key: { filters: query },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

export function useRcaKnowledgeEntry(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rca-knowledge', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['rca-knowledge'],
    queryFn: async ({ signal }) =>
      (await v2.get<RcaKnowledgeView, '/api/v2/rca-knowledge/{id}'>('/api/v2/rca-knowledge/{id}', { path: { id: id as string }, signal })).data,
  });
}

/** Similar past RCAs of an event, ranked by the server (asset, reason, unit). */
export function useSimilarKnowledge(eventId: string | null, enabled = true) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rca-knowledge', eventId ?? '-', 'similar'),
    enabled: Boolean(tenantId && eventId) && enabled,
    staleTime: STALE_TIME['rca-knowledge'],
    queryFn: async ({ signal }) =>
      (await v2.get<RcaKnowledgeSimilarView[], '/api/v2/rca-knowledge/similar'>('/api/v2/rca-knowledge/similar', {
        query: { eventId: eventId as string, limit: 5 },
        signal,
      })).data,
  });
}

function useKnowledgeCommand<TInput>(run: (input: TInput, idempotencyKey: string) => Promise<RcaKnowledgeView>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, RcaKnowledgeView>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType: 'rca_knowledge' } : null),
    retries: 0,
  });
}

/** The caller's vote; a repeat replaces it on the server (one vote per user and entry). */
export function useVoteKnowledge() {
  return useKnowledgeCommand<{ id: string; helpful: boolean }>(async (input, idempotencyKey) =>
    (await v2.post<RcaKnowledgeView, '/api/v2/rca-knowledge/{id}/votes'>('/api/v2/rca-knowledge/{id}/votes', {
      path: { id: input.id },
      body: { helpful: input.helpful },
      idempotencyKey,
    })).data,
  );
}

/** Publish (`publish` true) or withdraw with `If-Match` = the row version the user saw (412 when stale). */
export function usePublishKnowledge() {
  return useKnowledgeCommand<{ entry: Pick<RcaKnowledgeView, 'id' | 'rowVersion'>; publish: boolean }>(async (input, idempotencyKey) => {
    const args = { path: { id: input.entry.id }, idempotencyKey, ifMatch: ifMatchOf(input.entry.rowVersion) };
    const response = input.publish
      ? await v2.post<RcaKnowledgeView, '/api/v2/rca-knowledge/{id}/publish'>('/api/v2/rca-knowledge/{id}/publish', args)
      : await v2.post<RcaKnowledgeView, '/api/v2/rca-knowledge/{id}/unpublish'>('/api/v2/rca-knowledge/{id}/unpublish', args);
    return response.data;
  });
}
