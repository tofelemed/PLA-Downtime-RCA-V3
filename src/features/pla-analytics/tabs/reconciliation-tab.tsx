import { Link } from 'react-router-dom';
import { useReconciliationStatus } from '@/api/v2/queries/pla-analytics';
import type { OverduePeriodView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { GRID_WORKFLOW_LABELS, RESIDUAL_LABELS } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { statusQuery, type AnalyticsScope } from '../model/analytics-scope';
import { ageText } from '../model/display';

/**
 * Reconciliation status and age (AN02): periods per workflow and residual state of their current revision,
 * the age of the periods not approved since they ended, and the overdue list (20 per page) with a link to
 * the period in the Plan Dashboard (plan 3.5). Counts are the server's.
 */
export function ReconciliationTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReconciliationStatus(statusQuery(scope), env.timezone);
  const data = query.data?.data;
  const { number } = useNumberFormat();
  return (
    <AnalyticsCard
      title="Reconciliation status and age"
      testId="pla-reconciliation"
      query={query}
      response={query.data}
      isEmpty={data?.periods === 0}
      emptyText="No production periods in this scope."
      note={
        data
          ? `${number(data.periods)} periods · overdue = not submitted ${number(data.sla.submitWithinHours)} h or not approved ${number(data.sla.approveWithinHours)} h after the production day ended (time waiting for data not counted) · ${number(data.waitingForData)} waiting for data · ${number(data.rejectionEscalated)} escalated after repeated rejections.`
          : undefined
      }
    >
      {data && (
        <div className="space-y-3" data-testid="reconciliation-status" data-overdue={data.overdueCount}>
          <CountRow title="Workflow" testId="workflow-count" items={data.workflow.map((w) => ({ key: w.state, label: GRID_WORKFLOW_LABELS[w.state], count: w.periods }))} />
          <CountRow title="Residual" testId="residual-count" items={data.residual.map((r) => ({ key: r.state, label: RESIDUAL_LABELS[r.state], count: r.periods }))} />
          <CountRow title="Age (not approved)" testId="age-count" items={data.ages.map((a) => ({ key: a.key, label: a.label, count: a.periods }))} />
          <h4 className="text-sm font-medium">Overdue ({number(data.overdueCount)})</h4>
          <OverdueTable rows={data.overdue} timezone={env.timezone} />
          {data.overdueCount > data.overdue.length && <p className="text-xs text-muted-foreground">Listing the {number(data.overdue.length)} oldest; the count covers all of them.</p>}
        </div>
      )}
    </AnalyticsCard>
  );
}

function CountRow({ title, items, testId }: { title: string; testId: string; items: Array<{ key: string; label: string; count: number }> }) {
  const { number, text } = useNumberFormat();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-36 text-muted-foreground">{title}</span>
      {items.map((item) => (
        <Badge key={item.key} variant={item.count > 0 ? 'secondary' : 'outline'} data-testid={testId} data-key={item.key} data-count={item.count}>
          {text(item.label)}: {number(item.count)}
        </Badge>
      ))}
    </div>
  );
}

function OverdueTable({ rows, timezone }: { rows: readonly OverduePeriodView[]; timezone: string }) {
  const pref = useCalendarPreference();
  const columns: Array<DataTableColumn<OverduePeriodView>> = [
    { id: 'unit', header: 'Unit', cell: (row) => row.unitName ?? 'Unknown unit' },
    {
      id: 'period',
      header: 'Period',
      nowrap: true,
      cell: (row) => (
        <span data-testid="overdue-period" data-period-id={row.periodId}>
          {formatOperationalDate(row.localDate, pref)} {row.shiftName ?? ''} (<PlantTime iso={row.utcStart} tz={timezone} />)
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (row) => `${GRID_WORKFLOW_LABELS[row.workflowState]}${row.revision !== null ? ` · revision ${row.revision}` : ''}` },
    { id: 'residual', header: 'Residual', cell: (row) => (row.residualState ? RESIDUAL_LABELS[row.residualState] : '—') },
    { id: 'age', header: 'Age', align: 'right', nowrap: true, cell: (row) => ageText(row.ageSeconds, pref.digits) },
    {
      id: 'open',
      header: 'Plan dashboard',
      cell: (row) =>
        row.planId ? (
          <Link className="underline" to={`/plans/${row.planId}/periods/${row.periodId}`} data-testid="overdue-link" data-period-id={row.periodId}>
            Open
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">no plan</span>
        ),
    },
  ];
  return <DataTable caption="Overdue periods" columns={columns} rows={rows} getRowKey={(row) => row.periodId} empty={{ text: 'Nothing overdue.' }} density="compact" />;
}
