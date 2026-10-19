import type { ReactNode } from 'react';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { usePlantFormat } from '@/features/event-hub/hooks/use-plant-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';
import { Section } from '@/features/ux-kit/page-layout';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { useDowntimeBundle, type DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { pageBundleQuery } from '../model/bundle-views';
import { previousWindow, type DowntimeFilters } from '../model/downtime-filters';
import { findMetric, SUMMARY_TILES } from '../model/kpi-display';
import { KpiTile } from './kpi-summary';

const COMPARED = ['downtime_total', 'stop_count', 'mean_stop_duration', 'scheduled_availability'];
const TILES = SUMMARY_TILES.filter((tile) => COMPARED.includes(tile.metric));

/**
 * Calendar comparison: the chosen window (from the page snapshot) beside the window of the same length
 * before it — the same bundle request for the earlier window, so both sides follow the same filters
 * (schedule class included); no difference is computed in the browser.
 */
export function CalendarComparison({ filters, bundle }: { filters: DowntimeFilters; bundle: DowntimeBundleResult }) {
  const env = useEventHubEnv();
  const previous = previousWindow(filters);
  const before = useDowntimeBundle(pageBundleQuery(previous, 'trends', 'calendar'), env.timezone);
  return (
    <Section title="Window comparison" className="rounded-md border p-4">
      <div className="grid gap-4 md:grid-cols-2" data-testid="calendar-comparison">
        <WindowColumn filters={previous} query={before} summary={before.data?.data.summary} />
        <WindowColumn filters={filters} query={bundle} summary={bundle.data?.data.summary} />
      </div>
    </Section>
  );
}

interface WindowColumnProps {
  filters: DowntimeFilters;
  query: QueryLike & { refetch: () => unknown };
  summary: KpiAggregateView[] | undefined;
}

function WindowColumn({ filters, query, summary }: WindowColumnProps): ReactNode {
  const { dateTime } = usePlantFormat();
  return (
    <section className="space-y-2" aria-label={filters.windowLabel}>
      <h3 className="text-sm font-medium">
        {filters.windowLabel}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          {dateTime(filters.from)} – {dateTime(filters.to)}
        </span>
      </h3>
      <DataState state={dataStateOf(query)} error={query.error} onRetry={() => query.refetch()}>
        <dl className="grid grid-cols-2 gap-2">
          {TILES.map((tile) => (
            <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
          ))}
        </dl>
      </DataState>
    </section>
  );
}
