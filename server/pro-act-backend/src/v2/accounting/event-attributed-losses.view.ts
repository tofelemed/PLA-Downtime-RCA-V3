import { DefaultBasis } from '../../domain/valuation/valuation.types';

/** One reporting currency of the attributed value (status semantics of the RCA approved impact). */
export interface AttributedValueV2View {
  currency: string;
  /** decimal string; null when any line is not valued or lacks an FX rate (never estimated, D08) */
  amount: string | null;
  valuedLines: number;
  unvaluedLines: number;
  /** SME V7: valued lines converted with an authorised provisional FX rate */
  provisionalLines: number;
  status: 'valued' | 'unvalued' | 'mixed';
  fxProvisional: boolean;
}

export interface AttributedQuantityV2View {
  kind: string;
  uom: string | null;
  /** signed decimal string */
  quantity: string;
  lines: number;
}

/** The loss one event carries in one period revision (UX G-2b). */
export interface AttributedPeriodV2View {
  periodId: string;
  unitId: string;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  /** the plan of the period's accounting-baseline plan version (null = profile default product) */
  planId: string | null;
  planVersionId: string | null;
  revisionId: string;
  revision: number;
  /** approved | draft | in_review */
  lifecycle: string;
  /** approved = the published revision's approved lines; provisional = the open revision's run proposals */
  status: 'approved' | 'provisional';
  quantities: AttributedQuantityV2View[];
  values: AttributedValueV2View[];
}

export interface EventAttributedLossesV2View {
  eventId: string;
  /** SME V8: the valuation view of `values` (the tenant policy's default basis) */
  valuationView: DefaultBasis;
  items: AttributedPeriodV2View[];
  /** more periods than the bound carried this event; the earliest ones are listed */
  truncated: boolean;
  asOf: string;
}

export interface QuantityRow {
  period_id: string;
  unit_id: string;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  utc_end: Date;
  plan_version_id: string | null;
  plan_id: string | null;
  revision_id: string;
  revision: number;
  lifecycle: string;
  status: 'approved' | 'provisional';
  kind: string;
  uom: string | null;
  quantity: string;
  lines: number;
}

export interface ValueRow {
  period_id: string;
  revision_id: string;
  currency: string;
  amount: string | null;
  valued: number;
  unvalued: number;
  provisional: number;
}

function valueView(row: ValueRow): AttributedValueV2View {
  return {
    currency: row.currency,
    amount: row.amount,
    valuedLines: row.valued,
    unvaluedLines: row.unvalued,
    provisionalLines: row.provisional,
    status:
      row.valued === 0 ? 'unvalued' : row.unvalued === 0 ? 'valued' : 'mixed',
    fxProvisional: row.provisional > 0,
  };
}

function periodView(row: QuantityRow): AttributedPeriodV2View {
  return {
    periodId: row.period_id,
    unitId: row.unit_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    utcStart: new Date(row.utc_start).toISOString(),
    utcEnd: new Date(row.utc_end).toISOString(),
    planId: row.plan_id,
    planVersionId: row.plan_version_id,
    revisionId: row.revision_id,
    revision: row.revision,
    lifecycle: row.lifecycle,
    status: row.status,
    quantities: [],
    values: [],
  };
}

/**
 * Groups the quantity and value rows into one item per (period, revision), in period order; at most `max`
 * periods (the query reads one more to tell whether the list was cut).
 */
export function attributedPeriods(
  quantities: readonly QuantityRow[],
  values: readonly ValueRow[],
  max: number,
): { items: AttributedPeriodV2View[]; truncated: boolean } {
  const items = new Map<string, AttributedPeriodV2View>();
  const periods: string[] = [];
  for (const row of quantities) {
    if (!periods.includes(row.period_id)) periods.push(row.period_id);
    if (periods.length > max) break;
    const key = `${row.period_id}:${row.revision_id}`;
    const item = items.get(key) ?? periodView(row);
    item.quantities.push({
      kind: row.kind,
      uom: row.uom,
      quantity: row.quantity,
      lines: row.lines,
    });
    items.set(key, item);
  }
  for (const row of values) {
    items
      .get(`${row.period_id}:${row.revision_id}`)
      ?.values.push(valueView(row));
  }
  return { items: [...items.values()], truncated: periods.length > max };
}
