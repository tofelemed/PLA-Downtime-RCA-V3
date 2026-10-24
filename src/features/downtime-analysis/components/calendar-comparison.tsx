import { useId, type ReactNode } from 'react';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { usePlantFormat } from '@/features/event-hub/hooks/use-plant-format';
import { KpiTileRow } from '@/features/pla-analytics/dashboard/kpi-tile';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf, type QueryLike } from '@/features/ux-kit/data-state-of';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { useDowntimeBundle, type DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { pageBundleQuery } from '../model/bundle-views';
import { previousWindow, type DowntimeFilters } from '../model/downtime-filters';
import { findMetric, SUMMARY_TILES } from '../model/kpi-display';
import { FigureTile } from './figure-tile';
import { ReportMeta } from './report-card';

const COMPARED = ['downtime_total', 'stop_count', 'mean_stop_duration', 'scheduled_availability'];
const TILES = SUMMARY_TILES.filter((tile) => COMPARED.includes(tile.metric));

/**
 * Calendar comparison: the chosen window (from the page snapshot) beside the window of the same length
 * before it — the same bundle request for the earlier window, so both sides follow the same filters
 * (schedule class included); no difference is computed in the browser. Each side states its own approval.
 */
export function CalendarComparison({ filters, bundle }: { filters: DowntimeFilters; bundle: DowntimeBundleResult }) {
  const env = useEventHubEnv();
  const headingId = useId();
  const previous = previousWindow(filters);
  const before = useDowntimeBundle(pageBundleQuery(previous, 'trends', 'calendar'), env.timezone);
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <h2 id={headingId} className="text-base font-semibold text-heading">
        Window comparison
      </h2>
      <div className="grid gap-4 md:grid-cols-2" data-testid="calendar-comparison">
        <WindowColumn filters={previous} query={before} response={before.data} />
        <WindowColumn filters={filters} query={bundle} response={bundle.data} />
      </div>
    </section>
  );
}

interface WindowColumnProps {
  filters: DowntimeFilters;
  query: QueryLike & { refetch: () => unknown };
  response: (AnalyticsResponse<{ calculationRunIds: string[]; summary?: KpiAggregateView[] }>) | undefined;
}

function WindowColumn({ filters, query, response }: WindowColumnProps): ReactNode {
  const { dateTime } = usePlantFormat();
  const summary = response?.data.summary;
  return (
    <section className="space-y-2" aria-label={filters.windowLabel}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{filters.windowLabel}</h3>
        <span className="text-xs text-muted-foreground">
          {dateTime(filters.from)} – {dateTime(filters.to)}
        </span>
        {response && <ReportMeta response={response} />}
      </div>
      <DataState state={dataStateOf(query)} error={query.error} onRetry={() => query.refetch()}>
        <KpiTileRow className="sm:grid-cols-2 xl:grid-cols-2">
          {TILES.map((tile) => (
            <FigureTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
          ))}
        </KpiTileRow>
      </DataState>
    </section>
  );
}
