import { ReconciliationSlaPolicy } from '../domain/close/sla-policy';

const HOUR_S = 3600;

/** Positional parameters of one query (`$1`, `$2`, …), in the order they were added. */
export class SqlParams {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/**
 * Periods matching `where` (alias `p`) with their current revision (latest not cancelled) and the SLA
 * columns of `slaStatus` in SQL (SME R3 / R6), for counts and keyset lists that cannot page through every
 * period in code: `workflow`, `day_end`, `held_s`, `on_hold`, `rejections`, `submit_due`, `approve_due`,
 * `due` (the current stage's), `age_s`, `overdue`, `escalation_level`, `rejection_escalated`. It mirrors
 * the domain function exactly; `sla-sql.int-spec` checks both agree. Uses
 * UQ_accounting_revisions_period_revision, IDX_production_periods_tenant_date, IDX_approval_actions_revision
 * and IDX_period_data_holds_tenant_period.
 */
export function slaPeriodsCte(
  params: SqlParams,
  input: {
    where: string;
    asOf: Date;
    policy: ReconciliationSlaPolicy;
  },
): string {
  const asOf = `${params.add(input.asOf)}::timestamptz`;
  const policy = input.policy;
  const submit = params.add(policy.submitWithinHours * HOUR_S);
  const extra = params.add(
    (policy.approveWithinHours - policy.submitWithinHours) * HOUR_S,
  );
  const resubmit = params.add(policy.resubmitWithinHours * HOUR_S);
  const thresholds = params.add(
    policy.escalations.map((e) => e.afterHours * HOUR_S),
  );
  const rejectAt = params.add(policy.rejectionEscalationCount);
  const secs = (p: string) => `(${p}::double precision * interval '1 second')`;
  return `WITH base AS (
  SELECT p."id", p."tenant_id", p."unit_id", p."local_date", p."shift_name", p."utc_start", p."utc_end",
         p."selected_plan_version_id", r."id" AS "rev_id", r."revision", r."current_run_id" AS "run_id",
         r."submitted_by",
         CASE WHEN r."lifecycle" IS NULL THEN 'none'
              WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
              ELSE r."lifecycle"::text END AS "workflow",
         d."day_end", coalesce(rj."rejections", 0) AS "rejections", rj."last_rejected_at",
         coalesce(hd."held_s", 0) AS "held_s", coalesce(hd."on_hold", false) AS "on_hold"
    FROM "production_periods" p
    LEFT JOIN LATERAL (SELECT ar."id", ar."revision", ar."lifecycle", ar."is_stale", ar."current_run_id", ar."submitted_by"
                         FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                        ORDER BY ar."revision" DESC LIMIT 1) r ON true
    LEFT JOIN LATERAL (SELECT max(q."utc_end") AS "day_end" FROM "production_periods" q
                        WHERE q."tenant_id" = p."tenant_id" AND q."unit_id" = p."unit_id"
                          AND q."local_date" = p."local_date") d ON true
    LEFT JOIN LATERAL (SELECT count(*)::int AS "rejections", max(a."created_at") AS "last_rejected_at"
                         FROM "approval_actions" a WHERE a."revision_id" = r."id" AND a."action" = 'reject') rj ON true
    LEFT JOIN LATERAL (SELECT sum(greatest(0, extract(epoch FROM least(coalesce(h."ended_at", ${asOf}), ${asOf})
                                                         - greatest(h."started_at", d."day_end")))) AS "held_s",
                              bool_or(h."ended_at" IS NULL) AS "on_hold"
                         FROM "period_data_holds" h
                        WHERE h."tenant_id" = p."tenant_id" AND h."period_id" = p."id") hd ON true
   WHERE ${input.where}
), due AS (
  SELECT base.*,
         greatest(base."day_end" + ${secs(submit)},
                  coalesce(base."last_rejected_at" + ${secs(resubmit)}, base."day_end" + ${secs(submit)}))
           + base."held_s" * interval '1 second' AS "submit_due"
    FROM base
), c AS (
  SELECT due.*, due."submit_due" + ${secs(extra)} AS "approve_due",
         CASE WHEN due."workflow" = 'approved' THEN 0
              ELSE greatest(0, extract(epoch FROM ${asOf} - due."day_end") - due."held_s") END AS "age_s"
    FROM due
), s AS (
  SELECT c.*,
         CASE WHEN c."workflow" IN ('in_review', 'stale') THEN c."approve_due" ELSE c."submit_due" END AS "due",
         (c."workflow" <> 'approved' AND NOT c."on_hold" AND ${asOf} >= c."day_end"
            AND ${asOf} > CASE WHEN c."workflow" IN ('in_review', 'stale') THEN c."approve_due" ELSE c."submit_due" END)
           AS "overdue",
         (SELECT count(*)::int FROM unnest(${thresholds}::double precision[]) t WHERE c."age_s" >= t)
           AS "escalation_level",
         (c."workflow" <> 'approved' AND c."rejections" >= ${rejectAt}::int) AS "rejection_escalated"
    FROM c)`;
}
