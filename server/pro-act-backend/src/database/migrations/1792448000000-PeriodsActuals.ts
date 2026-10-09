import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables, indexes and foreign keys of plan 2.4 (generated from the entities, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `CREATE TYPE "public"."accounting_policy_kind" AS ENUM('coverage_gate', 'source_authority')`,
  `CREATE TABLE "accounting_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "policy_kind" "public"."accounting_policy_kind" NOT NULL, "unit_id" uuid, "scope_key" character varying(64) NOT NULL, "version" integer NOT NULL, "body" jsonb NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "notes" text, CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version"), CONSTRAINT "CHK_accounting_policies_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "PK_6ac566af742d7022c0edebce82b" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_fa20797ebbcfcbceb893c111c2" ON "accounting_policies" ("tenant_id") `,
  `CREATE INDEX "IDX_accounting_policies_unit" ON "accounting_policies" ("unit_id") `,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from") `,
  `CREATE TYPE "public"."production_period_readiness" AS ENUM('open', 'complete_inputs', 'reconciled')`,
  `CREATE TABLE "production_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "unit_id" uuid NOT NULL, "shift_instance_id" uuid, "calendar_version_id" uuid, "utc_start" TIMESTAMP WITH TIME ZONE NOT NULL, "utc_end" TIMESTAMP WITH TIME ZONE NOT NULL, "local_date" date NOT NULL, "shift_name" character varying(64), "is_excluded" boolean NOT NULL DEFAULT false, "exclusion_kind" character varying(32), "selected_plan_version_id" uuid, "state_readiness" "public"."production_period_readiness" NOT NULL DEFAULT 'open', "current_actuals_run_id" uuid, "slices_resolved_at" TIMESTAMP WITH TIME ZONE, "warnings" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_production_periods_unit_start" UNIQUE ("tenant_id", "unit_id", "utc_start"), CONSTRAINT "CHK_production_periods_interval" CHECK ("utc_end" > "utc_start"), CONSTRAINT "EX_production_periods_unit_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, tstzrange("utc_start", "utc_end", '[)') WITH &&), CONSTRAINT "PK_6e8349bf58f04fb63b10edb241c" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_05f711ad4a10b54074f8ec67ab" ON "production_periods" ("tenant_id") `,
  `CREATE INDEX "IDX_production_periods_current_run" ON "production_periods" ("current_actuals_run_id") `,
  `CREATE INDEX "IDX_production_periods_plan_version" ON "production_periods" ("selected_plan_version_id") `,
  `CREATE INDEX "IDX_production_periods_shift_instance" ON "production_periods" ("shift_instance_id") `,
  `CREATE INDEX "IDX_production_periods_unit" ON "production_periods" ("unit_id") `,
  `CREATE INDEX "IDX_production_periods_tenant_start" ON "production_periods" ("tenant_id", "utc_start") `,
  `CREATE INDEX "IDX_production_periods_tenant_date" ON "production_periods" ("tenant_id", "local_date") `,
  `CREATE TYPE "public"."period_product_slice_source" AS ENUM('plan', 'profile_default')`,
  `CREATE TABLE "period_product_slices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "period_id" uuid NOT NULL, "product_id" uuid NOT NULL, "profile_id" uuid, "plan_period_id" uuid, "source" "public"."period_product_slice_source" NOT NULL, "window_from" TIMESTAMP WITH TIME ZONE NOT NULL, "window_to" TIMESTAMP WITH TIME ZONE NOT NULL, "campaign_from" TIMESTAMP WITH TIME ZONE, "campaign_to" TIMESTAMP WITH TIME ZONE, "quantity_uom" character varying(50), "actuals_policy_id" uuid, "superseded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_period_product_slices_window" CHECK ("window_to" > "window_from"), CONSTRAINT "PK_ec179c384cf037c481d384deb1e" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_97cc60709443b4eebe4c1c08c9" ON "period_product_slices" ("tenant_id") `,
  `CREATE INDEX "IDX_period_product_slices_policy" ON "period_product_slices" ("actuals_policy_id") `,
  `CREATE INDEX "IDX_period_product_slices_plan_period" ON "period_product_slices" ("plan_period_id") `,
  `CREATE INDEX "IDX_period_product_slices_profile" ON "period_product_slices" ("profile_id") `,
  `CREATE INDEX "IDX_period_product_slices_product" ON "period_product_slices" ("product_id") `,
  `CREATE INDEX "IDX_period_product_slices_period" ON "period_product_slices" ("period_id") `,
  `CREATE UNIQUE INDEX "UQ_period_product_slices_active" ON "period_product_slices" ("period_id", "product_id", "window_from") WHERE "superseded_at" IS NULL`,
  `CREATE TYPE "public"."external_production_report_state" AS ENUM('current', 'superseded')`,
  `CREATE TABLE "external_production_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "connection_id" uuid, "external_report_id" character varying(128) NOT NULL, "external_revision" character varying(64) NOT NULL, "site_id" uuid NOT NULL, "local_production_date" date NOT NULL, "timezone" character varying(64) NOT NULL, "utc_start" TIMESTAMP WITH TIME ZONE NOT NULL, "utc_end" TIMESTAMP WITH TIME ZONE NOT NULL, "lines" jsonb NOT NULL, "basis" character varying(8) NOT NULL, "source_status" character varying(64) NOT NULL, "certified_eligible" boolean NOT NULL, "approved_at_source" TIMESTAMP WITH TIME ZONE, "evidence_ref" text, "state" "public"."external_production_report_state" NOT NULL DEFAULT 'current', "superseded_by_id" uuid, "imported_at" TIMESTAMP WITH TIME ZONE NOT NULL, "imported_by" uuid, CONSTRAINT "UQ_external_production_reports_revision" UNIQUE ("tenant_id", "external_report_id", "external_revision"), CONSTRAINT "CHK_external_production_reports_window" CHECK ("utc_end" > "utc_start"), CONSTRAINT "PK_a55512bb35a39d793893aa82c87" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_3bb69dab6cb26d5d09cdb139fd" ON "external_production_reports" ("tenant_id") `,
  `CREATE INDEX "IDX_external_production_reports_site" ON "external_production_reports" ("site_id") `,
  `CREATE INDEX "IDX_external_production_reports_window" ON "external_production_reports" ("tenant_id", "utc_start") `,
  `CREATE INDEX "IDX_external_production_reports_site_date" ON "external_production_reports" ("tenant_id", "site_id", "local_production_date") `,
  `CREATE TABLE "actuals_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "period_id" uuid NOT NULL, "trigger" character varying(64) NOT NULL, "input_hash" character varying(64) NOT NULL, "engine_version" character varying(32) NOT NULL, "policy_versions" jsonb NOT NULL, "requested_by" uuid, "supersedes_run_id" uuid, "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7fce742d837e1d0d36274047ed6" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_50500b02ccd3ed71fe7e19f647" ON "actuals_runs" ("tenant_id") `,
  `CREATE INDEX "IDX_actuals_runs_period_created" ON "actuals_runs" ("period_id", "created_at") `,
  `CREATE TYPE "public"."actuals_job_kind" AS ENUM('recompute', 'report_import')`,
  `CREATE TYPE "public"."actuals_job_state" AS ENUM('queued', 'running', 'completed', 'failed')`,
  `CREATE TABLE "actuals_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "kind" "public"."actuals_job_kind" NOT NULL, "state" "public"."actuals_job_state" NOT NULL DEFAULT 'queued', "period_id" uuid, "request" jsonb NOT NULL, "result" jsonb, "error_code" character varying(64), "error_message" text, "requested_by" uuid, "lease_owner" text, "lease_expiry" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_eec93f324fbb623b426a69a988d" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_de078f09095a67c33e78af101e" ON "actuals_jobs" ("tenant_id") `,
  `CREATE UNIQUE INDEX "UQ_actuals_jobs_queued_period" ON "actuals_jobs" ("period_id") WHERE "state" = 'queued' AND "kind" = 'recompute'`,
  `CREATE INDEX "IDX_actuals_jobs_period" ON "actuals_jobs" ("period_id") `,
  `CREATE INDEX "IDX_actuals_jobs_state_created" ON "actuals_jobs" ("state", "created_at") `,
  `CREATE TYPE "public"."actuals_adjustment_kind" AS ENUM('gross', 'good', 'reject', 'rework')`,
  `CREATE TYPE "public"."actuals_adjustment_basis" AS ENUM('measured', 'estimated')`,
  `CREATE TYPE "public"."actuals_adjustment_state" AS ENUM('proposed', 'approved', 'rejected')`,
  `CREATE TABLE "actuals_adjustments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "slice_id" uuid NOT NULL, "period_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "kind" "public"."actuals_adjustment_kind" NOT NULL, "quantity" numeric(24,8) NOT NULL, "uom" character varying(50), "basis" "public"."actuals_adjustment_basis" NOT NULL, "reason" text NOT NULL, "evidence_ref" text NOT NULL, "window_from" TIMESTAMP WITH TIME ZONE, "window_to" TIMESTAMP WITH TIME ZONE, "author_id" uuid NOT NULL, "state" "public"."actuals_adjustment_state" NOT NULL DEFAULT 'proposed', "decided_by" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, "decision_reason" text, CONSTRAINT "CHK_actuals_adjustments_window" CHECK (("window_from" IS NULL) = ("window_to" IS NULL) AND ("window_from" IS NULL OR "window_to" > "window_from")), CONSTRAINT "CHK_actuals_adjustments_independent" CHECK ("decided_by" IS NULL OR "decided_by" <> "author_id"), CONSTRAINT "PK_ce4e440829ca0243d436d872576" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_ea8fb7b5b790b42ec6c161651c" ON "actuals_adjustments" ("tenant_id") `,
  `CREATE INDEX "IDX_actuals_adjustments_tenant_unit" ON "actuals_adjustments" ("tenant_id", "unit_id") `,
  `CREATE INDEX "IDX_actuals_adjustments_tenant_period" ON "actuals_adjustments" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_actuals_adjustments_slice" ON "actuals_adjustments" ("slice_id") `,
  `CREATE TYPE "public"."actuals_result_method" AS ENUM('output_events', 'counter_delta', 'rate_integration', 'manual', 'external_report', 'mixed')`,
  `CREATE TYPE "public"."actuals_result_quality" AS ENUM('complete', 'partial', 'missing', 'conflict')`,
  `CREATE TABLE "actuals_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "actuals_run_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "gross" numeric(24,8), "good" numeric(24,8), "reject" numeric(24,8), "rework_accepted" numeric(24,8), "uom" character varying(50), "basis" character varying(8) NOT NULL, "method" "public"."actuals_result_method", "coverage_ratio" numeric(9,8), "measured_qty" numeric(24,8), "estimated_qty" numeric(24,8), "quality_state" "public"."actuals_result_quality" NOT NULL, "source_segments" jsonb NOT NULL, "exceptions" jsonb NOT NULL, "coverage" jsonb NOT NULL, "adjustment_ids" jsonb NOT NULL, "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9df2bde0b097a5cc5402f6e7189" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_3d40d7f2c1d6382bdd09b1afa9" ON "actuals_results" ("tenant_id") `,
  `CREATE INDEX "IDX_actuals_results_tenant_period" ON "actuals_results" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_actuals_results_slice" ON "actuals_results" ("slice_id") `,
  `CREATE INDEX "IDX_actuals_results_run" ON "actuals_results" ("actuals_run_id") `,
  `ALTER TABLE "production_periods" ADD CONSTRAINT "FK_production_periods_unit" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "production_periods" ADD CONSTRAINT "FK_production_periods_shift_instance" FOREIGN KEY ("shift_instance_id") REFERENCES "shift_instances"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "production_periods" ADD CONSTRAINT "FK_production_periods_plan_version" FOREIGN KEY ("selected_plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_product_slices" ADD CONSTRAINT "FK_period_product_slices_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_product_slices" ADD CONSTRAINT "FK_period_product_slices_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_product_slices" ADD CONSTRAINT "FK_period_product_slices_profile" FOREIGN KEY ("profile_id") REFERENCES "production_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_product_slices" ADD CONSTRAINT "FK_period_product_slices_plan_period" FOREIGN KEY ("plan_period_id") REFERENCES "plan_periods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "period_product_slices" ADD CONSTRAINT "FK_period_product_slices_policy" FOREIGN KEY ("actuals_policy_id") REFERENCES "accounting_policies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "external_production_reports" ADD CONSTRAINT "FK_external_production_reports_site" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "actuals_runs" ADD CONSTRAINT "FK_actuals_runs_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "actuals_jobs" ADD CONSTRAINT "FK_actuals_jobs_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "actuals_adjustments" ADD CONSTRAINT "FK_actuals_adjustments_slice" FOREIGN KEY ("slice_id") REFERENCES "period_product_slices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "actuals_results" ADD CONSTRAINT "FK_actuals_results_run" FOREIGN KEY ("actuals_run_id") REFERENCES "actuals_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "actuals_results" ADD CONSTRAINT "FK_actuals_results_slice" FOREIGN KEY ("slice_id") REFERENCES "period_product_slices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "actuals_results" DROP CONSTRAINT "FK_actuals_results_slice"`,
  `ALTER TABLE "actuals_results" DROP CONSTRAINT "FK_actuals_results_run"`,
  `ALTER TABLE "actuals_adjustments" DROP CONSTRAINT "FK_actuals_adjustments_slice"`,
  `ALTER TABLE "actuals_jobs" DROP CONSTRAINT "FK_actuals_jobs_period"`,
  `ALTER TABLE "actuals_runs" DROP CONSTRAINT "FK_actuals_runs_period"`,
  `ALTER TABLE "external_production_reports" DROP CONSTRAINT "FK_external_production_reports_site"`,
  `ALTER TABLE "period_product_slices" DROP CONSTRAINT "FK_period_product_slices_policy"`,
  `ALTER TABLE "period_product_slices" DROP CONSTRAINT "FK_period_product_slices_plan_period"`,
  `ALTER TABLE "period_product_slices" DROP CONSTRAINT "FK_period_product_slices_profile"`,
  `ALTER TABLE "period_product_slices" DROP CONSTRAINT "FK_period_product_slices_product"`,
  `ALTER TABLE "period_product_slices" DROP CONSTRAINT "FK_period_product_slices_period"`,
  `ALTER TABLE "production_periods" DROP CONSTRAINT "FK_production_periods_plan_version"`,
  `ALTER TABLE "production_periods" DROP CONSTRAINT "FK_production_periods_shift_instance"`,
  `ALTER TABLE "production_periods" DROP CONSTRAINT "FK_production_periods_unit"`,
  `DROP INDEX "public"."IDX_actuals_results_run"`,
  `DROP INDEX "public"."IDX_actuals_results_slice"`,
  `DROP INDEX "public"."IDX_actuals_results_tenant_period"`,
  `DROP INDEX "public"."IDX_3d40d7f2c1d6382bdd09b1afa9"`,
  `DROP TABLE "actuals_results"`,
  `DROP TYPE "public"."actuals_result_quality"`,
  `DROP TYPE "public"."actuals_result_method"`,
  `DROP INDEX "public"."IDX_actuals_adjustments_slice"`,
  `DROP INDEX "public"."IDX_actuals_adjustments_tenant_period"`,
  `DROP INDEX "public"."IDX_actuals_adjustments_tenant_unit"`,
  `DROP INDEX "public"."IDX_ea8fb7b5b790b42ec6c161651c"`,
  `DROP TABLE "actuals_adjustments"`,
  `DROP TYPE "public"."actuals_adjustment_state"`,
  `DROP TYPE "public"."actuals_adjustment_basis"`,
  `DROP TYPE "public"."actuals_adjustment_kind"`,
  `DROP INDEX "public"."IDX_actuals_jobs_state_created"`,
  `DROP INDEX "public"."IDX_actuals_jobs_period"`,
  `DROP INDEX "public"."UQ_actuals_jobs_queued_period"`,
  `DROP INDEX "public"."IDX_de078f09095a67c33e78af101e"`,
  `DROP TABLE "actuals_jobs"`,
  `DROP TYPE "public"."actuals_job_state"`,
  `DROP TYPE "public"."actuals_job_kind"`,
  `DROP INDEX "public"."IDX_actuals_runs_period_created"`,
  `DROP INDEX "public"."IDX_50500b02ccd3ed71fe7e19f647"`,
  `DROP TABLE "actuals_runs"`,
  `DROP INDEX "public"."IDX_external_production_reports_site_date"`,
  `DROP INDEX "public"."IDX_external_production_reports_window"`,
  `DROP INDEX "public"."IDX_external_production_reports_site"`,
  `DROP INDEX "public"."IDX_3bb69dab6cb26d5d09cdb139fd"`,
  `DROP TABLE "external_production_reports"`,
  `DROP TYPE "public"."external_production_report_state"`,
  `DROP INDEX "public"."UQ_period_product_slices_active"`,
  `DROP INDEX "public"."IDX_period_product_slices_period"`,
  `DROP INDEX "public"."IDX_period_product_slices_product"`,
  `DROP INDEX "public"."IDX_period_product_slices_profile"`,
  `DROP INDEX "public"."IDX_period_product_slices_plan_period"`,
  `DROP INDEX "public"."IDX_period_product_slices_policy"`,
  `DROP INDEX "public"."IDX_97cc60709443b4eebe4c1c08c9"`,
  `DROP TABLE "period_product_slices"`,
  `DROP TYPE "public"."period_product_slice_source"`,
  `DROP INDEX "public"."IDX_production_periods_tenant_date"`,
  `DROP INDEX "public"."IDX_production_periods_tenant_start"`,
  `DROP INDEX "public"."IDX_production_periods_unit"`,
  `DROP INDEX "public"."IDX_production_periods_shift_instance"`,
  `DROP INDEX "public"."IDX_production_periods_plan_version"`,
  `DROP INDEX "public"."IDX_production_periods_current_run"`,
  `DROP INDEX "public"."IDX_05f711ad4a10b54074f8ec67ab"`,
  `DROP TABLE "production_periods"`,
  `DROP TYPE "public"."production_period_readiness"`,
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `DROP INDEX "public"."IDX_accounting_policies_unit"`,
  `DROP INDEX "public"."IDX_fa20797ebbcfcbceb893c111c2"`,
  `DROP TABLE "accounting_policies"`,
  `DROP TYPE "public"."accounting_policy_kind"`,
];

/** D05 defaults recorded 2026-10-07 (bodies of contracts/policies/defaults/*.default.json). */
const COVERAGE_GATE_DEFAULT = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

const SOURCE_AUTHORITY_DEFAULT = {
  measurement: 'output',
  productId: null,
  primarySource: 'pi_output_ef',
  fallback: {
    conditions: ['primary_stale', 'primary_bad_quality', 'primary_missing'],
    source: 'pi_counter',
  },
  cadenceSeconds: 60,
  conflictTolerance: 0,
  overrideRole: 'integration_admin',
};

const SEED_NOTE =
  'Seeded by migration PeriodsActuals from the D05 default (DECISIONS.md, 2026-10-07); change by a new version.';

const FUNCTIONS = [
  `CREATE FUNCTION "actuals_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
    `BEGIN RAISE EXCEPTION '% rows are immutable (a recalculation writes a new actuals run)', TG_TABLE_NAME; END $fn$`,
];

const TRIGGERS = [
  `CREATE TRIGGER "trg_actuals_results_immutable" BEFORE UPDATE OR DELETE ON "actuals_results" ` +
    `FOR EACH ROW EXECUTE FUNCTION "actuals_immutable"()`,
  `CREATE TRIGGER "trg_actuals_runs_immutable" BEFORE UPDATE OR DELETE ON "actuals_runs" ` +
    `FOR EACH ROW EXECUTE FUNCTION "actuals_immutable"()`,
];

/**
 * Read compatibility for the v1 Plan Dashboard (plan 2.4 step 6): one row per active period slice with
 * the v1 names `plan_id`, `period`, `actual` (good of the current actuals run) and `short_range_plan`
 * (target of the accounting-baseline plan period). v1 screens rebind to it in Phase 3.
 */
const COMPAT_VIEW =
  `CREATE VIEW "production_losses_v" AS SELECT s."id" AS "slice_id", p."id" AS "period_id", p."tenant_id", ` +
  `p."unit_id", s."product_id", pv."plan_id", p."local_date", p."shift_name", ` +
  `(p."local_date"::text || COALESCE(' ' || p."shift_name", '')) AS "period", p."utc_start", p."utc_end", ` +
  `r."good" AS "actual", r."gross" AS "actual_gross", r."uom" AS "actual_uom", r."quality_state" AS "actual_quality", ` +
  `r."coverage_ratio", pp."target" AS "short_range_plan", pp."quantity_uom" AS "plan_uom", ` +
  `p."current_actuals_run_id" AS "actuals_run_id" ` +
  `FROM "production_periods" p ` +
  `JOIN "period_product_slices" s ON s."period_id" = p."id" AND s."superseded_at" IS NULL ` +
  `LEFT JOIN "plan_periods" pp ON pp."id" = s."plan_period_id" ` +
  `LEFT JOIN "plan_versions" pv ON pv."id" = pp."plan_version_id" ` +
  `LEFT JOIN "actuals_results" r ON r."actuals_run_id" = p."current_actuals_run_id" AND r."slice_id" = s."id"`;

/**
 * Plan 2.4 (ACT01–ACT08, §3.1, §14.2): production periods (one per unit and calendar leaf), product
 * slices, immutable actuals runs and results, governed actuals adjustments, external daily-production
 * reports, the leased actuals jobs, versioned accounting policies (`coverage_gate`, `source_authority`;
 * the D05 defaults are seeded tenant-wide for every existing tenant) and the `production_losses_v`
 * compatibility view. `down()` drops everything it created.
 */
export class PeriodsActuals1792448000000 implements MigrationInterface {
  name = 'PeriodsActuals1792448000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    for (const statement of FUNCTIONS) await queryRunner.query(statement);
    for (const statement of TRIGGERS) await queryRunner.query(statement);
    await queryRunner.query(COMPAT_VIEW);
    await seedPolicies(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "production_losses_v"`);
    await queryRunner.query(
      `DROP TRIGGER "trg_actuals_runs_immutable" ON "actuals_runs"`,
    );
    await queryRunner.query(
      `DROP TRIGGER "trg_actuals_results_immutable" ON "actuals_results"`,
    );
    await queryRunner.query(`DROP FUNCTION "actuals_immutable"()`);
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}

async function seedPolicies(queryRunner: QueryRunner): Promise<void> {
  const defaults: Array<[string, object]> = [
    ['coverage_gate', COVERAGE_GATE_DEFAULT],
    ['source_authority', SOURCE_AUTHORITY_DEFAULT],
  ];
  for (const [kind, body] of defaults) {
    await queryRunner.query(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "approved_at", "notes")
       SELECT t."id", 1, $1::accounting_policy_kind, NULL, 'tenant', 1, $2::jsonb, '1970-01-01T00:00:00Z', now(), $3
         FROM "tenants" t`,
      [kind, JSON.stringify(body), SEED_NOTE],
    );
  }
}
