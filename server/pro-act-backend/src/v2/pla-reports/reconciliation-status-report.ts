import { EntityManager, In, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { loadPeriodStates } from '../period-overview/period-states';
import {
  GridWorkflowState,
  ResidualState,
} from '../period-overview/period-summary.view';
import { ReportScope } from '../reports/report-scope';
import {
  AGE_BUCKETS,
  OVERDUE_LIST_LIMIT,
  overdueView,
  OverduePeriodView,
  residualStateOf,
  StatusSummaryRow,
} from './reconciliation-status';
import { foldScopeStates } from './scope-periods';

const HOUR_S = 3600;

/** Age bucket of `age_s` (seconds since the period ended), the same edges as `AGE_BUCKETS`. */
const AGE_KEY_SQL = `CASE WHEN c."age_s" < 0 THEN 'not_ended'${AGE_BUCKETS.filter(
  (b) => b.maxHours !== null && Number.isFinite(b.maxHours),
)
  .map(
    (b) => ` WHEN c."age_s" < ${Number(b.maxHours) * HOUR_S} THEN '${b.key}'`,
  )
  .join('')} ELSE '${AGE_BUCKETS[AGE_BUCKETS.length - 1].key}' END`;

/**
 * Each period of the scope (start in [from, to), tenant, units) with its current revision — the latest not
 * cancelled one, like `loadPeriodStates(…, 'current')` — as a grid workflow state, the run it shows and its
 * age at `asOf`. $1 tenant, $2 units, $3 from, $4 to, $5 asOf, $6 overdue after (seconds). Uses
 * UQ_production_periods_unit_start and UQ_accounting_revisions_period_revision.
 */
const CURRENT = `WITH c AS (
  SELECT p."id", p."utc_start",
         CASE WHEN r."lifecycle" IS NULL THEN 'none'
              WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
              ELSE r."lifecycle"::text END AS "workflow",
         r."current_run_id" AS "run_id",
         floor(extract(epoch FROM ($5::timestamptz - p."utc_end")))::bigint AS "age_s"
    FROM "production_periods" p
    LEFT JOIN LATERAL (SELECT ar."lifecycle", ar."is_stale", ar."current_run_id" FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."tenant_id" = $1 AND ar."lifecycle" <> 'cancelled'
                        ORDER BY ar."revision" DESC LIMIT 1) r ON true
   WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_start" >= $3 AND p."utc_start" < $4)`;

const OVERDUE = `c."workflow" <> 'approved' AND c."age_s" >= $6`;

export interface StatusReportInput {
  context: RequestContext;
  scope: ReportScope;
  asOf: Date;
  overdueAfterHours: number;
}

const paramsOf = (input: StatusReportInput) => [
  input.scope.tenantId,
  input.scope.unitIds,
  input.scope.from,
  input.scope.to,
  input.asOf,
  input.overdueAfterHours * HOUR_S,
];

/** Periods per workflow state, age bucket and overdue flag in one GROUP BY (no period cap). */
export async function statusSummary(
  manager: EntityManager,
  input: StatusReportInput,
): Promise<StatusSummaryRow[]> {
  if (input.scope.unitIds.length === 0) return [];
  const rows: Array<{
    workflow: GridWorkflowState;
    age_key: string;
    overdue: boolean;
    periods: number;
    run_ids: string[] | null;
  }> = await manager.query(
    `${CURRENT}
     SELECT c."workflow", ${AGE_KEY_SQL} AS "age_key", (${OVERDUE}) AS "overdue", count(*)::int AS "periods",
            array_agg(DISTINCT c."run_id") FILTER (WHERE c."run_id" IS NOT NULL) AS "run_ids"
       FROM c GROUP BY 1, 2, 3`,
    paramsOf(input),
  );
  return rows.map((r) => ({
    workflow: r.workflow,
    ageKey: r.age_key,
    overdue: r.overdue,
    periods: r.periods,
    runIds: r.run_ids ?? [],
  }));
}

/** Ids of the oldest overdue periods (oldest end first, then start and id), at most `OVERDUE_LIST_LIMIT`. */
async function overdueIds(
  manager: EntityManager,
  input: StatusReportInput,
): Promise<string[]> {
  if (input.scope.unitIds.length === 0) return [];
  const rows: Array<{ id: string }> = await manager.query(
    `${CURRENT}
     SELECT c."id" FROM c WHERE ${OVERDUE}
      ORDER BY c."age_s" DESC, c."utc_start" ASC, c."id" ASC LIMIT ${OVERDUE_LIST_LIMIT}`,
    paramsOf(input),
  );
  return rows.map((r) => r.id);
}

async function idMap(
  manager: EntityManager,
  sql: string,
  tenantId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows: Array<{ id: string; value: string }> = await manager.query(sql, [
    tenantId,
    [...new Set(ids)],
  ]);
  return new Map(rows.map((r) => [r.id, r.value]));
}

/** The oldest overdue periods with unit name, plan deep link and residual state of their current revision. */
export async function overduePeriods(
  periods: Repository<ProductionPeriod>,
  input: StatusReportInput,
  policies: AccountingPoliciesService,
): Promise<OverduePeriodView[]> {
  const ids = await overdueIds(periods.manager, input);
  if (ids.length === 0) return [];
  const found = await periods.find({
    where: { id: In(ids), tenantId: input.scope.tenantId },
  });
  const byId = new Map(found.map((p) => [p.id, p]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  const manager = periods.manager;
  const [states, unitNames, plans] = await Promise.all([
    loadPeriodStates(manager, ordered, 'current', policies),
    idMap(
      manager,
      `SELECT "id"::text AS "id", "name" AS "value" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      input.scope.tenantId,
      ordered.map((p) => p.unitId),
    ),
    idMap(
      manager,
      `SELECT "id"::text AS "id", "plan_id"::text AS "value" FROM "plan_versions" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      input.scope.tenantId,
      ordered.flatMap((p) =>
        p.selectedPlanVersionId ? [p.selectedPlanVersionId] : [],
      ),
    ),
  ]);
  return states.map((state) =>
    overdueView(state, { asOf: input.asOf, unitNames, plans }),
  );
}

/**
 * Residual state counts of the current revisions: the plan 2.8 arithmetic over saved decisions is domain
 * code, so it runs over keyset pages of the scope (`foldScopeStates`), keeping only the counts.
 */
export async function residualCounts(
  periods: Repository<ProductionPeriod>,
  input: StatusReportInput,
  policies: AccountingPoliciesService,
): Promise<Map<ResidualState, number>> {
  const counts = new Map<ResidualState, number>();
  await foldScopeStates(
    periods,
    {
      context: input.context,
      scope: input.scope,
      selector: 'current',
      policies,
    },
    (states) => {
      for (const state of states) {
        const key = residualStateOf(state);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    },
  );
  return counts;
}
