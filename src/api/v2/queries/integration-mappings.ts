import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type {
  AttributeMappingPreviewView,
  AttributeMappingVersionView,
  EffectiveTemplateMapping,
  FieldCatalogView,
  MatchKind,
  MappingPreviewView,
  SourceMappingView,
} from '../types/integration-mappings';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { usePagedQuery } from './use-paged-query';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type AttributePreviewBody = BodyOf<'/api/v2/attribute-mappings/preview', 'post'>;
export type AttributeMappingBody = BodyOf<'/api/v2/attribute-mappings', 'post'>;
export type SourceMappingBody = BodyOf<'/api/v2/source-mappings', 'post'>;
export type SourceMappingPreviewBody = BodyOf<'/api/v2/source-mappings/preview', 'post'>;

/** The shared event field catalog (ING04): fields, accepted types, default rules per template. */
export function useFieldCatalog() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'attribute-mappings', 'field-catalog'),
    enabled: Boolean(tenantId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => (await v2.get<FieldCatalogView, '/api/v2/field-catalog'>('/api/v2/field-catalog', { signal })).data,
  });
}

/** Effective rules per template for a connection, with the override version in force. */
export function useEffectiveMappings(connectionId: string) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'attribute-mappings', { filters: { connectionId } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['attribute-mappings'],
    queryFn: async ({ signal }) =>
      (await v2.get<EffectiveTemplateMapping[], '/api/v2/attribute-mappings'>('/api/v2/attribute-mappings', { query: { connectionId }, signal }))
        .data,
  });
}

function useMappingCommand<TInput, TResult>(entityType: string | null, run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (entityType && tenantId ? { tenantId, entityType } : null),
  });
}

/** Typed mapping preview of one sample record (read-only POST; nothing is stored). */
export function useAttributePreview() {
  return useMappingCommand<AttributePreviewBody, AttributeMappingPreviewView>(null, async (body, idempotencyKey) =>
    (await v2.post<AttributeMappingPreviewView, '/api/v2/attribute-mappings/preview'>('/api/v2/attribute-mappings/preview', { body, idempotencyKey }))
      .data,
  );
}

/** Saves the next override version of a template (422 INVALID_FIELD_RULES). */
export function useSaveAttributeMapping() {
  return useMappingCommand<AttributeMappingBody, AttributeMappingVersionView>('attribute_mapping', async (body, idempotencyKey) =>
    (await v2.post<AttributeMappingVersionView, '/api/v2/attribute-mappings'>('/api/v2/attribute-mappings', { body, idempotencyKey })).data,
  );
}

/** Source → plant mapping rules of the tenant (every connection's and the "any connection" ones), pages of 20. */
export function useSourceMappingsPage(includeInactive: boolean, matchKind?: MatchKind) {
  return usePagedQuery<SourceMappingView>({
    resource: 'source-mappings',
    path: '/source-mappings',
    query: { includeInactive, matchKind },
    key: { filters: { includeInactive, matchKind: matchKind ?? null } },
  });
}

/** Every active rule of the tenant (lookup for the stage tracker); later pages are followed. */
export function useActiveSourceMappings() {
  const list = useV2InfiniteList<SourceMappingView>({
    resource: 'source-mappings',
    path: '/source-mappings',
    query: { limit: 200 },
    key: { filters: { lookup: true } },
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** One mapping rule (ETag = rowVersion); null id = a new rule. */
export function useSourceMapping(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'source-mappings', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME['source-mappings'],
    queryFn: async ({ signal }) =>
      (await v2.get<SourceMappingView, '/api/v2/source-mappings/{id}'>('/api/v2/source-mappings/{id}', { path: { id: id as string }, signal })).data,
  });
}

/** Resolves sample identifiers like an incoming record would be (read-only POST). */
export function useSourceMappingPreview() {
  return useMappingCommand<SourceMappingPreviewBody, MappingPreviewView>(null, async (body, idempotencyKey) =>
    (await v2.post<MappingPreviewView, '/api/v2/source-mappings/preview'>('/api/v2/source-mappings/preview', { body, idempotencyKey })).data,
  );
}

/** Binds a source identifier to a unit or asset (422 INVALID_REFERENCE, 409 MAPPING_EXISTS). */
export function useCreateSourceMapping() {
  return useMappingCommand<SourceMappingBody, SourceMappingView>('source_mapping', async (body, idempotencyKey) =>
    (await v2.post<SourceMappingView, '/api/v2/source-mappings'>('/api/v2/source-mappings', { body, idempotencyKey })).data,
  );
}

/** Replaces a rule as its next version under If-Match (412 when someone else changed it). */
export function useReplaceSourceMapping() {
  return useMappingCommand<{ mapping: Pick<SourceMappingView, 'id' | 'rowVersion'>; body: SourceMappingBody }, SourceMappingView>(
    'source_mapping',
    async (input) =>
      (await v2.put<SourceMappingView, '/api/v2/source-mappings/{id}'>('/api/v2/source-mappings/{id}', {
        path: { id: input.mapping.id },
        body: input.body,
        ifMatch: ifMatchOf(input.mapping.rowVersion),
      })).data,
  );
}
