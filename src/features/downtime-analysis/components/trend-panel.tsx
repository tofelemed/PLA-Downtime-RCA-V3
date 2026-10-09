import { lazy, Suspense } from 'react';
import { useDowntimeReport } from '@/api/v2/queries/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { downtimeQuery, SCHEDULE_CLASSES, type DowntimeFilters, type ScheduleClass } from '../model/downtime-filters';
import { formatCount } from '../model/kpi-display';
import { trendRows, type TrendRow } from '../model/trend-rows';
import { ReportCard } from './report-card';

const TrendChart = lazy(() => import('./charts/trend-chart').then((module) => ({ default: module.TrendChart })));

/** One server series per schedule class (each a `GET /reports/downtime` with that class). */
function useClassSeries(filters: DowntimeFilters, scheduleClass: ScheduleClass, tz: string) {
  const wanted = filters.scheduleClass === 'all' || filters.scheduleClass === scheduleClass;
  return useDowntimeReport(wanted ? downtimeQuery(filters, filters.trendBy, { scheduleClass }) : null, tz);
}

/**
 * Trend (AN03): downtime or stops per site-local shift / day / week / month, stacked by schedule class.
 * Durations are the period-clipped seconds of each bucket (KPI06: not the completed-stop cohort).
 */
export function TrendPanel({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const planned = useClassSeries(filters, 'planned', env.timezone);
  const unplanned = useClassSeries(filters, 'unplanned', env.timezone);
  const external = useClassSeries(filters, 'external', env.timezone);
  const unknown = useClassSeries(filters, 'unknown', env.timezone);
  const byClass = { planned, unplanned, external, unknown };
  const classes = SCHEDULE_CLASSES.filter((scheduleClass) => filters.scheduleClass === 'all' || filters.scheduleClass === scheduleClass);
  const first = byClass[classes[0]];
  const rows = trendRows(classes.map((scheduleClass) => ({ scheduleClass, groups: byClass[scheduleClass].data?.data.groups ?? [] })));
  const unit = first.data?.data.unit ?? 's';
  const loading = classes.some((scheduleClass) => byClass[scheduleClass].isLoading);
  return (
    <ReportCard
      title={`Trend by ${filters.trendBy}`}
      testId="downtime-trend"
      query={{ ...first, isLoading: loading }}
      response={first.data}
      isEmpty={rows.length === 0}
      note="Buckets use the plant's operational date and shift; stop time is clipped to each bucket."
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TrendChart rows={rows} classes={classes} unit={unit} />
      </Suspense>
      <TrendTable rows={rows} classes={classes} unit={unit} />
    </ReportCard>
  );
}

function TrendTable({ rows, classes, unit }: { rows: TrendRow[]; classes: readonly ScheduleClass[]; unit: 's' | 'count' }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">Table</summary>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            {classes.map((scheduleClass) => (
              <TableHead key={scheduleClass}>{scheduleClass}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              {classes.map((scheduleClass) => (
                <TableCell key={scheduleClass}>
                  {unit === 's' ? <DurationText seconds={row.values[scheduleClass] ?? null} variant="compact" /> : formatCount(row.values[scheduleClass])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}
