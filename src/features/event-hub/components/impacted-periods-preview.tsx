import { useMemo } from 'react';
import { usePeriodSummaries } from '@/api/v2/queries/period-overview';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { GRID_WORKFLOW_LABELS, GRID_WORKFLOW_TONES, labelOf } from '@/features/ux-kit/labels';
import { toneOf } from '@/features/ux-kit/status-tone';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { formatOperationalDate, formatTime, useCalendarPreference } from '@/lib/dates';
import { useEventHubEnv } from '../use-event-hub-env';
import { PeriodLink } from './period-link';

export interface ImpactedPeriodsPreviewProps {
  unitId: string;
  /** UTC interval the change touches; an open end uses the server's as-of instant */
  from: string;
  to: string | null;
}

/**
 * Periods overlapping the event with their accounting workflow state (UX04 "review impacted periods"; owner
 * finding 2: the server's `workflowState` in the shared wording, e.g. "In review", never the display-only
 * readiness): the user sees which shift accounting a save will recalculate before saving. 20 at a time, "Show more" for the rest.
 * G-2(a): a period with a plan links to its workspace; Back there returns here.
 */
export function ImpactedPeriodsPreview({ unitId, from, to }: ImpactedPeriodsPreviewProps) {
  const env = useEventHubEnv();
  const preference = useCalendarPreference();
  // an open event runs to now; fixed once per interval so the query key stays stable
  const until = useMemo(() => to ?? new Date().toISOString(), [to]);
  const query = usePeriodSummaries({ unitIds: [unitId], from, to: until }, env.timezone);
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
            <li key={period.periodId} className="flex flex-wrap items-center gap-2 text-xs" data-testid="impacted-period">
              <PeriodLink periodId={period.periodId} planId={period.planId}>
                {formatOperationalDate(period.localDate, preference)} {period.shiftName ?? ''}
              </PeriodLink>
              {time(period.utcStart)} – {time(period.utcEnd)}
              <StatusBadge tone={toneOf(GRID_WORKFLOW_TONES, period.workflowState)} data-testid="impacted-period-workflow" data-state={period.workflowState}>
                {labelOf(GRID_WORKFLOW_LABELS, period.workflowState)}
              </StatusBadge>
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
