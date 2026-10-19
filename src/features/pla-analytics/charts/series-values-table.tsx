import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { SeriesRow } from './series-chart';

export interface SeriesValuesTableProps {
  rows: readonly SeriesRow[];
  series: ReadonlyArray<{ key: string; label: string }>;
  ratio?: boolean;
  caption: string;
}

/**
 * The values a series chart draws, one row per bucket (QA PLA re-test: the OEE trend had no values table):
 * the server's figures as they come, ratios as percentages; a missing value reads "Not available".
 */
export function SeriesValuesTable({ rows, series, ratio, caption }: SeriesValuesTableProps) {
  const { number, percent } = useNumberFormat();
  const text = (value: string | null | undefined) => {
    if (value === null || value === undefined) return 'Not available';
    return ratio ? percent(Number(value) * 100, 1) : number(Number(value), 2);
  };
  const columns: Array<DataTableColumn<SeriesRow>> = [
    { id: 'label', header: 'Bucket', nowrap: true, cell: (row) => row.label },
    ...series.map<DataTableColumn<SeriesRow>>((s) => ({ id: s.key, header: s.label, align: 'right', nowrap: true, cell: (row) => text(row.values[s.key]) })),
  ];
  return <DataTable caption={caption} columns={columns} rows={[...rows]} getRowKey={(row) => row.label} pager="none" density="compact" />;
}
