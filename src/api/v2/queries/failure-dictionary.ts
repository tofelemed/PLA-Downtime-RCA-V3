import { useEffect, useMemo } from 'react';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type {
  DictionaryKind,
  FailureDictionaryCreateBody,
  FailureDictionaryEntryView,
  FailureDictionaryImportBody,
  FailureDictionaryImportResult,
} from '../types/failure-dictionary';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2Lookup } from './use-v2-lookup';
import { useV2TenantId } from './use-v2-tenant';

/**
 * The plant's failure dictionary in force now (SME D11): every keyset page of 500, one cache for the
 * event form pickers and the admin screen. Empty for a plant without a dictionary (fields stay free text).
 */
export function useFailureDictionary(enabled = true) {
  const query = useV2InfiniteList<FailureDictionaryEntryView>({
    resource: 'reliability',
    path: '/failure-dictionary',
    query: { limit: 500, sort: 'code' },
    key: { filters: { failureDictionary: true } },
    enabled,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const entries = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  return { entries, isLoading: query.isLoading || Boolean(hasNextPage), error: query.error };
}

/** Filters of the dictionary table (Setup › Failure dictionary), all applied by the server. */
export interface DictionaryListFilters {
  /** code or name contains (case-insensitive) */
  q?: string;
  /** one list (equipment classes, failure modes, …); '' = every list */
  kind?: DictionaryKind | '';
  /** items and modes of this class plus the entries valid for every class; '' = no class filter */
  equipmentClass?: string;
}

/** The `GET /failure-dictionary` query of the table: entries in force, by code; blank filters left out. */
export function dictionaryListQuery(filters: DictionaryListFilters): QueryParams {
  return {
    sort: 'code',
    q: filters.q?.trim() || undefined,
    kinds: filters.kind ? [filters.kind] : undefined,
    equipmentClass: filters.equipmentClass || undefined,
  };
}

/** The dictionary table: 20 entries per page (keyset on code), search and filters on the server. */
export function useFailureDictionaryPage(filters: DictionaryListFilters) {
  const query = dictionaryListQuery(filters);
  return usePagedQuery<FailureDictionaryEntryView>({
    resource: 'reliability',
    path: '/failure-dictionary',
    query,
    key: { filters: { kind: 'failure-dictionary-page', ...query } },
  });
}

/** The equipment classes in force (codes): the class filter and the entry form's class choice. */
export function useDictionaryClasses() {
  const list = useV2Lookup<FailureDictionaryEntryView>({
    resource: 'reliability',
    path: '/failure-dictionary',
    query: { kinds: ['equipment_class'], sort: 'code', limit: 500 },
    key: { filters: { kind: 'failure-dictionary-classes' } },
  });
  return useMemo(() => list.items.map((entry) => entry.code), [list.items]);
}

function useDictionaryCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType: 'reliability' } : null),
  });
}

export function useImportFailureDictionary() {
  return useDictionaryCommand<FailureDictionaryImportBody, FailureDictionaryImportResult>(async (body, idempotencyKey) =>
    (await v2Request<FailureDictionaryImportResult>({ method: 'POST', path: '/failure-dictionary/import', body, idempotencyKey })).data,
  );
}

export function useCreateDictionaryEntry() {
  return useDictionaryCommand<FailureDictionaryCreateBody, FailureDictionaryEntryView>(async (body, idempotencyKey) =>
    (await v2Request<FailureDictionaryEntryView>({ method: 'POST', path: '/failure-dictionary', body, idempotencyKey })).data,
  );
}

export function useRetireDictionaryEntry() {
  return useDictionaryCommand<string, FailureDictionaryEntryView>(async (id, idempotencyKey) =>
    (await v2Request<FailureDictionaryEntryView>({ method: 'POST', path: `/failure-dictionary/${id}/retire`, body: {}, idempotencyKey })).data,
  );
}
