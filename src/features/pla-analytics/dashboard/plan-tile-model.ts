import type { ReconciliationTrendBucketView } from '@/api/v2/types/pla-analytics';

export const PLAN_ASSET_UNIT_NOTE = "Production vs plan is reported per unit — showing the selected asset's unit.";

/** The window totals of the units of measure that have a unit stated (a null-uom row covers excluded periods only). */
export function totalsByUom(totals: readonly ReconciliationTrendBucketView[]): ReconciliationTrendBucketView[] {
  return totals.filter((row) => row.uom !== null);
}

/** The unit of measure whose total plan is largest, chosen by comparing the server's figures; the first when none has a plan. */
export function defaultUom(totals: readonly ReconciliationTrendBucketView[]): string | null {
  let best: ReconciliationTrendBucketView | undefined;
  for (const row of totalsByUom(totals)) {
    if (!best || Number(row.plan ?? Number.NEGATIVE_INFINITY) > Number(best.plan ?? Number.NEGATIVE_INFINITY)) best = row;
  }
  return best?.uom ?? null;
}

export type QuantityField = 'plan' | 'actual' | 'shortfall' | 'explained' | 'unexplained';

export interface PlanTileDef {
  id: QuantityField;
  title: string;
  info: string;
  highlight?: boolean;
}

export const PLAN_TILES: readonly PlanTileDef[] = [
  { id: 'plan', title: 'Plan', info: 'Planned output of the approved plans over the calculated periods, in the selected unit.' },
  { id: 'actual', title: 'Actual', info: 'Output actually recorded over the same periods.' },
  { id: 'shortfall', title: 'Shortfall', info: 'Planned output that was not produced.', highlight: true },
  { id: 'explained', title: 'Explained loss', info: 'Part of the shortfall attributed to coded causes (stops, slow running, quality).' },
  { id: 'unexplained', title: 'Unexplained', info: 'Part of the shortfall no cause has been given for yet.' },
];
