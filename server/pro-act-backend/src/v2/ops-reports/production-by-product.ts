import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { AnalyticsResponse } from '../common/response';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import {
  params,
  periodStats,
  policyVersions,
  SHOWN,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';
import { ProductionGroup } from './ops-reports-v2.dto';

/** Quantities of one product (and group) in its unit of measure, decimal strings; null = no measured slice. */
export interface ProductionQuantitiesView {
  /** capacity ledger: what the approved capacity rate allows in the scheduled time */
  capacity: string | null;
  /** plan ledger: the plan's target */
  target: string | null;
  /** plan ledger: the actual output the plan is judged on */
  actual: string | null;
  gross: string | null;
  good: string | null;
  /** first-pass good of the prime grade (good − wide spec) */
  prime: string | null;
  wideSpec: string | null;
  downgrade: string | null;
  transitionOffGrade: string | null;
  scrap: string | null;
  rework: string | null;
  /** non-conforming output no approved disposition classifies yet */
  unclassified: string | null;
  recovered: string | null;
  /** first-pass defects: downgrade + transition off-grade + scrap + rework + unclassified */
  offGrade: string | null;
}

export interface ProductionRowView extends ProductionQuantitiesView {
  /** group key: `total`, the plant day / week / month, or the unit id */
  key: string;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  uom: string | null;
  /** prime / gross, 0..1; null without gross */
  primeYield: string | null;
  /** actual / target, 0..1+; null without a target */
  planAttainment: string | null;
  /** product slices behind the row, and how many have complete actuals */
  slices: number;
  completeSlices: number;
}

export interface ProductionByProductView {
  groupBy: ProductionGroup;
  rows: ProductionRowView[];
  calculationRunIds: string[];
}

const QUANTITIES = [
  'capacity',
  'target',
  'actual',
  'gross',
  'good',
  'prime',
  'wideSpec',
  'downgrade',
  'transitionOffGrade',
  'scrap',
  'rework',
  'unclassified',
  'recovered',
  'offGrade',
] as const;

type Row = {
  group_key: string;
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  uom: string | null;
  slices: number;
  complete_slices: number;
} & Record<(typeof QUANTITIES)[number], string | null>;

const cls = (name: string) =>
  `sum((a."quality_classes"->>'${name}')::numeric)::text`;

const OFF_GRADE = `(sum(${[
  'downgrade',
  'transitionOffGrade',
  'scrap',
  'rework',
  'unclassified',
]
  .map((name) => `coalesce((a."quality_classes"->>'${name}')::numeric, 0)`)
  .join(' + ')}) FILTER (WHERE a."quality_classes" IS NOT NULL))::text`;

/**
 * Per shown run and product slice: the capacity and plan ledger totals and the slice's actuals
 * (`actuals_results` of the run's actuals run, quality classes of SME E3). $1..$5 = SHOWN.
 */
const sql = (groupSql: string) => `${SHOWN}
SELECT ${groupSql} AS "group_key", ps."product_id"::text AS "product_id", max(pr."code") AS "product_code",
       max(pr."name") AS "product_name", coalesce(a."uom", lt."uom") AS "uom",
       count(*)::int AS "slices", count(*) FILTER (WHERE a."quality_state" = 'complete')::int AS "complete_slices",
       sum(lt."capacity")::text AS "capacity", sum(lt."target")::text AS "target", sum(lt."actual")::text AS "actual",
       sum(a."gross")::text AS "gross", sum(a."good")::text AS "good", ${cls('firstPassGood')} AS "prime",
       ${cls('wideSpec')} AS "wideSpec", ${cls('downgrade')} AS "downgrade",
       ${cls('transitionOffGrade')} AS "transitionOffGrade", ${cls('scrap')} AS "scrap", ${cls('rework')} AS "rework",
       ${cls('unclassified')} AS "unclassified", ${cls('recovered')} AS "recovered",
       ${OFF_GRADE} AS "offGrade"
  FROM shown s
  JOIN "calculation_runs" cr ON cr."id" = s."run_id" AND cr."tenant_id" = $1
  JOIN LATERAL (SELECT t."slice_id", max(t."uom") AS "uom",
                       sum(t."capacity_qty") FILTER (WHERE t."ledger" = 'capacity') AS "capacity",
                       sum(t."target_qty") FILTER (WHERE t."ledger" = 'plan') AS "target",
                       sum(t."actual_qty") FILTER (WHERE t."ledger" = 'plan') AS "actual"
                  FROM "period_ledger_totals" t
                 WHERE t."run_id" = s."run_id" AND t."tenant_id" = $1
                 GROUP BY t."slice_id") lt ON true
  JOIN "period_product_slices" ps ON ps."id" = lt."slice_id" AND ps."tenant_id" = $1
  LEFT JOIN "products" pr ON pr."id" = ps."product_id" AND pr."tenant_id" = $1
  LEFT JOIN "actuals_results" a ON a."actuals_run_id" = cr."actuals_run_id" AND a."slice_id" = lt."slice_id"
                               AND a."tenant_id" = $1
 GROUP BY 1, 2, 5
 ORDER BY 1, max(pr."code") NULLS LAST, 5`;

const GROUP_SQL: Readonly<Record<ProductionGroup, string>> = {
  total: `'total'`,
  day: TIME_GROUPS.day,
  week: TIME_GROUPS.week,
  month: TIME_GROUPS.month,
  unit: TIME_GROUPS.unit,
};

/** a / b as a decimal string; null when either is missing or b is not positive. */
export function ratio(a: string | null, b: string | null): string | null {
  const top = toDec(a);
  const bottom = toDec(b);
  if (top === null || bottom === null || !bottom.gt(0)) return null;
  return formatDec(top.div(bottom));
}

const quantity = (value: string | null) =>
  value === null ? null : formatDec(new Dec(value));

export function toProductionRow(row: Row): ProductionRowView {
  const amounts = Object.fromEntries(
    QUANTITIES.map((name) => [name, quantity(row[name])]),
  ) as Record<(typeof QUANTITIES)[number], string | null>;
  return {
    key: row.group_key,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    uom: row.uom,
    ...amounts,
    primeYield: ratio(amounts.prime, amounts.gross),
    planAttainment: ratio(amounts.actual, amounts.target),
    slices: row.slices,
    completeSlices: row.complete_slices,
  };
}

/**
 * `GET /reports/production-by-product` (R1, R11): per product and group, the shown runs' capacity and
 * plan targets beside the measured output and its quality classes. Sums only stored results; the two
 * ratios divide the sums (never a mean of ratios). Quantities of different units of measure stay apart.
 */
export async function productionByProduct(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: ProductionGroup,
): Promise<AnalyticsResponse<ProductionByProductView>> {
  const [rows, stats] = await Promise.all([
    manager.query<Row[]>(sql(GROUP_SQL[groupBy]), params(scope)),
    periodStats(manager, scope),
  ]);
  const data: ProductionByProductView = {
    groupBy,
    rows: rows.map(toProductionRow),
    calculationRunIds: stats.runIds,
  };
  const incomplete = data.rows.some((r) => r.completeSlices < r.slices);
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: incomplete ? ['some product slices have incomplete actuals'] : [],
  });
}
