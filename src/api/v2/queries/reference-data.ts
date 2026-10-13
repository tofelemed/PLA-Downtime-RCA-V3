import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { QueryOf } from '../schema-types';
import type { ListResponse } from '../types/envelopes';
import type { CodeView, SiteView } from '../types/flags';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type CodeLibrary =
  | 'reason-codes'
  | 'impact-codes'
  | 'oee-codes'
  | 'failure-code-groups'
  | 'loss-category-defs';

export type CodeLibraryFilters = Omit<QueryOf<'/api/v2/reason-codes', 'get'>, 'cursor'>;

/** A code library page by page (master data: fresh for 5 minutes). */
export function useCodeLibrary(library: CodeLibrary, filters: CodeLibraryFilters = {}) {
  return useV2InfiniteList<CodeView>({
    resource: 'codes',
    path: `/${library}`,
    query: { limit: 500, ...filters } as QueryParams,
    key: { filters: { library, ...filters } },
  });
}

/** Every page of a code library (FE-04): further pages load until the library is complete. */
export function useAllCodes(library: CodeLibrary) {
  const query = useCodeLibrary(library);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return query;
}

/** Sites of the tenant with their IANA timezone (plan 2.1); the default site sets the plant timezone. */
export function useSites() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'sites'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.sites,
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<SiteView>>({ method: 'GET', path: '/sites', query: { limit: 100 }, signal })).data,
  });
}

export interface PlantTimezone {
  timezone: string;
  /** where it came from; `utc-fallback` is labelled in the UI, never silently assumed */
  source: 'site' | 'tenant' | 'utc-fallback';
}

/** Display timezone (§3.3, D03): default site, else the tenant's, else UTC flagged as a fallback. */
export function choosePlantTimezone(sites: readonly SiteView[] | undefined, tenantTimezone?: string | null): PlantTimezone {
  const site = sites?.find((entry) => entry.isDefault) ?? sites?.[0];
  if (site && !site.timezoneFallback) return { timezone: site.timezone, source: 'site' };
  if (tenantTimezone) return { timezone: tenantTimezone, source: 'tenant' };
  return { timezone: 'UTC', source: 'utc-fallback' };
}
