import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { SignalView } from '../types/integration-mappings';
import type { UnitStateCoverageView, UnitStateMappingBody, UnitStateMappingView } from '../types/reliability';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export interface CoverageQuery {
  unitId: string;
  from: string;
  to: string;
}

/** SME D1 / D2: mapping versions of one unit, newest first. */
export function useUnitStateMappingsPage(unitId: string) {
  return usePagedQuery<UnitStateMappingView>({
    resource: 'reliability',
    path: '/unit-state-mappings',
    query: { unitId },
    key: { scope: { unitIds: [unitId] }, filters: { unitStateMappings: true } },
    enabled: Boolean(unitId),
  });
}

/** State timeline, known-data coverage and availability bounds of a unit over a window (≤ 31 days). */
export function useUnitStateCoverage(query: CoverageQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'reliability', {
      scope: { unitIds: query ? [query.unitId] : [] },
      window: query ? { from: query.from, to: query.to } : null,
      filters: { unitStateCoverage: true },
    }),
    enabled: Boolean(tenantId && query),
    staleTime: STALE_TIME.reliability,
    queryFn: async ({ signal }) =>
      (await v2Request<UnitStateCoverageView>({ method: 'GET', path: '/unit-state-mappings/coverage', query: { ...query }, signal })).data,
  });
}

/** State signals of one unit (the mapping's source), every page followed. */
export function useUnitStateSignals(unitId: string) {
  const list = useV2InfiniteList<SignalView>({
    resource: 'signals',
    path: '/signals',
    query: { unitId, semanticType: 'state', limit: 200 },
    key: { scope: { unitIds: [unitId] }, filters: { semanticType: 'state' } },
    enabled: Boolean(unitId),
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** A new mapping version from effectiveFrom; the previous version ends there. */
export function useRecordUnitStateMapping() {
  const tenantId = useV2TenantId();
  return useV2Command<UnitStateMappingBody, UnitStateMappingView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<UnitStateMappingView>({ method: 'POST', path: '/unit-state-mappings', body: input, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'reliability' } : null),
  });
}
