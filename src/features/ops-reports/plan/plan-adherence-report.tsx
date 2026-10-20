import { usePlanAdherence } from '@/api/v2/queries/ops-reports';
import type { PlanAdherenceRowView } from '@/api/v2/types/ops-reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { shareText } from '@/features/pla-analytics/model/display';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';
import { PrimeYieldTrend } from '../quality/prime-yield-trend';

const share = (value: string | null) => <LocalizedNumber text={shareText(value)} />;

const COLUMNS: Array<DataTableColumn<PlanAdherenceRowView>> = [
  {
    id: 'product',
    header: 'Product',
    cell: (r) => (
      <span data-testid="adherence-row">
        {r.productCode ?? 'Unknown product'}
        {r.uom && <span className="ml-1 text-xs text-muted-foreground">({r.uom})</span>}
      </span>
    ),
  },
  { id: 'planned', header: 'Planned days', align: 'right', cell: (r) => <NumberText value={r.plannedDays} /> },
  { id: 'ran', header: 'Ran as planned', align: 'right', cell: (r) => <NumberText value={r.ranAsPlannedDays} /> },
  { id: 'missed', header: 'Planned, not run', align: 'right', cell: (r) => <NumberText value={r.missedDays} /> },
  { id: 'unplanned', header: 'Run without plan', align: 'right', cell: (r) => <NumberText value={r.unplannedDays} /> },
  { id: 'target', header: 'Plan', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.target} fractionDigits={1} /> },
  { id: 'actual', header: 'Actual', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.actual} fractionDigits={1} /> },
  { id: 'attainment', header: 'Attainment', align: 'right', nowrap: true, cell: (r) => share(r.attainment) },
  { id: 'volume', header: 'Volume adherence', align: 'right', nowrap: true, cell: (r) => share(r.volumeAdherence) },
  { id: 'days', header: 'Day adherence', align: 'right', nowrap: true, cell: (r) => share(r.dayAdherence) },
];

/**
 * Plan adherence by grade (R11, planner, plant manager): did each planned grade run on its planned days and
 * how much of the plan it met — attainment, volume adherence (a day's overproduction never makes up for
 * another day) and day adherence — then the daily output per grade.
 */
export function PlanAdherenceReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = usePlanAdherence(scopeBase(scope), env.timezone);
  const rows = query.data?.data.rows ?? [];
  return (
    <div className="space-y-4" data-testid="plan-adherence">
      <AnalyticsCard
        title="Plan adherence by grade"
        testId="plan-adherence-table"
        query={query}
        response={query.data}
        approvedOnly={scope.approvedOnly}
        isEmpty={query.data !== undefined && rows.length === 0}
        emptyText="No production periods start on these dates."
        note="Volume adherence counts each day's output only up to that day's plan."
      >
        <DataTable caption="Plan adherence by grade" columns={COLUMNS} rows={rows} getRowKey={(r) => `${r.productId ?? '-'}|${r.uom ?? '-'}`} density="compact" />
      </AnalyticsCard>
      <PrimeYieldTrend scope={scope} />
    </div>
  );
}
