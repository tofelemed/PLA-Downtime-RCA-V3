import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { toCodeFilters, toEventQuery, type EventFilterState } from '../model/event-filters';
import { shortfallOf } from '../model/production-loss';
import { useEventHubEnv } from '../use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** One page of days is enough for a window of a few weeks; beyond it the tile says "+" and shows no total. */
const PAGE_SIZE = 100;

/**
 * Declared mode: the production loss days of the chosen units and window still without a reason — how many,
 * and the tonnes they hold (the sum of the days' declared shortfalls, shown only while every day is listed).
 */
export function DeclaredToCodeStat({ filters }: { filters: EventFilterState }) {
  const { number, decimal } = useNumberFormat();
  const env = useEventHubEnv();
  const query = useProductionEvents({ ...toEventQuery(toCodeFilters(filters, true)), limit: PAGE_SIZE }, env.timezone);
  const events = flattenPages(query.data?.pages);
  const more = query.hasNextPage === true;
  const tonnes = events.reduce((total, event) => total + (shortfallOf(event) ?? 0), 0);
  return (
    <div data-testid="quick-stats-production-loss">
      <div className="text-xs text-muted-foreground">Production loss to code</div>
      <div className="text-2xl font-semibold">
        {query.isLoading ? '…' : `${number(events.length)}${more ? '+' : ''}`}
        {!query.isLoading && !more && <span className="ml-2 text-base font-normal text-muted-foreground" data-testid="quick-stats-production-loss-tonnes">{decimal(String(tonnes), 3)} t</span>}
      </div>
    </div>
  );
}
