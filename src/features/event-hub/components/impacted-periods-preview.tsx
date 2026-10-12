import { useProductionPeriods } from '@/api/v2/queries/production-periods';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { humanize } from '@/features/ux-kit/labels';
import { formatOperationalDate, formatTime, useCalendarPreference } from '@/lib/dates';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ImpactedPeriodsPreviewProps {
  unitId: string;
  /** UTC interval the change touches; an open end uses the server's as-of instant */
  from: string;
  to: string | null;
}

/**
 * Periods overlapping the event with their readiness (UX04 "review impacted periods"): the user sees
 * which shift accounting a save will recalculate before saving. 20 at a time, "Show more" for the rest.
 */
export function ImpactedPeriodsPreview({ unitId, from, to }: ImpactedPeriodsPreviewProps) {
  const env = useEventHubEnv();
  const preference = useCalendarPreference();
  const query = useProductionPeriods({ unitIds: [unitId], from, ...(to ? { to } : {}), limit: 20 }, env.timezone);
  const periods = flattenPages(query.data?.pages);
  const state = dataStateOf(query, { isEmpty: periods.length === 0 });
  const time = (iso: string) => formatTime(iso, { timeZone: env.timezone, ...preference });
  return (
    <section aria-label="Impacted periods" data-testid="impacted-periods" className="space-y-1">
      <h3 className="text-sm font-medium">Impacted periods</h3>
      <DataState
        state={state}
        error={query.error}
        detail={state === 'empty' ? 'No production period overlaps this interval (no accounting is affected).' : undefined}
      >
        <ul className="space-y-1">
          {periods.map((period) => (
            <li key={period.id} className="flex flex-wrap items-center gap-2 text-xs" data-testid="impacted-period">
              <span className="font-medium">
                {formatOperationalDate(period.localDate, preference)} {period.shiftName ?? ''}
              </span>
              {time(period.utcStart)} – {time(period.utcEnd)}
              <Badge variant="outline">{humanize(period.stateReadiness)}</Badge>
              {period.isExcluded && <Badge variant="secondary">Excluded</Badge>}
            </li>
          ))}
        </ul>
      </DataState>
      {query.hasNextPage && (
        <Button type="button" size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          Show more periods
        </Button>
      )}
    </section>
  );
}
