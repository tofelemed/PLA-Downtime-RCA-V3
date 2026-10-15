import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { params, SHOWN } from './report-sql';
import { ReportScope } from './report-scope';

/** Bucket of valued lines stored before valuation 2.8.0 (no parts): kept so the parts add up to the total. */
export const NOT_BROKEN_DOWN = 'not_broken_down';
/** Bucket of economic lines without a value (no parts to break down; their reasons are listed). */
export const UNVALUED = 'unvalued';

/**
 * The shown period's line valuations of one view: the approved plan lines of an approved revision
 * (VA-01b), otherwise the lines of the shown run in the requested ledger — loss kinds only ($8).
 */
const LINES = `lines AS (
  SELECT x.* FROM shown s
  JOIN LATERAL (
    SELECT al."uom", al."quantity", v."currency", v."amount", v."status"::text AS "status", v."reason",
           v."provisional", v."components"
      FROM "approved_loss_lines" al
      JOIN "approved_loss_line_valuations" v ON v."approved_line_id" = al."id" AND v."tenant_id" = $1
     WHERE $7::text = 'plan' AND s."lifecycle" = 'approved' AND al."revision_id" = s."revision_id"
       AND al."tenant_id" = $1 AND v."view" = $6::valuation_view AND al."kind"::text = ANY($8::text[])
    UNION ALL
    SELECT l."uom", l."quantity", v."currency", v."amount", v."status"::text, v."reason",
           v."provisional", v."components"
      FROM "loss_line_valuations" v
      JOIN "loss_lines" l ON l."id" = v."loss_line_id"
     WHERE v."run_id" = s."run_id" AND v."tenant_id" = $1 AND v."ledger" = $7::loss_ledger
       AND v."view" = $6::valuation_view AND l."kind"::text = ANY($8::text[])
       AND NOT ($7::text = 'plan' AND s."lifecycle" = 'approved' AND EXISTS (
             SELECT 1 FROM "approved_loss_lines" y WHERE y."revision_id" = s."revision_id" AND y."tenant_id" = $1))
  ) x ON true
)`;

/** Per component, currency and unit: Σ amount, lines, lines without an FX rate, provisional lines, Σ tonnes. */
const COMPONENTS_SQL = `${SHOWN}, ${LINES}
SELECT c.e->>'component' AS "component", l."currency", l."uom",
       sum((c.e->>'amount')::numeric)::text AS "amount", count(*)::int AS "lines",
       count(*) FILTER (WHERE c.e->>'amount' IS NULL)::int AS "fx_missing",
       count(*) FILTER (WHERE (c.e->>'provisional')::boolean IS TRUE)::int AS "fx_provisional",
       sum((c.e->>'quantity')::numeric)::text AS "quantity", NULL::text[] AS "reasons"
  FROM lines l CROSS JOIN LATERAL jsonb_array_elements(l."components") c(e)
 WHERE l."status" = 'valued' AND l."components" IS NOT NULL
 GROUP BY 1, 2, 3
UNION ALL
SELECT '${NOT_BROKEN_DOWN}', l."currency", l."uom", sum(l."amount")::text, count(*)::int,
       count(*) FILTER (WHERE l."amount" IS NULL)::int, count(*) FILTER (WHERE l."provisional")::int,
       sum(l."quantity")::text, NULL::text[]
  FROM lines l WHERE l."status" = 'valued' AND l."components" IS NULL
 GROUP BY 2, 3
UNION ALL
SELECT '${UNVALUED}', l."currency", l."uom", NULL, count(*)::int, 0, 0, sum(l."quantity")::text,
       array_agg(DISTINCT l."reason") FILTER (WHERE l."reason" IS NOT NULL)
  FROM lines l WHERE l."status" = 'unvalued'
 GROUP BY 2, 3
ORDER BY 1, 2, 3`;

interface ComponentRow {
  component: string;
  currency: string;
  uom: string | null;
  amount: string | null;
  lines: number;
  fx_missing: number;
  fx_provisional: number;
  quantity: string | null;
  reasons: string[] | null;
}

/** One component in one reporting currency. */
export interface ComponentValueView {
  currency: string;
  /** decimal string; null when unvalued or a line lacks an approved FX rate (never estimated) */
  amount: string | null;
  status: 'valued' | 'unvalued' | 'mixed';
  /** SME V7: some part was converted with an authorised provisional FX rate */
  fxProvisional: boolean;
  reasons: string[];
  /** lines carrying this component */
  lines: number;
}

/** A component of the economic view: its value per currency and the tonnes it applies to per unit. */
export interface ComponentGroupView {
  key: string;
  currencies: ComponentValueView[];
  quantities: Array<{ uom: string | null; quantity: string }>;
}

const sum = (values: Array<string | null>) =>
  values.reduce((acc, v) => acc.plus(toDec(v) ?? 0), new Dec(0));

function statusOf(
  key: string,
  lines: number,
  missing: number,
): ComponentValueView['status'] {
  if (key === UNVALUED || missing === lines) return 'unvalued';
  return missing > 0 ? 'mixed' : 'valued';
}

function currencyOf(
  key: string,
  currency: string,
  rows: readonly ComponentRow[],
): ComponentValueView {
  const lines = rows.reduce((n, r) => n + r.lines, 0);
  const missing = rows.reduce((n, r) => n + r.fx_missing, 0);
  const unvalued = key === UNVALUED;
  const reasons = rows.flatMap((r) => r.reasons ?? []);
  if (missing > 0) reasons.push('fx_rate_missing');
  if (rows.some((r) => r.fx_provisional > 0))
    reasons.push('fx_rate_provisional');
  return {
    currency,
    amount:
      unvalued || missing > 0
        ? null
        : formatDec(sum(rows.map((r) => r.amount))),
    status: statusOf(key, lines, missing),
    fxProvisional: rows.some((r) => r.fx_provisional > 0),
    reasons: [...new Set(reasons)].sort(),
    lines,
  };
}

function groupOf(
  key: string,
  rows: readonly ComponentRow[],
): ComponentGroupView {
  const currencies = [...new Set(rows.map((r) => r.currency))].sort();
  const first = rows.filter((r) => r.currency === currencies[0]);
  const uoms = [...new Set(first.map((r) => r.uom))];
  return {
    key,
    currencies: currencies.map((c) =>
      currencyOf(
        key,
        c,
        rows.filter((r) => r.currency === c),
      ),
    ),
    // tonnes of one currency's rows (every reporting currency carries the same lines)
    quantities: uoms.map((uom) => ({
      uom,
      quantity: formatDec(
        sum(first.filter((r) => r.uom === uom).map((r) => r.quantity)),
      ),
    })),
  };
}

/** Components in a stable order: the economic parts, then the not-broken-down and unvalued buckets. */
function ordered(keys: readonly string[]): string[] {
  const rank = (k: string) =>
    k === NOT_BROKEN_DOWN ? 1 : k === UNVALUED ? 2 : 0;
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

/**
 * VA-04: the economic view of the shown periods broken down by component (lost contribution, variable
 * cost, salvage, disposal, price difference, rework cost, yield-loss parts, displaced contribution), each
 * with its status per currency — summed in SQL from the stored line parts, so they add up to the total.
 */
export async function componentGroups(
  manager: EntityManager,
  scope: ReportScope,
  spec: { ledger: string; kinds: string[] },
): Promise<ComponentGroupView[]> {
  const rows = await manager.query<ComponentRow[]>(COMPONENTS_SQL, [
    ...params(scope),
    'economic_impact',
    spec.ledger,
    spec.kinds,
  ]);
  const keys = ordered([...new Set(rows.map((r) => r.component))]);
  return keys.map((key) =>
    groupOf(
      key,
      rows.filter((r) => r.component === key),
    ),
  );
}
