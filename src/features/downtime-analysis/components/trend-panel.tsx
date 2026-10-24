import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { bucketLabel } from '@/features/pla-analytics/model/buckets';
import { useCalendarPreference } from '@/lib/dates';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { trendClasses, viewOf, type PageViews } from '../model/bundle-views';
import type { DowntimeFilters, ScheduleClass } from '../model/downtime-filters';
import { formatCount } from '../model/kpi-display';
import { trendRows, type TrendRow } from '../model/trend-rows';
import { ReportCard } from './report-card';

const TrendChart = lazy(() => import('./charts/trend-chart').then((module) => ({ default: module.TrendChart })));

export interface TrendPanelProps {
  filters: DowntimeFilters;
  bundle: DowntimeBundleResult;
  views: PageViews;
}

/**
 * Trend (AN03): downtime or stops per site-local shift / day / week / month, stacked by schedule class —
 * one server series per class, all from the page snapshot. Durations are the period-clipped seconds of
 * each bucket (KPI06: not the completed-stop cohort).
 */
export function TrendPanel({ filters, bundle, views }: TrendPanelProps) {
  const classes = trendClasses(filters);
  const series = classes.map((scheduleClass) => ({ scheduleClass, view: viewOf(bundle.data?.data, views.trend[scheduleClass]) }));
  const pref = useCalendarPreference();
  // server keys without a label (day, week, month) are named in the plant calendar; Saturday weeks by their first day
  const rows = trendRows(series.map(({ scheduleClass, view }) => ({ scheduleClass, groups: view?.groups ?? [] }))).map((row) =>
    row.label === row.key ? { ...row, label: bucketLabel(row.key, filters.trendBy, pref) } : row,
  );
  const unit = series[0]?.view?.unit ?? 's';
  return (
    <ReportCard
      title={`Trend by ${filters.trendBy}`}
      testId="downtime-trend"
      query={bundle}
      response={bundle.data}
      showMeta={false}
      emptyText="No downtime in this window."
      isEmpty={rows.length === 0}
      info="Buckets use the plant's operational date and shift; stop time is clipped to each bucket."
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TrendChart rows={rows} classes={classes} unit={unit} />
      </Suspense>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Table</summary>
        <TrendTable rows={rows} classes={classes} unit={unit} />
      </details>
    </ReportCard>
  );
}

function TrendTable({ rows, classes, unit }: { rows: TrendRow[]; classes: readonly ScheduleClass[]; unit: 's' | 'count' }) {
  const { digits } = useCalendarPreference();
  const columns: DataTableColumn<TrendRow>[] = [
    { id: 'bucket', header: 'Bucket', nowrap: true, cell: (row) => row.label },
    ...classes.map((scheduleClass) => ({
      id: scheduleClass,
      header: labelOf(SCHEDULE_CLASS_LABELS, scheduleClass),
      align: 'right' as const,
      nowrap: true,
      cell: (row: TrendRow) =>
        unit === 's' ? <DurationText seconds={row.values[scheduleClass] ?? null} /> : formatCount(row.values[scheduleClass], digits),
    })),
  ];
  return <DataTable caption="Trend buckets" columns={columns} rows={rows} getRowKey={(row) => row.key} density="compact" />;
}
