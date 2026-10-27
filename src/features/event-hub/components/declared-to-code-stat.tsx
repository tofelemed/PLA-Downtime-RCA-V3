import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { toCodeFilters, toEventQuery, type EventFilterState } from '../model/event-filters';
import { useEventHubEnv } from '../use-event-hub-env';

/** One page of days is enough for a window of a few weeks; beyond it the tile says "+". */
const PAGE_SIZE = 100;

/**
 * Declared mode: how many production loss days of the chosen units and window are still without a reason
 * (a count only; tonnes are a server figure and are not computed here).
 */
export function DeclaredToCodeStat({ filters }: { filters: EventFilterState }) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const query = useProductionEvents({ ...toEventQuery(toCodeFilters(filters, true)), limit: PAGE_SIZE }, env.timezone);
  const count = flattenPages(query.data?.pages).length;
  const text = query.isLoading ? '…' : query.isError ? '—' : `${number(count)}${query.hasNextPage ? '+' : ''}`;
  return (
    <div data-testid="quick-stats-production-loss">
      <div className="text-xs text-muted-foreground">Production loss to code</div>
      <div className="text-2xl font-semibold">{text}</div>
    </div>
  );
}
