import { EntityManager } from 'typeorm';
import { Dec, toDec } from '../../domain/actuals/decimal';
import { aggregateKindOf, GroupTerms } from '../../domain/kpi/aggregate';
import { KpiLevel, KpiMetric } from '../../domain/kpi/kpi.types';
import { ReportScope } from './report-scope';

/**
 * Periods of the report (start in [from, to), tenant and units) with the run each one shows: the latest
 * approved revision's run, else (unless approvedOnly) the open revision's run. $1 tenant, $2 units,
 * $3 from, $4 to, $5 approvedOnly.
 */
export const SHOWN = `WITH shown AS (
  SELECT p."id" AS "period_id", p."unit_id", p."local_date", p."shift_name", si."crew_id",
         cur."current_run_id" AS "run_id", cur."lifecycle"::text AS "lifecycle"
    FROM "production_periods" p
    LEFT JOIN "shift_instances" si ON si."id" = p."shift_instance_id"
    LEFT JOIN LATERAL (SELECT ar."current_run_id", ar."lifecycle" FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."current_run_id" IS NOT NULL
                          AND (ar."lifecycle" = 'approved' OR (NOT $5 AND ar."lifecycle" IN ('draft', 'in_review')))
                        ORDER BY (ar."lifecycle" = 'approved') DESC, ar."revision" DESC LIMIT 1) cur ON true
   WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_start" >= $3 AND p."utc_start" < $4)`;

/** Site-local grouping keys (AN03): the period's stored operational date and shift label, never UTC. */
export const TIME_GROUPS: Readonly<Record<string, string>> = {
  period: `s."period_id"::text`,
  shift: `s."local_date"::text || ' ' || COALESCE(s."shift_name", '')`,
  day: `s."local_date"::text`,
  week: `to_char(date_trunc('week', s."local_date"), 'IYYY-"W"IW')`,
  month: `to_char(s."local_date", 'YYYY-MM')`,
  unit: `s."unit_id"::text`,
  crew: `s."crew_id"::text`,
};

export const params = (scope: ReportScope) => [
  scope.tenantId,
  scope.unitIds,
  scope.from,
  scope.to,
  scope.approvedOnly,
];

export interface PeriodStats {
  periods: number;
  withRun: number;
  approved: number;
  runIds: string[];
}

export async function periodStats(
  manager: EntityManager,
  scope: ReportScope,
): Promise<PeriodStats> {
  const [row]: Array<{
    periods: number;
    with_run: number;
    approved: number;
    run_ids: string[] | null;
  }> = await manager.query(
    `${SHOWN} SELECT count(*)::int AS "periods", count(s."run_id")::int AS "with_run",
              count(*) FILTER (WHERE s."lifecycle" = 'approved')::int AS "approved",
              array_agg(DISTINCT s."run_id" ORDER BY s."run_id") FILTER (WHERE s."run_id" IS NOT NULL) AS "run_ids"
         FROM shown s`,
    params(scope),
  );
  return {
    periods: row.periods,
    withRun: row.with_run,
    approved: row.approved,
    runIds: row.run_ids ?? [],
  };
}

/** The `oee_policy` versions the runs applied, as `kind@version`. */
export async function policyVersions(
  manager: EntityManager,
  runIds: readonly string[],
): Promise<string[]> {
  if (runIds.length === 0) return [];
  const rows: Array<{ ref: string }> = await manager.query(
    `SELECT DISTINCT (pv->>'kind') || '@' || (pv->>'version') AS "ref"
       FROM "calculation_runs" r, jsonb_array_elements(r."policy_versions") pv
      WHERE r."id" = ANY($1::uuid[]) AND pv->>'kind' = 'oee_policy' ORDER BY 1`,
    [runIds],
  );
  return rows.map((r) => r.ref);
}

interface TermsRow {
  group_key: string | null;
  metric: KpiMetric;
  rows: number;
  complete: number;
  numerator: string | null;
  denominator: string | null;
  min_value: string | null;
  provisional_rows: number;
  policies: number;
  reasons: string[] | null;
}

export type GroupedTerms = Map<string | null, Map<KpiMetric, GroupTerms>>;

function toTerms(row: TermsRow): GroupTerms {
  return {
    numerator: toDec(row.numerator),
    denominator: toDec(row.denominator),
    minValue: toDec(row.min_value),
    rows: row.rows,
    complete: row.complete,
    provisionalRows: row.provisional_rows,
    policies: row.policies,
    reasons: row.reasons ?? [],
  };
}

/** Terms present: numerator and denominator (amounts: the numerator; coverage: the value). */
const COMPLETE = `(k."numerator" IS NOT NULL AND (k."denominator" IS NOT NULL OR m."metric" = ANY($8::kpi_metric[])))`;

export interface KpiGroupSpec {
  /** SQL group key (a `TIME_GROUPS` entry, or the product of the slice rows) */
  groupSql: string;
  metrics: readonly KpiMetric[];
  level: KpiLevel;
}

/**
 * Σ numerators and Σ denominators of the stored KPI rows per group and metric, in SQL (AN03: never an
 * average of values). A period without a shown run or without the row counts as a missing row.
 */
export async function kpiGroups(
  manager: EntityManager,
  scope: ReportScope,
  spec: KpiGroupSpec,
): Promise<GroupedTerms> {
  const amounts = spec.metrics.filter((m) => aggregateKindOf(m) === 'amount');
  const join = spec.level === 'period' ? 'LEFT JOIN' : 'JOIN';
  const rows: TermsRow[] = await manager.query(
    `${SHOWN}
     SELECT ${spec.groupSql} AS "group_key", m."metric", count(*)::int AS "rows",
            count(*) FILTER (WHERE ${COMPLETE})::int AS "complete",
            (sum(k."numerator") FILTER (WHERE ${COMPLETE}))::text AS "numerator",
            (sum(k."denominator") FILTER (WHERE ${COMPLETE}))::text AS "denominator",
            min(k."value")::text AS "min_value",
            count(*) FILTER (WHERE k."quality" = 'provisional')::int AS "provisional_rows",
            count(DISTINCT k."policy_id")::int AS "policies",
            array_remove(array_agg(DISTINCT k."reason") FILTER (WHERE k."value" IS NULL), NULL) AS "reasons"
       FROM shown s CROSS JOIN unnest($6::kpi_metric[]) AS m("metric")
       ${join} "kpi_results" k ON k."run_id" = s."run_id" AND k."tenant_id" = $1 AND k."metric" = m."metric"
                               AND k."scope"->>'level' = $7
      GROUP BY 1, 2 ORDER BY 1, 2`,
    [...params(scope), spec.metrics, spec.level, amounts],
  );
  const grouped: GroupedTerms = new Map();
  for (const row of rows) {
    const byMetric =
      grouped.get(row.group_key) ?? new Map<KpiMetric, GroupTerms>();
    byMetric.set(row.metric, toTerms(row));
    grouped.set(row.group_key, byMetric);
  }
  return grouped;
}

export interface BreakdownSpec {
  groupSql: string;
  metric: 'downtime_total' | 'stop_count';
  dimension: string;
  scheduleClass: string | null;
  includeMicroStops: boolean;
  /** extra join (reason tree) */
  join?: string;
  /** extra predicate over the joined rows; its parameters are `extraParams` from $10 on */
  where?: string;
  extraParams?: readonly unknown[];
}

/** Σ downtime breakdown cells per group (seconds or occurrences), largest first (Pareto). */
export async function breakdownGroups(
  manager: EntityManager,
  scope: ReportScope,
  spec: BreakdownSpec,
): Promise<Array<{ key: string | null; amount: Dec; periods: number }>> {
  const rows: Array<{
    group_key: string | null;
    amount: string;
    periods: number;
  }> = await manager.query(
    `${SHOWN}
     SELECT ${spec.groupSql} AS "group_key", sum(k."numerator")::text AS "amount",
            count(DISTINCT s."period_id")::int AS "periods"
       FROM shown s
       JOIN "kpi_results" k ON k."run_id" = s."run_id" AND k."tenant_id" = $1 AND k."metric" = $6::kpi_metric
                           AND k."scope"->>'level' = 'breakdown' AND k."scope"->>'dimension' = $7
                           AND ($8::text IS NULL OR k."scope"->>'scheduleClass' = $8)
                           AND ($9 OR k."scope"->>'stopKind' = 'availability')
       ${spec.join ?? ''}
       ${spec.where ? `WHERE ${spec.where}` : ''}
      GROUP BY 1 ORDER BY sum(k."numerator") DESC, 1`,
    [
      ...params(scope),
      spec.metric,
      spec.dimension,
      spec.scheduleClass,
      spec.includeMicroStops,
      ...(spec.extraParams ?? []),
    ],
  );
  return rows.map((r) => ({
    key: r.group_key,
    amount: new Dec(r.amount),
    periods: r.periods,
  }));
}
