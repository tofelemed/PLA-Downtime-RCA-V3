/**
 * Owner decision 2026-10-19 (QA audit P-0): a production period that no approved plan covers is shown as
 * "No approved plan covers this period" and is left out of work lists and month-close prerequisites until
 * it is planned. A period is plan-covered when its slices were resolved against a plan version, or when an
 * approved plan of the accounting baseline (the plans the slice resolver reads) overlaps it — e.g. a plan
 * approved after the period was materialized, before the next recalculation.
 *
 * `alias` names a row with `tenant_id`, `unit_id`, `utc_start`, `utc_end` (a production period or a shift
 * instance); `selected` the plan-version column, when the row has one. Uses IDX_plan_periods_tenant_unit_start.
 */
export function planCoveredSql(alias: string, selected = true): string {
  const approvedPlanOverlaps = `EXISTS (SELECT 1 FROM "plan_periods" pp
      JOIN "plan_versions" pv ON pv."id" = pp."plan_version_id" AND pv."approval_state" = 'approved'
      JOIN "plan_scenarios" ps ON ps."id" = pv."scenario_id" AND ps."is_accounting_baseline"
     WHERE pp."tenant_id" = ${alias}."tenant_id" AND pp."unit_id" = ${alias}."unit_id"
       AND pp."utc_start" < ${alias}."utc_end" AND pp."utc_end" > ${alias}."utc_start")`;
  if (!selected) return approvedPlanOverlaps;
  return `(${alias}."selected_plan_version_id" IS NOT NULL OR ${approvedPlanOverlaps})`;
}
