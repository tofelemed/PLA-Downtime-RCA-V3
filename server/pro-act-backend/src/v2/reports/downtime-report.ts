import { EntityManager } from 'typeorm';
import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { AnalyticsResponse } from '../common/response';
import { DowntimeGroup, DowntimeReportQueryDto } from './kpi-reports-v2.dto';
import { DowntimeReportView, reportEnvelope } from './kpi-reports-v2.view';
import {
  breakdownGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from './report-sql';
import { ReportScope } from './report-scope';

const CELL_KEY = `k."scope"->>'key'`;
const REASON_TREE = `LEFT JOIN "reason_codes" rc ON rc."id"::text = k."scope"->>'key' AND rc."tenant_id" = $1`;

interface GroupPlan {
  dimension: string;
  groupSql: string;
  join?: string;
  /** label lookup: SQL returning (id, label) for ids $1 of tenant $2 */
  labels?: string;
}

const REASON_LABELS = `SELECT "id"::text AS "id", "code" || ' ' || "name" AS "label" FROM "reason_codes" WHERE "id"::text = ANY($1) AND "tenant_id" = $2`;

/** groupBy → breakdown dimension, SQL key and label source (whitelisted; never user text in SQL). */
const PLANS: Readonly<Record<DowntimeGroup, GroupPlan>> = {
  reason: { dimension: 'reason', groupSql: CELL_KEY, labels: REASON_LABELS },
  reasonLevel1: {
    dimension: 'reason',
    groupSql: `COALESCE(NULLIF(split_part(rc."path", '/', 1), ''), ${CELL_KEY})`,
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
    labels: `SELECT "id"::text AS "id", "name" AS "label" FROM "assets" WHERE "id"::text = ANY($1) AND "tenant_id" = $2::text`,
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

type Cell = { key: string | null; amount: Dec; periods: number };

/** Labelled groups with their share of the total (Pareto order kept from SQL). */
async function groupViews(
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
  return {
    groups: cells.map((c) => ({
      key: c.key,
      label: c.key ? (labels.get(c.key) ?? null) : null,
      value: formatDec(c.amount),
      share: share(c.amount),
      periods: c.periods,
    })),
    total: formatDec(total),
  };
}

/**
 * `GET /reports/downtime` (KPI05, plan 2.7 step 5): downtime seconds (allocated per cause, so every
 * grouping adds up to the union of the stops) or stop frequency (occurrences starting in the window,
 * split fragments counted once) from the stored breakdown cells of the shown runs, largest first.
 */
export async function downtimeReport(
  manager: EntityManager,
  scope: ReportScope,
  query: DowntimeReportQueryDto,
): Promise<AnalyticsResponse<DowntimeReportView>> {
  const groupBy = query.groupBy ?? 'reason';
  const metric = query.metric ?? 'duration';
  const plan = PLANS[groupBy];
  const cells = await breakdownGroups(manager, scope, {
    groupSql: plan.groupSql,
    metric: metric === 'duration' ? 'downtime_total' : 'stop_count',
    dimension: plan.dimension,
    scheduleClass: query.scheduleClass ?? null,
    includeMicroStops: query.includeMicroStops ?? false,
    join: plan.join,
  });
  const groups = await groupViews(manager, scope, plan, cells);
  const stats = await periodStats(manager, scope);
  const data: DowntimeReportView = {
    groupBy,
    metric,
    unit: metric === 'duration' ? 's' : 'count',
    scheduleClass: query.scheduleClass ?? null,
    includeMicroStops: query.includeMicroStops ?? false,
    ...groups,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: ['null key = not coded / not assigned'],
  });
}
