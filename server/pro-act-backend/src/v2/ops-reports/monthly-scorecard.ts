import { EntityManager } from 'typeorm';
import { formatDec, toDec } from '../../domain/actuals/decimal';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  amountOf,
  lossTreeCells,
  statusOf,
} from '../pla-reports/loss-tree-report';
import { defaultLossValueMetric } from '../reports/loss-value-default';
import {
  aggregateView,
  KpiAggregateView,
  reportEnvelope,
} from '../reports/kpi-reports-v2.view';
import {
  GroupedTerms,
  kpiGroups,
  params,
  periodStats,
  policyVersions,
  SHOWN,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';
import { ratio } from './production-by-product';

const OEE: readonly KpiMetric[] = [
  'oee',
  'availability',
  'performance',
  'quality',
];

/** Output of one month and unit of measure (decimal strings). */
export interface ScorecardOutputView {
  uom: string | null;
  capacity: string | null;
  good: string | null;
  target: string | null;
  actual: string | null;
  /** good / capacity */
  utilisation: string | null;
  /** (capacity − good) / capacity: the share of capacity lost */
  lossShare: string | null;
  /** actual / target */
  planAttainment: string | null;
}

/** The loss value of one month in one currency; null amount = not (fully) valued, never 0. */
export interface ScorecardValueView {
  currency: string | null;
  amount: string | null;
  status: string;
}

export interface ScorecardMonthView {
  month: string;
  oee: KpiAggregateView[];
  output: ScorecardOutputView[];
  lossValue: ScorecardValueView[];
}

export interface MonthlyScorecardView {
  months: ScorecardMonthView[];
  /** the valuation view of `lossValue` (the approved policy's default management view) */
  valueMetric: string;
  calculationRunIds: string[];
}

export interface OutputRow {
  month: string;
  uom: string | null;
  capacity: string | null;
  good: string | null;
  target: string | null;
  actual: string | null;
}

/** Capacity and plan ledger totals of the shown runs per plant month and unit of measure. $1..$5 = SHOWN. */
const OUTPUT_SQL = `${SHOWN}
SELECT ${TIME_GROUPS.month} AS "month", t."uom",
       (sum(t."capacity_qty") FILTER (WHERE t."ledger" = 'capacity'))::text AS "capacity",
       (sum(t."good_qty") FILTER (WHERE t."ledger" = 'capacity'))::text AS "good",
       (sum(t."target_qty") FILTER (WHERE t."ledger" = 'plan'))::text AS "target",
       (sum(t."actual_qty") FILTER (WHERE t."ledger" = 'plan'))::text AS "actual"
  FROM shown s
  JOIN "period_ledger_totals" t ON t."run_id" = s."run_id" AND t."tenant_id" = $1
 GROUP BY 1, 2 ORDER BY 1, 2`;

const dec = (value: string | null) => {
  const d = toDec(value);
  return d === null ? null : formatDec(d);
};

export function toOutput(row: OutputRow): ScorecardOutputView {
  const capacity = toDec(row.capacity);
  const good = toDec(row.good);
  const lost =
    capacity === null || good === null ? null : formatDec(capacity.minus(good));
  return {
    uom: row.uom,
    capacity: dec(row.capacity),
    good: dec(row.good),
    target: dec(row.target),
    actual: dec(row.actual),
    utilisation: ratio(row.good, row.capacity),
    lossShare: ratio(lost, row.capacity),
    planAttainment: ratio(row.actual, row.target),
  };
}

/** Loss value per month and currency in the default view (the loss tree's valuation rules). */
async function valuesByMonth(
  manager: EntityManager,
  scope: ReportScope,
  metric: Awaited<ReturnType<typeof defaultLossValueMetric>>,
): Promise<Map<string, ScorecardValueView[]>> {
  const { rows } = await lossTreeCells(manager, scope, {
    groupBy: 'kind',
    groupSql: TIME_GROUPS.month,
    metric,
    ledger: 'plan',
  });
  const out = new Map<string, ScorecardValueView[]>();
  for (const row of rows) {
    if (!row.group_key) continue;
    const amount = amountOf(row, false);
    const values = out.get(row.group_key) ?? [];
    values.push({
      currency: row.unit,
      amount: amount === null ? null : formatDec(amount),
      status: statusOf(row, false),
    });
    out.set(row.group_key, values);
  }
  return out;
}

function monthsOf(
  oee: GroupedTerms,
  output: readonly OutputRow[],
  values: Map<string, ScorecardValueView[]>,
): ScorecardMonthView[] {
  const months = new Set<string>([
    ...[...oee.keys()].flatMap((k) => (k ? [k] : [])),
    ...output.map((r) => r.month),
    ...values.keys(),
  ]);
  return [...months].sort().map((month) => ({
    month,
    oee: OEE.map((m) => aggregateView(m, oee.get(month)?.get(m))),
    output: output.filter((r) => r.month === month).map(toOutput),
    lossValue: values.get(month) ?? [],
  }));
}

/**
 * `GET /reports/monthly-scorecard` (R12): per plant month — operational OEE with its components, output
 * against capacity (utilisation, share of capacity lost) and plan (attainment), and the money lost in the
 * default valuation view — all sums of the shown runs' stored results. The page reads the last 12 months.
 */
export async function monthlyScorecard(
  manager: EntityManager,
  scope: ReportScope,
): Promise<AnalyticsResponse<MonthlyScorecardView>> {
  const metric = await defaultLossValueMetric(manager, scope.tenantId);
  const [oee, output, values, stats] = await Promise.all([
    kpiGroups(manager, scope, {
      groupSql: TIME_GROUPS.month,
      metrics: OEE,
      level: 'period',
    }),
    manager.query<OutputRow[]>(OUTPUT_SQL, params(scope)),
    valuesByMonth(manager, scope, metric),
    periodStats(manager, scope),
  ]);
  const data: MonthlyScorecardView = {
    months: monthsOf(oee, output, values),
    valueMetric: metric,
    calculationRunIds: stats.runIds,
  };
  const unvalued = data.months.some((m) =>
    m.lossValue.some((v) => v.amount === null),
  );
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: unvalued ? ['some months are not fully valued'] : [],
  });
}
