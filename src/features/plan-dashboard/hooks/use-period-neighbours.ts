import type { QueryParams } from '@/api/v2/request-url';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import { flattenPages, useV2InfiniteList } from '@/api/v2/queries/use-v2-list';
import { latestBefore, nextPeriodQuery, previousPeriodQuery, type NeighbourQuery, type PeriodSpan, type PlanWindow } from '../model/period-neighbours';

const EMPTY: NeighbourQuery = { unitIds: [], from: '', to: '', limit: 1 };

function useNeighbourList(query: NeighbourQuery | null, direction: 'previous' | 'next') {
  const q = query ?? EMPTY;
  return useV2InfiniteList<PeriodSummaryView>({
    resource: 'period-accounting',
    path: '/period-summaries',
    query: q as unknown as QueryParams,
    key: { scope: { unitIds: q.unitIds }, window: { from: q.from, to: q.to }, filters: { kind: 'period-neighbour', direction, sort: q.sort } },
    enabled: query !== null,
  });
}

export interface PeriodNeighbour {
  periodId: string;
  localDate: string;
  shiftName: string | null;
}

export interface PeriodNeighbours {
  previous: PeriodNeighbour | null;
  next: PeriodNeighbour | null;
  isLoading: boolean;
}

/**
 * The periods before and after the shown one, from the server's period list of the same unit inside the
 * plan window (first page only, never computed in the browser).
 */
export function usePeriodNeighbours(period: PeriodSpan & { periodId: string }, plan: PlanWindow): PeriodNeighbours {
  const previousQuery = previousPeriodQuery(period, plan);
  const nextQuery = nextPeriodQuery(period, plan);
  const previous = useNeighbourList(previousQuery, 'previous');
  const next = useNeighbourList(nextQuery, 'next');
  const after = flattenPages(next.data?.pages).find((row) => row.periodId !== period.periodId) ?? null;
  return {
    previous: previousQuery ? latestBefore(flattenPages(previous.data?.pages), period) : null,
    next: nextQuery ? after : null,
    isLoading: previous.isLoading || next.isLoading,
  };
}
