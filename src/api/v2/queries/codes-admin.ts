import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v2Request } from '../client';
import { ifMatchOf } from '../etag-cache';
import type { QueryParams } from '../request-url';
import type { BodyOf } from '../schema-types';
import type { ListResponse } from '../types/envelopes';
import type { ValuationRateView } from '../types/profiles';
import type {
  CodeDetailView,
  CodeLibraryPath,
  CodeMappingPreviewView,
  CodeMappingRuleView,
  CodeReferencesView,
  CodeVersionView,
  FailureGroupKind,
} from '../types/codes-admin';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Every library takes the same create / change bodies (fields of another library are 422). */
export type CodeCreateBody = BodyOf<'/api/v2/reason-codes', 'post'>;
export type CodeChangeBody = BodyOf<'/api/v2/reason-codes/{id}', 'put'>;
export type CodeMappingRuleBody = BodyOf<'/api/v2/code-mapping-rules', 'post'>;

export interface CodeListFilters {
  includeRetired?: boolean;
  groupKind?: FailureGroupKind;
}

/** Safety stop of `fetchAllPages`: 40 pages of 500 = 20,000 rows, far above any code library. */
const MAX_PAGES = 40;

/** Every page of a v2 keyset list (lookups that fill pickers: never cut off at the first page). */
async function fetchAllPages<T>(path: string, query: QueryParams, signal: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await v2Request<ListResponse<T>>({ method: 'GET', path, query: { ...query, limit: 500, cursor }, signal });
    items.push(...response.data.items);
    if (!response.data.nextCursor) return items;
    cursor = response.data.nextCursor;
  }
  throw new Error('The list is longer than the screen can load. Narrow it down and try again.');
}

/**
 * Every code of one library of the acting tenant (NFR01: never another tenant's), all pages: the lookup
 * behind pickers (parents, move targets, impact codes) and the code search. Not a displayed table.
 */
export function useCodeList(library: CodeLibraryPath, filters: CodeListFilters = {}) {
  const tenantId = useV2TenantId();
  const query = useQuery<CodeDetailView[]>({
    queryKey: v2Keys.list(tenantId ?? '-', 'codes', { filters: { library, lookup: true, ...filters } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.codes,
    placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: ({ signal }) => fetchAllPages<CodeDetailView>(`/${library}`, { ...filters }, signal),
  });
  return { ...query, items: query.data ?? [] };
}

/**
 * The top level of a library, 20 per page (hierarchical libraries: roots only; flat libraries: every
 * code). Children are loaded when a node is expanded (`useCodeChildren`).
 */
export function useCodeRoots(library: CodeLibraryPath, hierarchical: boolean, includeRetired: boolean) {
  const query = { includeRetired, ...(hierarchical ? { rootsOnly: true } : {}) };
  return usePagedQuery<CodeDetailView>({
    resource: 'codes',
    path: `/${library}`,
    query,
    key: { filters: { library, level: 'roots', ...query } },
  });
}

/** Direct children of one code, loaded on expand (pages of 100, "Show more" for the rest). */
export function useCodeChildren(library: CodeLibraryPath, parentId: string, includeRetired: boolean, enabled: boolean) {
  const list = useV2InfiniteList<CodeDetailView>({
    resource: 'codes',
    path: `/${library}`,
    query: { parentId, includeRetired, limit: 100 },
    key: { filters: { library, parentId, includeRetired } },
    enabled,
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** One code (the detail page); refreshed by every code command through the `codes` prefix. */
export function useCode(library: CodeLibraryPath, id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'codes', id ?? '-', `${library}:view`),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME.codes,
    queryFn: async ({ signal }) => (await v2Request<CodeDetailView>({ method: 'GET', path: `/${library}/${id as string}`, signal })).data,
  });
}

/**
 * Seeds the detail cache of a code from a list row (row hover / focus): the detail page opens at once
 * with the row and refreshes it, because the seed is marked stale.
 */
export function useSeedCode() {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  return useCallback(
    (library: CodeLibraryPath, code: CodeDetailView) => {
      const key = v2Keys.detail(tenantId ?? '-', 'codes', code.id, `${library}:view`);
      if (tenantId && client.getQueryData(key) === undefined) client.setQueryData(key, code, { updatedAt: 0 });
    },
    [client, tenantId],
  );
}

function useCodeDetail<T>(library: CodeLibraryPath, id: string | null, variant: string, query?: Record<string, number>) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: [...v2Keys.detail(tenantId ?? '-', 'codes', id ?? '-', `${library}:${variant}`), query ?? null] as const,
    enabled: Boolean(tenantId && id),
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (await v2Request<T>({ method: 'GET', path: `/${library}/${id as string}/${variant}`, query, signal })).data,
  });
}

export const useCodeVersions = (library: CodeLibraryPath, id: string | null) =>
  useCodeDetail<CodeVersionView[]>(library, id, 'versions');

/** Counts shown before a retire (the 409 of the retire itself carries the same counts). */
export const useCodeReferences = (library: CodeLibraryPath, id: string | null, enabled = true) =>
  useCodeDetail<CodeReferencesView>(library, enabled ? id : null, 'references');

export const useCodeMappingPreview = (id: string | null, days = 30) =>
  useCodeDetail<CodeMappingPreviewView>('reason-codes', id, 'mapping-preview', { days });

function useCodeCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>, entityType = 'code') {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType } : null),
  });
}

export function useCreateCode(library: CodeLibraryPath) {
  return useCodeCommand<CodeCreateBody, CodeDetailView>(async (body, idempotencyKey) =>
    (await v2Request<CodeDetailView>({ method: 'POST', path: `/${library}`, body, idempotencyKey })).data,
  );
}

/** Writes a command's answer into the code's detail cache (the page shows the new version at once). */
function useCodeWriter(library: CodeLibraryPath) {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  return (view: CodeDetailView): CodeDetailView => {
    client.setQueryData(v2Keys.detail(tenantId ?? '-', 'codes', view.id, `${library}:view`), view);
    return view;
  };
}

/** The next version of a code under If-Match (412 when someone else changed it). */
export function useChangeCode(library: CodeLibraryPath) {
  const write = useCodeWriter(library);
  return useCodeCommand<{ code: Pick<CodeDetailView, 'id' | 'rowVersion'>; body: CodeChangeBody }, CodeDetailView>(async (input) =>
    write((await v2Request<CodeDetailView>({
      method: 'PUT',
      path: `/${library}/${input.code.id}`,
      body: input.body,
      ifMatch: ifMatchOf(input.code.rowVersion),
    })).data),
  );
}

export function useRetireCode(library: CodeLibraryPath) {
  const write = useCodeWriter(library);
  return useCodeCommand<{ id: string }, CodeDetailView>(async (input, idempotencyKey) =>
    write((await v2Request<CodeDetailView>({ method: 'POST', path: `/${library}/${input.id}/retire`, body: {}, idempotencyKey })).data),
  );
}

/** Every version of the mapping rules of one source code (append-only history, all pages). */
export function useCodeMappingRules(sourceCodeId: string | null) {
  const tenantId = useV2TenantId();
  const query = useQuery<CodeMappingRuleView[]>({
    queryKey: v2Keys.list(tenantId ?? '-', 'code-mapping-rules', { filters: { sourceCodeId, all: true } }),
    enabled: Boolean(tenantId && sourceCodeId),
    staleTime: STALE_TIME['code-mapping-rules'],
    queryFn: ({ signal }) => fetchAllPages<CodeMappingRuleView>('/code-mapping-rules', { sourceCodeId: sourceCodeId ?? undefined }, signal),
  });
  return { ...query, items: query.data ?? [] };
}

export function useCreateCodeMappingRule() {
  return useCodeCommand<CodeMappingRuleBody, CodeMappingRuleView>(async (body, idempotencyKey) =>
    (await v2Request<CodeMappingRuleView>({ method: 'POST', path: '/code-mapping-rules', body, idempotencyKey })).data,
    'code_mapping_rule',
  );
}

/** Valuation rate versions of an impact code (plan 2.6): the valuation link indicator. */
export function useImpactValuationRates(impactCodeId: string | null) {
  const list = useV2InfiniteList<ValuationRateView>({
    resource: 'profiles',
    path: '/valuation-rates',
    query: { impactCodeId: impactCodeId ?? undefined, limit: 20 },
    key: { filters: { kind: 'valuation-rates', impactCodeId } },
    enabled: Boolean(impactCodeId),
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}
