import { EntityManager, In, Repository } from 'typeorm';
import { ReconciliationSlaService } from '../../close/reconciliation-sla.service';
import { slaPeriodsCte, SqlParams } from '../../close/sla-sql';
import { PolicyInForce } from '../../close/workflow-policies.service';
import { RequestContext } from '../../common/context/request-context';
import { ReconciliationSlaPolicy } from '../../domain/close/sla-policy';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { toPeriodSlaView } from '../close/period-sla.view';
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

/** Age bucket of `period_age_s` (seconds since the period ended), the same edges as `AGE_BUCKETS`. */
const AGE_KEY_SQL = `CASE WHEN s."period_age_s" < 0 THEN 'not_ended'${AGE_BUCKETS.filter(
  (b) => b.maxHours !== null && Number.isFinite(b.maxHours),
)
  .map(
    (b) =>
      ` WHEN s."period_age_s" < ${Number(b.maxHours) * HOUR_S} THEN '${b.key}'`,
  )
  .join('')} ELSE '${AGE_BUCKETS[AGE_BUCKETS.length - 1].key}' END`;

export interface StatusReportInput {
  context: RequestContext;
  scope: ReportScope;
  asOf: Date;
  /** SME R3: overdue, escalation and waits follow the `reconciliation_sla` policy in force at `asOf` */
  sla: PolicyInForce<ReconciliationSlaPolicy>;
}

/** Periods of the scope (start in [from, to), tenant, units) with their current revision and SLA columns. */
function scopeCte(input: StatusReportInput, params: SqlParams): string {
  const tenant = params.add(input.scope.tenantId);
  const units = params.add(input.scope.unitIds);
  const from = params.add(input.scope.from);
  const to = params.add(input.scope.to);
  return slaPeriodsCte(params, {
    where: `p."tenant_id" = ${tenant} AND p."unit_id" = ANY(${units}::uuid[]) AND p."utc_start" >= ${from} AND p."utc_start" < ${to}`,
    asOf: input.asOf,
    policy: input.sla.policy,
  });
}

interface SummarySqlRow {
  workflow: GridWorkflowState;
  age_key: string;
  overdue: boolean;
  escalation_level: number;
  on_hold: boolean;
  rejection_escalated: boolean;
  periods: number;
  run_ids: string[] | null;
}

/** Periods per workflow state, age bucket, overdue flag, escalation level and waits in one GROUP BY. */
export async function statusSummary(
  manager: EntityManager,
  input: StatusReportInput,
): Promise<StatusSummaryRow[]> {
  if (input.scope.unitIds.length === 0) return [];
  const params = new SqlParams();
  const cte = scopeCte(input, params);
  const asOf = params.add(input.asOf);
  const rows: SummarySqlRow[] = await manager.query(
    `${cte}
     SELECT s."workflow", ${AGE_KEY_SQL} AS "age_key", s."overdue", s."escalation_level", s."on_hold",
            s."rejection_escalated", count(*)::int AS "periods",
            array_agg(DISTINCT s."run_id") FILTER (WHERE s."run_id" IS NOT NULL) AS "run_ids"
       FROM (SELECT x.*, floor(extract(epoch FROM (${asOf}::timestamptz - x."utc_end")))::bigint AS "period_age_s"
               FROM s x) s
      GROUP BY 1, 2, 3, 4, 5, 6`,
    params.values,
  );
  return rows.map((r) => ({
    workflow: r.workflow,
    ageKey: r.age_key,
    overdue: r.overdue,
    escalationLevel: r.escalation_level,
    onHold: r.on_hold,
    rejectionEscalated: r.rejection_escalated,
    periods: r.periods,
    runIds: r.run_ids ?? [],
  }));
}

/** Ids of the most overdue periods (earliest due first, then start and id), at most `OVERDUE_LIST_LIMIT`. */
async function overdueIds(
  manager: EntityManager,
  input: StatusReportInput,
): Promise<string[]> {
  if (input.scope.unitIds.length === 0) return [];
  const params = new SqlParams();
  const cte = scopeCte(input, params);
  const rows: Array<{ id: string }> = await manager.query(
    `${cte}
     SELECT s."id" FROM s WHERE s."overdue"
      ORDER BY s."due" ASC, s."utc_start" ASC, s."id" ASC LIMIT ${OVERDUE_LIST_LIMIT}`,
    params.values,
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

/** The most overdue periods with unit name, plan deep link, residual state and SLA of their current revision. */
export async function overduePeriods(
  periods: Repository<ProductionPeriod>,
  input: StatusReportInput,
  deps: { policies: AccountingPoliciesService; slas: ReconciliationSlaService },
): Promise<OverduePeriodView[]> {
  const ids = await overdueIds(periods.manager, input);
  if (ids.length === 0) return [];
  const found = await periods.find({
    where: { id: In(ids), tenantId: input.scope.tenantId },
  });
  const byId = new Map(found.map((p) => [p.id, p]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  const manager = periods.manager;
  const [states, unitNames, plans, slas] = await Promise.all([
    loadPeriodStates(manager, ordered, 'current', deps.policies),
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
    deps.slas.statuses(manager, ordered, input.asOf),
  ]);
  return states.map((state) => {
    const sla = slas.get(state.period.id);
    return overdueView(state, {
      asOf: input.asOf,
      unitNames,
      plans,
      sla: sla ? toPeriodSlaView(sla) : null,
    });
  });
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
      // residual states come from the reconciliation alone
      actuals: false,
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
