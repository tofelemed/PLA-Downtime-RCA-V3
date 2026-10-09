import { useDowntimeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { formatPlantTime } from '@/features/ux-kit/format/plant-time';
import { downtimeQuery, previousWindow, type DowntimeFilters } from '../model/downtime-filters';
import { findMetric, SUMMARY_TILES } from '../model/kpi-display';
import { KpiTile } from './kpi-summary';
import { ReportMeta } from './report-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';

const COMPARED = ['downtime_total', 'stop_count', 'mean_stop_duration', 'scheduled_availability'];
const TILES = SUMMARY_TILES.filter((tile) => COMPARED.includes(tile.metric));

/**
 * Calendar comparison: the chosen window beside the window of the same length before it — each column
 * its own server summary with its own runs and coverage; no difference is computed in the browser.
 */
export function CalendarComparison({ filters }: { filters: DowntimeFilters }) {
  return (
    <Card data-testid="calendar-comparison">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Window comparison</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <WindowColumn filters={previousWindow(filters)} />
        <WindowColumn filters={filters} />
      </CardContent>
    </Card>
  );
}

function WindowColumn({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(downtimeQuery(filters, 'oee', { metric: 'duration', scheduleClass: 'all' }), env.timezone);
  const summary = query.data?.data.summary;
  return (
    <section className="space-y-2" aria-label={filters.windowLabel}>
      <h3 className="text-sm font-medium">
        {filters.windowLabel}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          {formatPlantTime(filters.from, env.timezone, true)} – {formatPlantTime(filters.to, env.timezone, true)}
        </span>
      </h3>
      <DataState state={dataStateOf(query)} error={query.error} onRetry={() => query.refetch()}>
        <dl className="grid grid-cols-2 gap-2">
          {TILES.map((tile) => (
            <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
          ))}
        </dl>
      </DataState>
      {query.data && <ReportMeta response={query.data} />}
    </section>
  );
}
