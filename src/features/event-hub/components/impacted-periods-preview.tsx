import { useProductionPeriods } from '@/api/v2/queries/production-periods';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ImpactedPeriodsPreviewProps {
  unitId: string;
  /** UTC interval the change touches; an open end uses the server's as-of instant */
  from: string;
  to: string | null;
}

/**
 * Periods overlapping the event with their readiness (UX04 "review impacted periods"): the user sees
 * which shift accounting a save will recalculate before saving. Read from the server, nothing derived.
 */
export function ImpactedPeriodsPreview({ unitId, from, to }: ImpactedPeriodsPreviewProps) {
  const env = useEventHubEnv();
  const query = useProductionPeriods({ unitIds: [unitId], from, ...(to ? { to } : {}), limit: 20 }, env.timezone);
  const periods = flattenPages(query.data?.pages);
  const state = dataStateOf(query, { isEmpty: periods.length === 0 });
  return (
    <section aria-label="Impacted periods" data-testid="impacted-periods" className="space-y-1">
      <h4 className="text-sm font-medium">Impacted periods</h4>
      <DataState
        state={state}
        error={query.error}
        detail={state === 'empty' ? 'No production period overlaps this interval (no accounting is affected).' : undefined}
      >
        <ul className="space-y-1">
          {periods.map((period) => (
            <li key={period.id} className="flex flex-wrap items-center gap-2 text-xs" data-testid="impacted-period">
              <span className="font-medium">
                {period.localDate} {period.shiftName ?? ''}
              </span>
              <PlantTime iso={period.utcStart} tz={env.timezone} /> – <PlantTime iso={period.utcEnd} tz={env.timezone} />
              <Badge variant="outline">{humanize(period.stateReadiness)}</Badge>
              {period.isExcluded && <Badge variant="secondary">Excluded</Badge>}
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}
