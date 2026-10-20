import { useProductionByProduct } from '@/api/v2/queries/ops-reports';
import type { ProductionRowView } from '@/api/v2/types/ops-reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { NumberText } from '@/features/ux-kit/number-text';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { shareText } from '@/features/pla-analytics/model/display';

const qty = (value: string | null) => <NumberText value={value} fractionDigits={1} />;
const productOf = (row: ProductionRowView) => (row.productCode ? `${row.productCode}${row.productName ? ` · ${row.productName}` : ''}` : 'Unknown product');

const COLUMNS: Array<DataTableColumn<ProductionRowView>> = [
  {
    id: 'product',
    header: 'Product',
    cell: (row) => (
      <span data-testid="production-row" data-product={row.productId ?? ''}>
        {productOf(row)}
        {row.uom && <span className="ml-1 text-xs text-muted-foreground">({row.uom})</span>}
      </span>
    ),
  },
  { id: 'target', header: 'Plan', align: 'right', nowrap: true, cell: (row) => qty(row.target) },
  { id: 'actual', header: 'Actual', align: 'right', nowrap: true, cell: (row) => qty(row.actual) },
  { id: 'attainment', header: 'Plan attainment', align: 'right', nowrap: true, cell: (row) => <LocalizedNumber text={shareText(row.planAttainment)} /> },
  { id: 'prime', header: 'Prime', align: 'right', nowrap: true, cell: (row) => qty(row.prime) },
  { id: 'wideSpec', header: 'Wide spec', align: 'right', nowrap: true, cell: (row) => qty(row.wideSpec) },
  { id: 'offGrade', header: 'Off-grade', align: 'right', nowrap: true, cell: (row) => qty(row.offGrade) },
  { id: 'yield', header: 'Prime yield', align: 'right', nowrap: true, cell: (row) => <LocalizedNumber text={shareText(row.primeYield)} /> },
  { id: 'capacity', header: 'Capacity', align: 'right', nowrap: true, cell: (row) => qty(row.capacity) },
];

/**
 * Output per product (R1): plan, actual and attainment, prime, wide spec and off-grade beside the capacity —
 * the server's sums of the shown runs; a product with incomplete actuals is said under the table.
 */
export function ProductionTable({ scope, title, testId }: { scope: AnalyticsScope; title: string; testId: string }) {
  const env = useEventHubEnv();
  const query = useProductionByProduct({ ...scopeBase(scope), groupBy: 'total' }, env.timezone);
  const rows = query.data?.data.rows ?? [];
  const incomplete = rows.filter((row) => row.completeSlices < row.slices).length;
  return (
    <AnalyticsCard title={title} testId={testId} query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={query.data !== undefined && rows.length === 0} emptyText="No production periods start on these dates.">
      <DataTable caption={title} columns={COLUMNS} rows={rows} getRowKey={(row) => `${row.productId ?? '-'}|${row.uom ?? '-'}`} density="compact" />
      {incomplete > 0 && <p className="text-xs text-muted-foreground">Actuals are incomplete for {incomplete === 1 ? 'one product' : `${incomplete} products`}: their output may still change.</p>}
    </AnalyticsCard>
  );
}
