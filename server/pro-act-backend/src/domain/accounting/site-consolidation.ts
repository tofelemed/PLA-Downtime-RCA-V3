import { Dec, formatDec } from '../actuals/decimal';

/** Σ loss of one unit, cause origin and unit of measure over the shown periods (SQL aggregate). */
export interface SiteLossRow {
  unitId: string;
  /** unit of the cause: the event's origin unit, else its own unit, else the period's unit */
  originUnitId: string;
  uom: string | null;
  quantity: string;
  lines: number;
  /** the unit fed another unit of the map then (its loss reaches the site only through that unit) */
  upstream: boolean;
}

export interface QuantityView {
  uom: string | null;
  quantity: string;
}

/** SME Q13 views: origin (cause), impact (each unit's own variance) and the consolidated consequence. */
export interface SiteLossView {
  /** units whose loss is the site's: they feed no other unit (the agreed site / product boundary) */
  boundaryUnitIds: string[];
  /** units that feed another unit: their own loss is impact, not added again at the site */
  upstreamUnitIds: string[];
  /** the consolidated site loss per unit of measure (boundary units only, never double counted) */
  siteTotals: QuantityView[];
  /** the site loss by the unit that caused it (an upstream stop that starved a boundary unit names it) */
  byOrigin: Array<QuantityView & { originUnitId: string; lines: number }>;
  /** every unit's own loss (impact), boundary or not */
  unitImpact: Array<QuantityView & { unitId: string; upstream: boolean }>;
}

const keyOf = (...parts: Array<string | null>) =>
  parts.map((p) => p ?? '').join('\u0000');

function add(
  map: Map<string, { quantity: Dec; lines: number }>,
  key: string,
  row: SiteLossRow,
): void {
  const held = map.get(key) ?? { quantity: new Dec(0), lines: 0 };
  map.set(key, {
    quantity: held.quantity.plus(new Dec(row.quantity)),
    lines: held.lines + row.lines,
  });
}

const byQuantity = (a: QuantityView, b: QuantityView) =>
  new Dec(b.quantity).cmp(new Dec(a.quantity));

/**
 * SME E2 / Q13 consolidation at the site boundary: a unit's real loss is kept as its impact, but only the
 * units that feed no other unit add to the site loss, so an upstream stop counts once — where it reaches
 * the boundary (a stop the buffer absorbed costs the site nothing) — and is attributed to its origin.
 */
export function consolidateSiteLoss(
  rows: readonly SiteLossRow[],
): SiteLossView {
  const site = new Map<string, { quantity: Dec; lines: number }>();
  const origin = new Map<string, { quantity: Dec; lines: number }>();
  const impact = new Map<string, { quantity: Dec; lines: number }>();
  const upstream = new Set(rows.filter((r) => r.upstream).map((r) => r.unitId));
  for (const row of rows) {
    add(impact, keyOf(row.unitId, row.uom), row);
    if (row.upstream) continue;
    add(site, keyOf(row.uom), row);
    add(origin, keyOf(row.originUnitId, row.uom), row);
  }
  const split = (key: string) => key.split('\u0000').map((p) => p || null);
  return {
    boundaryUnitIds: [
      ...new Set(rows.filter((r) => !r.upstream).map((r) => r.unitId)),
    ].sort(),
    upstreamUnitIds: [...upstream].sort(),
    siteTotals: [...site].map(([key, v]) => ({
      uom: split(key)[0],
      quantity: formatDec(v.quantity),
    })),
    byOrigin: [...origin]
      .map(([key, v]) => {
        const [originUnitId, uom] = split(key);
        return {
          originUnitId: originUnitId as string,
          uom,
          quantity: formatDec(v.quantity),
          lines: v.lines,
        };
      })
      .sort(byQuantity),
    unitImpact: [...impact]
      .map(([key, v]) => {
        const [unitId, uom] = split(key);
        return {
          unitId: unitId as string,
          uom,
          quantity: formatDec(v.quantity),
          upstream: upstream.has(unitId as string),
        };
      })
      .sort(byQuantity),
  };
}
