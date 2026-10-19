import { lazy, Suspense, type ReactNode } from 'react';
import { useActivitySummary } from '@/api/v2/queries/activity-summary';
import type { ActivityCountView, ActivityDayView, AuditActivitySummaryView, WorkItemSummaryView } from '@/api/v2/types/activity-summary';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { humanize } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';
import { actionLabel, entityLabel } from './components/audit-columns';
import { labelledCounts, type LabelledCount } from './model/audit-counts';

const SeriesChart = lazy(() => import('@/features/pla-analytics/charts/series-chart').then((m) => ({ default: m.SeriesChart })));

function DayChart({ days, label }: { days: readonly ActivityDayView[]; label: string }) {
  const pref = useCalendarPreference();
  if (days.length === 0) return null;
  const rows = days.map((d) => ({ label: formatOperationalDate(d.day, pref), values: { count: String(d.count) } }));
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SeriesChart rows={rows} series={[{ key: 'count', label }]} kind="bar" />
    </Suspense>
  );
}

function Counts({ title, items }: { title: string; items: readonly ActivityCountView[] }) {
  const { number } = useNumberFormat();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-24 text-muted-foreground">{title}</span>
      {items.length === 0 ? '—' : items.map((item) => <Badge key={item.key} variant="outline">{humanize(item.key)}: {number(item.count)}</Badge>)}
    </div>
  );
}

function SummaryCard({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function WorkItems({ title, testId, summary, overdueLabel }: { title: string; testId: string; summary: WorkItemSummaryView; overdueLabel: string }) {
  const { number } = useNumberFormat();
  return (
    <SummaryCard title={title} testId={testId}>
      <p className="text-sm" data-total={summary.total}>
        <strong>{number(summary.total)}</strong> created · <strong>{number(summary.open)}</strong> still open · <strong>{number(summary.overdue)}</strong> {overdueLabel}
      </p>
      <Counts title="Status" items={summary.byStatus} />
      <Counts title="Priority" items={summary.byPriority} />
      <DayChart days={summary.createdByDay} label="Created" />
    </SummaryCard>
  );
}

const COUNT_COLUMNS = (title: string): Array<DataTableColumn<LabelledCount>> => [
  { id: 'key', header: title, cell: (row) => row.label },
  { id: 'count', header: 'Entries', align: 'right', cell: (row) => row.count },
];

function AuditActivity({ audit }: { audit: AuditActivitySummaryView }) {
  const { number } = useNumberFormat();
  return (
    <SummaryCard title={`Audit activity (${plural(audit.total, 'entry', 'entries', number)})`} testId="report-audit-activity">
      <DayChart days={audit.byDay} label="Entries" />
      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable caption="Audit entries by action" columns={COUNT_COLUMNS('Action')} rows={labelledCounts(audit.byAction, actionLabel)} getRowKey={(row) => row.label} density="compact" />
        <DataTable caption="Audit entries by record type" columns={COUNT_COLUMNS('Record type')} rows={labelledCounts(audit.byEntityType, entityLabel)} getRowKey={(row) => row.label} density="compact" />
      </div>
    </SummaryCard>
  );
}

/**
 * Audit Logs work summary: RCA cases and tasks created in the chosen
 * dates by status and priority with open and overdue counts, and — for those who may read the audit log —
 * audit activity; all counted on the server, days in the plant calendar.
 */
export function WorkSummary({ window }: { window: { from: string; to: string } }) {
  const query = useActivitySummary(window);
  const data = query.data?.data;
  return (
    <div className="space-y-4" data-testid="report-work-summary">
      <p className="text-sm text-muted-foreground">Records created on the chosen dates, for every unit you can see. Counts follow your access in the selected plant.</p>
      <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
        {data && (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <WorkItems title="Investigations" testId="report-rca-summary" summary={data.rcaCases} overdueLabel="past their target date" />
              <WorkItems title="Tasks" testId="report-task-summary" summary={data.tasks} overdueLabel="overdue" />
            </div>
            {data.audit && <AuditActivity audit={data.audit} />}
          </>
        )}
      </DataState>
    </div>
  );
}
