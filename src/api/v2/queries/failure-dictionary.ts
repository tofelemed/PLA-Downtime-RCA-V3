import { useEffect, useMemo } from 'react';
import { v2Request } from '../client';
import type {
  FailureDictionaryCreateBody,
  FailureDictionaryEntryView,
  FailureDictionaryImportBody,
  FailureDictionaryImportResult,
} from '../types/failure-dictionary';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
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
