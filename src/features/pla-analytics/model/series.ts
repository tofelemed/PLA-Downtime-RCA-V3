import type { ReconciliationTrendView } from '@/api/v2/types/pla-analytics';
import type { OeeReportView } from '@/api/v2/types/reports';

export interface SeriesRowModel {
  label: string;
  values: Record<string, string | null>;
}

/** OEE report groups as chart rows: one value per component, the server's value or null (never filled). */
export function oeeRows(report: OeeReportView | undefined, labelOf: (key: string | null) => string = (key) => key ?? '—'): SeriesRowModel[] {
  return (report?.groups ?? []).map((group) => ({
    label: labelOf(group.key),
    values: Object.fromEntries(group.metrics.map((m) => [m.metric, m.value])),
  }));
}

/** Units of measure of a reconciliation trend, in server order (never mixed in one series). */
export function trendUnits(view: ReconciliationTrendView | undefined): Array<string | null> {
  return [...new Set((view?.buckets ?? []).filter((b) => b.uom !== null || b.excludedSlices === 0).map((b) => b.uom))];
}

/** Reconciliation trend buckets of one unit of measure as chart rows. */
export function residualRows(view: ReconciliationTrendView | undefined, uom: string | null): SeriesRowModel[] {
  return (view?.buckets ?? [])
    .filter((b) => b.uom === uom)
    .map((b) => ({ label: b.key, values: { unaccounted: b.unaccounted, overAccounted: b.overAccounted, overproduction: b.overproduction } }));
}
