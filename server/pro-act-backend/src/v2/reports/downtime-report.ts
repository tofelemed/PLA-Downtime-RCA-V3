import { EntityManager } from 'typeorm';
import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  CELL_KEY,
  REASON_TREE,
  ReasonParent,
  resolveReasonParent,
  subtreeSql,
} from './downtime-reason-tree';
import { DowntimeGroup, DowntimeReportQueryDto } from './kpi-reports-v2.dto';
import {
  aggregateView,
  DowntimeReportView,
  KpiAggregateView,
  reportEnvelope,
} from './kpi-reports-v2.view';
import {
  breakdownGroups,
  BreakdownSpec,
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from './report-sql';
import { ReportScope } from './report-scope';
import { dataCoverage } from './data-coverage';
import { calendarBasisOf } from './calendar-basis-report';

/** Period-level downtime KPIs of the whole scope (KPI05 / KPI06), summed in SQL (AN03). */
const SUMMARY_METRICS: readonly KpiMetric[] = [
  'downtime_total',
  'downtime_planned',
  'downtime_unplanned',
  'downtime_equivalent',
  'downtime_in_schedule',
  'downtime_external',
  'downtime_maintenance_overrun',
  'coded_downtime_ratio',
  'microstop_time',
  'unknown_time',
  'stop_count',
  'carry_in_count',
  'mean_stop_duration',
  'scheduled_availability',
  'controllable_availability',
  'onstream_factor',
];

export interface GroupPlan {
  dimension: string;
  groupSql: string;
  join?: string;
  /** label lookup: SQL returning (id, label) for ids $1 of tenant $2 */
  labels?: string;
}

const REASON_LABELS = `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "reason_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`;

/** groupBy → breakdown dimension, SQL key and label source (whitelisted; never user text in SQL). */
export const PLANS: Readonly<Record<DowntimeGroup, GroupPlan>> = {
  reason: { dimension: 'reason', groupSql: CELL_KEY, labels: REASON_LABELS },
  reasonLevel1: {
    dimension: 'reason',
    groupSql: `COALESCE(NULLIF(split_part(rc."path", '/', 1), ''), ${CELL_KEY})`,
    join: REASON_TREE,
    labels: REASON_LABELS,
  },
  reasonChild: {
    dimension: 'reason',
    groupSql: CELL_KEY,
    join: REASON_TREE,
    labels: REASON_LABELS,
  },
  impact: {
    dimension: 'impact',
    groupSql: CELL_KEY,
    labels: `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "impact_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
  },
  oee: { dimension: 'oee_component', groupSql: CELL_KEY },
  asset: {
    dimension: 'asset',
    groupSql: CELL_KEY,
    labels: `SELECT "id"::text AS "id", "name" AS "label" FROM "assets" WHERE "id"::text = ANY($1) AND "tenant_id" = $2::uuid`,
  },
  shift: { dimension: 'none', groupSql: TIME_GROUPS.shift },
  crew: {
    dimension: 'none',
    groupSql: TIME_GROUPS.crew,
    labels: `SELECT "id"::text AS "id", "name" AS "label" FROM "crews" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`,
  },
  day: { dimension: 'none', groupSql: TIME_GROUPS.day },
  week: { dimension: 'none', groupSql: TIME_GROUPS.week },
  month: { dimension: 'none', groupSql: TIME_GROUPS.month },
};

async function labelsOf(
  manager: EntityManager,
  scope: ReportScope,
  plan: GroupPlan,
  keys: string[],
): Promise<Map<string, string>> {
  if (!plan.labels || keys.length === 0)
    return new Map(keys.map((k) => [k, k]));
  const rows: Array<{ id: string; label: string }> = await manager.query(
    plan.labels,
    [keys, scope.tenantId],
  );
  return new Map(rows.map((r) => [r.id, r.label]));
}

export type Cell = { key: string | null; amount: Dec; periods: number };

/** Labelled groups with their share and cumulative share of the total (Pareto order kept from SQL). */
export async function groupViews(
  manager: EntityManager,
  scope: ReportScope,
  plan: GroupPlan,
  cells: readonly Cell[],
): Promise<Pick<DowntimeReportView, 'groups' | 'total'>> {
  const total = cells.reduce((sum, c) => sum.plus(c.amount), ZERO);
  const keys = cells.flatMap((c) => (c.key ? [c.key] : []));
  const labels = await labelsOf(manager, scope, plan, keys);
  const share = (amount: Dec) =>
    total.isZero() ? null : amount.div(total).toDecimalPlaces(10).toFixed();
  let running = ZERO;
  return {
    groups: cells.map((c) => {
      running = running.plus(c.amount);
      return {
        key: c.key,
        label: c.key ? (labels.get(c.key) ?? null) : null,
        value: formatDec(c.amount),
        share: share(c.amount),
        cumulativeShare: share(running),
        periods: c.periods,
      };
    }),
    total: formatDec(total),
  };
}

/** The breakdown query of a grouping, restricted to a reason subtree when a parent is given. */
export function breakdownSpec(
  groupBy: DowntimeGroup,
  query: Pick<
    DowntimeReportQueryDto,
    'metric' | 'scheduleClass' | 'includeMicroStops'
  >,
  parent: ReasonParent | null,
): BreakdownSpec {
  const plan = PLANS[groupBy];
  const metric = query.metric ?? 'duration';
  const base: BreakdownSpec = {
    groupSql: plan.groupSql,
    metric: metric === 'duration' ? 'downtime_total' : 'stop_count',
    dimension: plan.dimension,
    scheduleClass: query.scheduleClass ?? null,
    includeMicroStops: query.includeMicroStops ?? false,
    join: plan.join,
  };
  if (!parent) return base;
  const subtree = subtreeSql(groupBy, parent);
  return {
    ...base,
    groupSql: subtree.groupSql ?? base.groupSql,
    join: REASON_TREE,
    where: subtree.where,
    extraParams: subtree.extraParams,
  };
}

/** Plan 2.3: marks run-based figures `calculated`, so they are never read as calendar-basis ones. */
export function calculatedBasis(
  views: readonly KpiAggregateView[],
): KpiAggregateView[] {
  return views.map((view) => ({ ...view, basis: 'calculated' }));
}

export async function summaryOf(
  manager: EntityManager,
  scope: ReportScope,
): Promise<KpiAggregateView[]> {
  const terms = await kpiGroups(manager, scope, {
    groupSql: `'total'`,
    metrics: SUMMARY_METRICS,
    level: 'period',
    excludeUnknownTime: true,
  });
  const total = terms.get('total');
  return SUMMARY_METRICS.map((m) => aggregateView(m, total?.get(m)));
}

/**
 * `GET /reports/downtime` (KPI05, plan 2.7 step 5): downtime seconds (allocated per cause, so every
 * grouping adds up to the union of the stops) or stop frequency (occurrences starting in the window,
 * split fragments counted once) from the stored breakdown cells of the shown runs, largest first, with
 * the cumulative share (Pareto) and the period KPI summary of the scope; `parentReasonId` restricts the
 * reason groupings to a subtree (plan 3.3 drill-down).
 */
export async function downtimeReport(
  manager: EntityManager,
  scope: ReportScope,
  query: DowntimeReportQueryDto,
): Promise<AnalyticsResponse<DowntimeReportView>> {
  const groupBy = query.groupBy ?? 'reason';
  const metric = query.metric ?? 'duration';
  const plan = PLANS[groupBy];
  // independent reads run concurrently (perf audit P06): the groups chain, the run stats and their
  // policy versions, the summary, the data coverage and the calendar basis
  const groupsOf = async () => {
    const parent = await resolveReasonParent(
      manager,
      scope,
      groupBy,
      query.parentReasonId,
    );
    const cells = await breakdownGroups(
      manager,
      scope,
      breakdownSpec(groupBy, query, parent),
    );
    return groupViews(manager, scope, plan, cells);
  };
  const statsOf = async () => {
    const found = await periodStats(manager, scope);
    return { found, versions: await policyVersions(manager, found.runIds) };
  };
  const [groups, { found: stats, versions }, summary, coverage, calendar] =
    await Promise.all([
      groupsOf(),
      statsOf(),
      summaryOf(manager, scope),
      dataCoverage(manager, scope),
      calendarBasisOf(manager, scope, query.scheduleClass ?? null),
    ]);
  const data: DowntimeReportView = {
    groupBy,
    metric,
    unit: metric === 'duration' ? 's' : 'count',
    scheduleClass: query.scheduleClass ?? null,
    includeMicroStops: query.includeMicroStops ?? false,
    parentReasonId: query.parentReasonId ?? null,
    ...groups,
    summary: calculatedBasis(summary),
    dataCoverage: coverage,
    calculationRunIds: stats.runIds,
    calendarBasis: calendar,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: versions,
    provisionalData: false,
    notes: ['null key = not coded / not assigned'],
  });
}
