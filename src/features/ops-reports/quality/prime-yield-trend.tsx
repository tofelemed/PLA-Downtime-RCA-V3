import { useProductionByProduct } from '@/api/v2/queries/ops-reports';
import type { ProductionRowView } from '@/api/v2/types/ops-reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { shareText } from '@/features/pla-analytics/model/display';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

/** Prime yield per plant day and product (R4): the server's sums per day, newest first, 20 rows a page. */
export function PrimeYieldTrend({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useProductionByProduct({ ...scopeBase(scope), groupBy: 'day' }, env.timezone);
  const rows = [...(query.data?.data.rows ?? [])].reverse();
  const columns: Array<DataTableColumn<ProductionRowView>> = [
    { id: 'day', header: 'Plant date', nowrap: true, cell: (r) => <span data-testid="yield-row">{formatOperationalDate(r.key, pref)}</span> },
    { id: 'product', header: 'Product', cell: (r) => r.productCode ?? 'Unknown product' },
    { id: 'gross', header: 'Gross', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.gross} fractionDigits={1} /> },
    { id: 'prime', header: 'Prime', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.prime} fractionDigits={1} /> },
    { id: 'offGrade', header: 'Off-grade', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.offGrade} fractionDigits={1} /> },
    { id: 'yield', header: 'Prime yield', align: 'right', nowrap: true, cell: (r) => <LocalizedNumber text={shareText(r.primeYield)} /> },
  ];
  return (
    <AnalyticsCard title="Prime yield by day" testId="quality-yield-trend" query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={query.data !== undefined && rows.length === 0} emptyText="No production periods start on these dates.">
      <DataTable caption="Prime yield by day" columns={columns} rows={rows} getRowKey={(r) => `${r.key}|${r.productId ?? '-'}|${r.uom ?? '-'}`} density="compact" />
    </AnalyticsCard>
  );
}
