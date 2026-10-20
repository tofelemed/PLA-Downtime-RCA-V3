import type { ProductionRowView } from '@/api/v2/types/ops-reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { NumberText } from '@/features/ux-kit/number-text';
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

/** Output rows per product (server figures) with a note when some product's actuals are incomplete. */
export function ProductionRows({ rows, caption }: { rows: readonly ProductionRowView[]; caption: string }) {
  const incomplete = rows.filter((row) => row.completeSlices < row.slices).length;
  return (
    <>
      <DataTable caption={caption} columns={COLUMNS} rows={[...rows]} getRowKey={(row) => `${row.productId ?? '-'}|${row.uom ?? '-'}`} density="compact" />
      {incomplete > 0 && <p className="text-xs text-muted-foreground">Actuals are incomplete for {incomplete === 1 ? 'one product' : `${incomplete} products`}: their output may still change.</p>}
    </>
  );
}
