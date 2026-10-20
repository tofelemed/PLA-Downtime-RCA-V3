import { SqlParams } from '../../close/sla-sql';
import { ExceptionType, ExceptionWorkflow } from './exceptions-v2.dto';

/** One stored-state problem of a period, before the period columns are joined. */
export interface ExceptionRow {
  period_id: string;
  type: ExceptionType;
  /** slices, stops, suggestions or 1 */
  n: number;
  /** residual: the largest |residual| of the flagged slices (decimal text) */
  amount: string | null;
  uom: string | null;
  /** stale reason / substitute source label */
  detail: string | null;
  /** duplicate merge: the first suggestion and its kept event */
  ref_id: string | null;
  ref_event_id: string | null;
  unit_id: string;
  unit_name: string | null;
  plan_id: string | null;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  utc_end: Date;
  workflow: ExceptionWorkflow;
  revision: number | null;
}

export interface ExceptionsFilter {
  tenantId: string;
  /** null = every unit of the tenant (tenant-wide caller, no unit named) */
  unitIds: string[] | null;
  fromDate: string;
  toDate: string;
  types: readonly ExceptionType[];
  workflows: readonly ExceptionWorkflow[];
  after: { utcStart: string; periodId: string; type: ExceptionType } | null;
  limit: number;
}

/**
 * Periods of the window (tenant, units, operational dates) with their latest revision that is not cancelled
 * and its workflow state, as `slaPeriodsCte`; keyset start pushed down (IDX_production_periods_tenant_date,
 * UQ_accounting_revisions_period_revision).
 */
function openPeriodsCte(params: SqlParams, filter: ExceptionsFilter): string {
  const tenant = params.add(filter.tenantId);
  const units = params.add(filter.unitIds);
  const after = filter.after
    ? `AND (p."utc_start", p."id") >= (${params.add(filter.after.utcStart)}::timestamptz, ${params.add(filter.after.periodId)}::uuid)`
    : '';
  return `WITH base AS (
  SELECT p."id" AS "period_id", p."tenant_id", p."unit_id", p."local_date", p."shift_name", p."utc_start", p."utc_end",
         p."selected_plan_version_id", r."revision", r."current_run_id" AS "run_id", r."stale_reason",
         CASE WHEN r."lifecycle" IS NULL THEN 'none'
              WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
              ELSE r."lifecycle"::text END AS "workflow"
    FROM "production_periods" p
    LEFT JOIN LATERAL (SELECT ar."revision", ar."lifecycle", ar."is_stale", ar."stale_reason", ar."current_run_id"
                         FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                        ORDER BY ar."revision" DESC LIMIT 1) r ON true
   WHERE p."tenant_id" = ${tenant}
     AND (${units}::uuid[] IS NULL OR p."unit_id" = ANY(${units}::uuid[]))
     AND p."local_date" >= ${params.add(filter.fromDate)}::date AND p."local_date" < ${params.add(filter.toDate)}::date
     ${after}
), open_periods AS (SELECT * FROM base WHERE "workflow" = ANY(${params.add(filter.workflows)}::text[]))`;
}

const NO_EXTRA = `NULL::text AS "amount", NULL::text AS "uom", NULL::text AS "detail", NULL::uuid AS "ref_id", NULL::uuid AS "ref_event_id"`;

/** Flags of the latest run's slice totals (plan ledger; claims from the capacity ledger, LA-02b). */
const RUN_FLAG: Readonly<Record<string, { ledger: string; flags: string[] }>> =
  {
    residual_beyond_tolerance: {
      ledger: 'plan',
      flags: ['unaccounted', 'over_accounted'],
    },
    claim_exceeds_component: {
      ledger: 'capacity',
      flags: ['claim_exceeds_component'],
    },
    bridge_required: { ledger: 'plan', flags: ['bridge_required'] },
    plan_allocation_required: {
      ledger: 'plan',
      flags: ['plan_allocation_required'],
    },
  };

function runFlagPart(type: ExceptionType, params: SqlParams): string {
  const rule = RUN_FLAG[type];
  return `SELECT o."period_id", '${type}'::text AS "type", count(DISTINCT t."slice_id")::int AS "n",
         max(abs(t."residual_qty"))::text AS "amount", min(t."uom")::text AS "uom", NULL::text AS "detail",
         NULL::uuid AS "ref_id", NULL::uuid AS "ref_event_id"
    FROM open_periods o JOIN "period_ledger_totals" t ON t."run_id" = o."run_id" AND t."tenant_id" = o."tenant_id"
   WHERE t."ledger" = '${rule.ledger}' AND t."flags" ?| ${params.add(rule.flags)}::text[]
   GROUP BY o."period_id"`;
}

/** Each type's statement over `open_periods` (whitelisted SQL, values as parameters). */
const PARTS: Readonly<Record<ExceptionType, (params: SqlParams) => string>> = {
  residual_beyond_tolerance: (p) => runFlagPart('residual_beyond_tolerance', p),
  claim_exceeds_component: (p) => runFlagPart('claim_exceeds_component', p),
  bridge_required: (p) => runFlagPart('bridge_required', p),
  plan_allocation_required: (p) => runFlagPart('plan_allocation_required', p),
  stale_submission:
    () => `SELECT o."period_id", 'stale_submission'::text AS "type", 1 AS "n",
         NULL::text AS "amount", NULL::text AS "uom", o."stale_reason"::text AS "detail", NULL::uuid AS "ref_id", NULL::uuid AS "ref_event_id"
    FROM open_periods o WHERE o."workflow" = 'stale'`,
  // SME E7: the actuals the latest run used came from a substitute source (IDX_actuals_results_run)
  substitute_source:
    () => `SELECT o."period_id", 'substitute_source'::text AS "type", count(*)::int AS "n",
         NULL::text AS "amount", NULL::text AS "uom", min(ar."substitution"->'used'->>'label') AS "detail",
         NULL::uuid AS "ref_id", NULL::uuid AS "ref_event_id"
    FROM open_periods o JOIN "calculation_runs" cr ON cr."id" = o."run_id"
    JOIN "actuals_results" ar ON ar."actuals_run_id" = cr."actuals_run_id"
   WHERE ar."substitution" IS NOT NULL
   GROUP BY o."period_id"`,
  // live stops of the period window without a reason and not marked "investigation pending" (IDX_production_events_unit_span)
  uncoded_stop_time:
    () => `SELECT o."period_id", 'uncoded_stop_time'::text AS "type", u."n", ${NO_EXTRA}
    FROM open_periods o CROSS JOIN LATERAL (
      SELECT count(*)::int AS "n" FROM "production_events" e
       WHERE e."tenant_id" = o."tenant_id" AND e."unit_id" = o."unit_id" AND e."physical_state" IN ('open', 'closed')
         AND e."physical_type" = 'downtime' AND e."impact_mode" NOT IN ('none', 'fractional')
         AND e."reason_code_id" IS NULL AND NOT e."investigation_pending"
         AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange(o."utc_start", o."utc_end", '[)')) u
   WHERE u."n" > 0`,
  // DT-04 suggestions waiting for a person, whose kept stop overlaps the period (IDX_stop_reconciliations_tenant_unit_state)
  duplicate_merge_pending:
    () => `SELECT o."period_id", 'duplicate_merge_pending'::text AS "type", m."n",
         NULL::text AS "amount", NULL::text AS "uom", NULL::text AS "detail", m."ref_id", m."ref_event_id"
    FROM open_periods o CROSS JOIN LATERAL (
      SELECT count(*)::int AS "n",
             (array_agg(sr."id" ORDER BY sr."created_at", sr."id"))[1] AS "ref_id",
             (array_agg(sr."kept_event_id" ORDER BY sr."created_at", sr."id"))[1] AS "ref_event_id"
        FROM "stop_reconciliations" sr JOIN "production_events" k ON k."id" = sr."kept_event_id"
       WHERE sr."tenant_id" = o."tenant_id" AND sr."unit_id" = o."unit_id" AND sr."state" = 'suggested'
         AND tstzrange(k."start_time", k."end_time", '[)') && tstzrange(o."utc_start", o."utc_end", '[)')) m
   WHERE m."n" > 0`,
};

function afterSql(params: SqlParams, filter: ExceptionsFilter): string {
  if (!filter.after) return '';
  const { utcStart, periodId, type } = filter.after;
  return `WHERE (o."utc_start", o."period_id", f."type") > (${params.add(utcStart)}::timestamptz, ${params.add(periodId)}::uuid, ${params.add(type)}::text)`;
}

/**
 * Plan 2.4 exceptions queue: one UNION ALL statement over the open periods of the window — one part per
 * requested type, each reading stored state only — joined back to the period, keyset on (period start,
 * period id, type), `limit + 1` rows.
 */
export function exceptionsQuery(filter: ExceptionsFilter): {
  sql: string;
  values: unknown[];
} {
  const params = new SqlParams();
  const cte = openPeriodsCte(params, filter);
  const parts = filter.types.map((type) => PARTS[type](params));
  const after = afterSql(params, filter);
  const sql = `${cte}, problems AS (${parts.join('\n UNION ALL \n')})
  SELECT f.*, o."unit_id", u."name" AS "unit_name", pv."plan_id"::text AS "plan_id",
         to_char(o."local_date", 'YYYY-MM-DD') AS "local_date", o."shift_name", o."utc_start", o."utc_end",
         o."workflow", o."revision"
    FROM problems f JOIN open_periods o ON o."period_id" = f."period_id"
    LEFT JOIN "units" u ON u."id" = o."unit_id"
    LEFT JOIN "plan_versions" pv ON pv."id" = o."selected_plan_version_id"
   ${after}
   ORDER BY o."utc_start", o."period_id", f."type"
   LIMIT ${params.add(filter.limit + 1)}::int`;
  return { sql, values: params.values };
}
