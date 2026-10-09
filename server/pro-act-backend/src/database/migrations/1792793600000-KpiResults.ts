import { MigrationInterface, QueryRunner } from 'typeorm';

/** Table, enums, indexes and foreign key of plan 2.7 (generated from the entity, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `CREATE TYPE "public"."kpi_metric" AS ENUM('availability', 'performance', 'quality', 'oee', 'reconciled_availability', 'reconciled_performance', 'reconciled_quality', 'reconciled_oee', 'downtime_total', 'downtime_planned', 'downtime_unplanned', 'microstop_time', 'unknown_time', 'stop_count', 'carry_in_count', 'mean_stop_duration', 'scheduled_availability', 'onstream_factor', 'mtbf', 'mttr', 'mean_downtime_to_restore', 'coverage')`,
  `CREATE TYPE "public"."kpi_quality" AS ENUM('ok', 'provisional', 'unavailable', 'exception')`,
  `CREATE TABLE "kpi_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "run_id" uuid NOT NULL, "period_id" uuid NOT NULL, "scope" jsonb NOT NULL, "metric" "public"."kpi_metric" NOT NULL, "policy_id" uuid, "numerator" numeric(24,8), "denominator" numeric(24,8), "value" numeric(24,10), "unit" character varying(8) NOT NULL, "quality" "public"."kpi_quality" NOT NULL, "reason" text, "cohort" jsonb, "as_of" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_57be4620ae2c0aa403040be0c4e" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_81c34e1b45d790b71baf7b6ee5" ON "kpi_results" ("tenant_id") `,
  `CREATE INDEX "IDX_kpi_results_run" ON "kpi_results" ("run_id") `,
  `CREATE INDEX "IDX_kpi_results_tenant_run_metric" ON "kpi_results" ("tenant_id", "run_id", "metric") `,
  `ALTER TABLE "kpi_results" ADD CONSTRAINT "FK_kpi_results_run" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "kpi_results" DROP CONSTRAINT "FK_kpi_results_run"`,
  `DROP INDEX "public"."IDX_kpi_results_tenant_run_metric"`,
  `DROP INDEX "public"."IDX_kpi_results_run"`,
  `DROP INDEX "public"."IDX_81c34e1b45d790b71baf7b6ee5"`,
  `DROP TABLE "kpi_results"`,
  `DROP TYPE "public"."kpi_quality"`,
  `DROP TYPE "public"."kpi_metric"`,
];

/** An unplanned stop with a failure code (failure_mode set) — the D13 default next to FailureWO events. */
const CODED_UNPLANNED_STOP = `e."physical_type" = 'downtime' AND e."schedule_class" = 'unplanned' AND NULLIF(btrim(e."failure_mode"), '') IS NOT NULL`;

/**
 * D13 functional-failure candidates, one row per occurrence with its full extent: occurrences with a
 * `FailureWO` event or an unplanned stop carrying a failure code. Active repair start / end are not
 * provided by any source yet (null), so MTTR stays "mean downtime to restore" (KPI08). The KPI engine
 * applies the micro-stop rule and de-duplicates work orders overlapping a coded stop of the same asset.
 */
const FAILURE_VIEW =
  `CREATE VIEW "failure_events_v" AS SELECT e."tenant_id", e."unit_id", e."occurrence_id", ` +
  `(array_agg(e."asset_id" ORDER BY e."start_time", e."id") FILTER (WHERE e."asset_id" IS NOT NULL))[1] AS "asset_id", ` +
  `min(e."start_time") AS "start_time", ` +
  `CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "restored_at", ` +
  `NULL::timestamptz AS "repair_start", NULL::timestamptz AS "repair_end", ` +
  `CASE WHEN bool_or(${CODED_UNPLANNED_STOP}) THEN 'unplanned_stop_with_failure_code' ELSE 'failure_work_order' END AS "source", ` +
  `min(NULLIF(btrim(e."failure_mode"), '')) AS "failure_mode", min(e."work_order_id") AS "work_order_id" ` +
  `FROM "production_events" e ` +
  `WHERE e."physical_state" IN ('open', 'closed') AND (e."event_type" = 'FailureWO' OR e."physical_type" = 'downtime') ` +
  `GROUP BY e."tenant_id", e."unit_id", e."occurrence_id" ` +
  `HAVING bool_or(e."event_type" = 'FailureWO') OR bool_or(${CODED_UNPLANNED_STOP})`;

const periodKpi = (alias: string, metric: string) =>
  `LEFT JOIN "kpi_results" ${alias} ON ${alias}."run_id" = cur."current_run_id" AND ${alias}."metric" = '${metric}' ` +
  `AND ${alias}."scope"->>'level' = 'period'`;

/**
 * Plan 2.7 step 4: v1 read compatibility for `oee_summaries` (§14.3) until 3.6 rebinds the reports: one
 * row per period with a shown run (approved revision, else the open one) carrying the stored period
 * KPIs as the legacy percentages and the legacy minute columns (S, R, D). Null where the KPI is null.
 */
const OEE_SUMMARIES_VIEW =
  `CREATE VIEW "oee_summaries_v" AS SELECT p."id", p."id" AS "period_id", p."tenant_id", p."unit_id", pv."plan_id", ` +
  `(p."local_date"::text || COALESCE(' ' || p."shift_name", '')) AS "period", p."utc_start", p."utc_end", ` +
  `cur."current_run_id" AS "calculation_run_id", cur."lifecycle"::text AS "revision_lifecycle", ` +
  `round(a."value" * 100, 2) AS "availability", round(pf."value" * 100, 2) AS "performance", ` +
  `round(q."value" * 100, 2) AS "quality", round(o."value" * 100, 2) AS "oee", ` +
  `round(a."denominator" / 60, 2) AS "planned_production_time", round(a."numerator" / 60, 2) AS "actual_production_time", ` +
  `round((a."denominator" - a."numerator") / 60, 2) AS "downtime", NULL::uuid AS "organization_id", ` +
  `r."created_at", r."created_at" AS "updated_at" ` +
  `FROM "production_periods" p ` +
  `JOIN LATERAL (SELECT ar."current_run_id", ar."lifecycle" FROM "accounting_revisions" ar ` +
  `WHERE ar."period_id" = p."id" AND ar."current_run_id" IS NOT NULL AND ar."lifecycle" IN ('approved', 'draft', 'in_review') ` +
  `ORDER BY (ar."lifecycle" = 'approved') DESC, ar."revision" DESC LIMIT 1) cur ON true ` +
  `JOIN "calculation_runs" r ON r."id" = cur."current_run_id" ` +
  `LEFT JOIN "plan_versions" pv ON pv."id" = p."selected_plan_version_id" ` +
  `${periodKpi('a', 'availability')} ${periodKpi('pf', 'performance')} ${periodKpi('q', 'quality')} ${periodKpi('o', 'oee')}`;

/**
 * Plan 2.7 (KPI01–KPI08, §14.2): `kpi_results` per calculation run (immutable, like the run's lines),
 * the D13 failure-eligibility view and the v1 `oee_summaries_v` compatibility view. `down()` drops all.
 */
export class KpiResults1792793600000 implements MigrationInterface {
  name = 'KpiResults1792793600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    await queryRunner.query(
      `CREATE TRIGGER "trg_kpi_results_immutable" BEFORE UPDATE OR DELETE ON "kpi_results" ` +
        `FOR EACH ROW EXECUTE FUNCTION "accounting_lines_immutable"()`,
    );
    await queryRunner.query(FAILURE_VIEW);
    await queryRunner.query(OEE_SUMMARIES_VIEW);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "oee_summaries_v"`);
    await queryRunner.query(`DROP VIEW "failure_events_v"`);
    await queryRunner.query(
      `DROP TRIGGER "trg_kpi_results_immutable" ON "kpi_results"`,
    );
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}
