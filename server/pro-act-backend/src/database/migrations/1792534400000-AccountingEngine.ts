import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables, indexes and foreign keys of plan 2.5 (generated from the entities, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `CREATE TYPE "public"."accounting_revision_lifecycle" AS ENUM('draft', 'in_review', 'approved', 'cancelled')`,
  `CREATE TABLE "accounting_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "period_id" uuid NOT NULL, "revision" integer NOT NULL, "lifecycle" "public"."accounting_revision_lifecycle" NOT NULL DEFAULT 'draft', "supersedes_id" uuid, "input_hash" character varying(64), "current_run_id" uuid, CONSTRAINT "UQ_accounting_revisions_period_revision" UNIQUE ("period_id", "revision"), CONSTRAINT "PK_511d0c4a2824bba3c86457db603" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_d98aa8becfb1ce17fc43efd626" ON "accounting_revisions" ("tenant_id") `,
  `CREATE INDEX "IDX_accounting_revisions_supersedes" ON "accounting_revisions" ("supersedes_id") `,
  `CREATE INDEX "IDX_accounting_revisions_current_run" ON "accounting_revisions" ("current_run_id") `,
  `CREATE UNIQUE INDEX "UQ_accounting_revisions_period_draft" ON "accounting_revisions" ("period_id") WHERE "lifecycle" = 'draft'`,
  `CREATE UNIQUE INDEX "UQ_accounting_revisions_period_approved" ON "accounting_revisions" ("period_id") WHERE "lifecycle" = 'approved'`,
  `CREATE TYPE "public"."calculation_run_status" AS ENUM('queued', 'running', 'validated', 'failed', 'superseded')`,
  `CREATE TABLE "calculation_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "period_id" uuid NOT NULL, "revision_id" uuid NOT NULL, "actuals_run_id" uuid, "trigger" character varying(64) NOT NULL, "engine_version" character varying(32) NOT NULL, "policy_versions" jsonb NOT NULL, "input_fingerprint" jsonb NOT NULL, "input_hash" character varying(64) NOT NULL, "status" "public"."calculation_run_status" NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, "error" jsonb, "stats" jsonb NOT NULL DEFAULT '{}', "requested_by" uuid, "supersedes_run_id" uuid, CONSTRAINT "PK_a0d6310fa195c78851778ee88f0" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_f669097b81e8a638570ec72b21" ON "calculation_runs" ("tenant_id") `,
  `CREATE INDEX "IDX_calculation_runs_actuals_run" ON "calculation_runs" ("actuals_run_id") `,
  `CREATE INDEX "IDX_calculation_runs_revision" ON "calculation_runs" ("revision_id") `,
  `CREATE INDEX "IDX_calculation_runs_period_created" ON "calculation_runs" ("period_id", "created_at") `,
  `CREATE TYPE "public"."loss_ledger" AS ENUM('capacity', 'plan')`,
  `CREATE TABLE "period_ledger_totals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "run_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "ledger" "public"."loss_ledger" NOT NULL, "uom" character varying(50), "capacity_qty" numeric(24,8), "exclusion_qty" numeric(24,8), "availability_qty" numeric(24,8), "performance_qty" numeric(24,8), "quality_qty" numeric(24,8), "good_qty" numeric(24,8), "gain_qty" numeric(24,8), "attributed_qty" numeric(24,8), "residual_qty" numeric(24,8), "target_qty" numeric(24,8), "actual_qty" numeric(24,8), "gap_qty" numeric(24,8), "overproduction_qty" numeric(24,8), "over_accounted_qty" numeric(24,8), "flags" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_period_ledger_totals_run_slice_ledger" UNIQUE ("run_id", "slice_id", "ledger"), CONSTRAINT "PK_c9eae16a0b6304c86b90b6fd593" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_2586003072fff40a76c7e86cf0" ON "period_ledger_totals" ("tenant_id") `,
  `CREATE INDEX "IDX_period_ledger_totals_tenant_period" ON "period_ledger_totals" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_period_ledger_totals_slice" ON "period_ledger_totals" ("slice_id") `,
  `CREATE TYPE "public"."loss_line_kind" AS ENUM('schedule_exclusion', 'availability', 'performance', 'quality', 'residual', 'gain', 'tolerance_adjustment', 'unaccounted_classified', 'bridge')`,
  `CREATE TYPE "public"."loss_line_basis" AS ENUM('sustained_rate', 'planning_rate', 'measured', 'declared')`,
  `CREATE TYPE "public"."loss_line_source" AS ENUM('auto', 'manual', 'candidate_superseded')`,
  `CREATE TYPE "public"."loss_line_state" AS ENUM('active', 'superseded', 'rejected')`,
  `CREATE TABLE "loss_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "run_id" uuid NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "segment_start" TIMESTAMP WITH TIME ZONE NOT NULL, "segment_end" TIMESTAMP WITH TIME ZONE NOT NULL, "ledger" "public"."loss_ledger" NOT NULL, "kind" "public"."loss_line_kind" NOT NULL, "quantity" numeric(24,8) NOT NULL, "uom" character varying(50), "basis" "public"."loss_line_basis" NOT NULL, "rate_version_id" uuid, "reason_code_id" uuid, "impact_code_id" uuid, "oee_component" character varying(16), "schedule_class" character varying(16), "failure_codes" jsonb, "loss_category_def_id" uuid, "source" "public"."loss_line_source" NOT NULL, "auto_key" text, "state" "public"."loss_line_state" NOT NULL, "comment" text, "author_id" uuid, "valuation" jsonb, "cause_event_id" uuid, "occurrence_id" uuid, "flags" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_d6f9933b9fccb13ce8e23c4e356" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_523090df97f616fa678cbcadc8" ON "loss_lines" ("tenant_id") `,
  `CREATE INDEX "IDX_loss_lines_tenant_period" ON "loss_lines" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_loss_lines_tenant_cause_event" ON "loss_lines" ("tenant_id", "cause_event_id") `,
  `CREATE INDEX "IDX_loss_lines_rate_version" ON "loss_lines" ("rate_version_id") `,
  `CREATE INDEX "IDX_loss_lines_slice" ON "loss_lines" ("slice_id") `,
  `CREATE INDEX "IDX_loss_lines_revision" ON "loss_lines" ("revision_id") `,
  `CREATE UNIQUE INDEX "UQ_loss_lines_run_auto_key" ON "loss_lines" ("run_id", "auto_key") WHERE "auto_key" IS NOT NULL`,
  `CREATE TABLE "loss_line_evidence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "loss_line_id" uuid NOT NULL, "event_id" uuid, "event_revision_id" uuid, "observation_id" uuid, "occurrence_id" uuid, "share" numeric(9,8) NOT NULL, "clipped_start" TIMESTAMP WITH TIME ZONE NOT NULL, "clipped_end" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ec2c2871f87af39a4795f07ea5f" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_3dc34a6be3139c0194d9cdf107" ON "loss_line_evidence" ("tenant_id") `,
  `CREATE INDEX "IDX_loss_line_evidence_event_revision" ON "loss_line_evidence" ("event_revision_id") `,
  `CREATE INDEX "IDX_loss_line_evidence_tenant_event" ON "loss_line_evidence" ("tenant_id", "event_id") `,
  `CREATE INDEX "IDX_loss_line_evidence_line" ON "loss_line_evidence" ("loss_line_id") `,
  `ALTER TABLE "accounting_revisions" ADD CONSTRAINT "FK_accounting_revisions_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "calculation_runs" ADD CONSTRAINT "FK_calculation_runs_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "calculation_runs" ADD CONSTRAINT "FK_calculation_runs_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "calculation_runs" ADD CONSTRAINT "FK_calculation_runs_actuals_run" FOREIGN KEY ("actuals_run_id") REFERENCES "actuals_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_ledger_totals" ADD CONSTRAINT "FK_period_ledger_totals_run" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_ledger_totals" ADD CONSTRAINT "FK_period_ledger_totals_slice" FOREIGN KEY ("slice_id") REFERENCES "period_product_slices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_lines" ADD CONSTRAINT "FK_loss_lines_run" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_lines" ADD CONSTRAINT "FK_loss_lines_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_lines" ADD CONSTRAINT "FK_loss_lines_slice" FOREIGN KEY ("slice_id") REFERENCES "period_product_slices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_lines" ADD CONSTRAINT "FK_loss_lines_rate_version" FOREIGN KEY ("rate_version_id") REFERENCES "unit_product_rates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_line_evidence" ADD CONSTRAINT "FK_loss_line_evidence_line" FOREIGN KEY ("loss_line_id") REFERENCES "loss_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "loss_line_evidence" DROP CONSTRAINT "FK_loss_line_evidence_line"`,
  `ALTER TABLE "loss_lines" DROP CONSTRAINT "FK_loss_lines_rate_version"`,
  `ALTER TABLE "loss_lines" DROP CONSTRAINT "FK_loss_lines_slice"`,
  `ALTER TABLE "loss_lines" DROP CONSTRAINT "FK_loss_lines_revision"`,
  `ALTER TABLE "loss_lines" DROP CONSTRAINT "FK_loss_lines_run"`,
  `ALTER TABLE "period_ledger_totals" DROP CONSTRAINT "FK_period_ledger_totals_slice"`,
  `ALTER TABLE "period_ledger_totals" DROP CONSTRAINT "FK_period_ledger_totals_run"`,
  `ALTER TABLE "calculation_runs" DROP CONSTRAINT "FK_calculation_runs_actuals_run"`,
  `ALTER TABLE "calculation_runs" DROP CONSTRAINT "FK_calculation_runs_revision"`,
  `ALTER TABLE "calculation_runs" DROP CONSTRAINT "FK_calculation_runs_period"`,
  `ALTER TABLE "accounting_revisions" DROP CONSTRAINT "FK_accounting_revisions_period"`,
  `DROP INDEX "public"."IDX_loss_line_evidence_line"`,
  `DROP INDEX "public"."IDX_loss_line_evidence_tenant_event"`,
  `DROP INDEX "public"."IDX_loss_line_evidence_event_revision"`,
  `DROP INDEX "public"."IDX_3dc34a6be3139c0194d9cdf107"`,
  `DROP TABLE "loss_line_evidence"`,
  `DROP INDEX "public"."UQ_loss_lines_run_auto_key"`,
  `DROP INDEX "public"."IDX_loss_lines_revision"`,
  `DROP INDEX "public"."IDX_loss_lines_slice"`,
  `DROP INDEX "public"."IDX_loss_lines_rate_version"`,
  `DROP INDEX "public"."IDX_loss_lines_tenant_cause_event"`,
  `DROP INDEX "public"."IDX_loss_lines_tenant_period"`,
  `DROP INDEX "public"."IDX_523090df97f616fa678cbcadc8"`,
  `DROP TABLE "loss_lines"`,
  `DROP TYPE "public"."loss_line_state"`,
  `DROP TYPE "public"."loss_line_source"`,
  `DROP TYPE "public"."loss_line_basis"`,
  `DROP TYPE "public"."loss_line_kind"`,
  `DROP INDEX "public"."IDX_period_ledger_totals_slice"`,
  `DROP INDEX "public"."IDX_period_ledger_totals_tenant_period"`,
  `DROP INDEX "public"."IDX_2586003072fff40a76c7e86cf0"`,
  `DROP TABLE "period_ledger_totals"`,
  `DROP TYPE "public"."loss_ledger"`,
  `DROP INDEX "public"."IDX_calculation_runs_period_created"`,
  `DROP INDEX "public"."IDX_calculation_runs_revision"`,
  `DROP INDEX "public"."IDX_calculation_runs_actuals_run"`,
  `DROP INDEX "public"."IDX_f669097b81e8a638570ec72b21"`,
  `DROP TABLE "calculation_runs"`,
  `DROP TYPE "public"."calculation_run_status"`,
  `DROP INDEX "public"."UQ_accounting_revisions_period_approved"`,
  `DROP INDEX "public"."UQ_accounting_revisions_period_draft"`,
  `DROP INDEX "public"."IDX_accounting_revisions_current_run"`,
  `DROP INDEX "public"."IDX_accounting_revisions_supersedes"`,
  `DROP INDEX "public"."IDX_d98aa8becfb1ce17fc43efd626"`,
  `DROP TABLE "accounting_revisions"`,
  `DROP TYPE "public"."accounting_revision_lifecycle"`,
];

/** `accounting_policy_kind` gains `oee_policy` and `reconciliation_tolerance` (type recreated). */
const POLICY_KIND_UP: readonly string[] = [
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `ALTER TYPE "public"."accounting_policy_kind" RENAME TO "accounting_policy_kind_old"`,
  `CREATE TYPE "public"."accounting_policy_kind" AS ENUM('coverage_gate', 'source_authority', 'oee_policy', 'reconciliation_tolerance')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind" USING "policy_kind"::"text"::"public"."accounting_policy_kind"`,
  `DROP TYPE "public"."accounting_policy_kind_old"`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from") `,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
];

const POLICY_KIND_DOWN: readonly string[] = [
  `DELETE FROM "accounting_policies" WHERE "policy_kind" IN ('oee_policy', 'reconciliation_tolerance')`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `CREATE TYPE "public"."accounting_policy_kind_old" AS ENUM('coverage_gate', 'source_authority')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind_old" USING "policy_kind"::"text"::"public"."accounting_policy_kind_old"`,
  `DROP TYPE "public"."accounting_policy_kind"`,
  `ALTER TYPE "public"."accounting_policy_kind_old" RENAME TO "accounting_policy_kind"`,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from") `,
];

const IMMUTABLE_TABLES = [
  'loss_lines',
  'loss_line_evidence',
  'period_ledger_totals',
];

const FUNCTION_UP =
  `CREATE FUNCTION "accounting_lines_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
  `BEGIN RAISE EXCEPTION '% rows are immutable (a recalculation writes a new calculation run)', TG_TABLE_NAME; END $fn$`;

/** D04 / D06 defaults recorded 2026-10-07 (bodies of contracts/policies/defaults/*.default.json). */
const OEE_POLICY_DEFAULT = {
  plannedStopsInsideScheduleReduceAvailability: true,
  derateComponent: 'performance',
  microStopSeconds: 60,
  idealTimeWeighting: true,
  maxUnknownShare: 0,
  reconciledOeeTileEnabled: true,
  streamCombinationRule: 'per_product_and_combined_when_compatible',
  defaultLedgerView: 'plan',
};

const RECONCILIATION_TOLERANCE_DEFAULT = {
  mode: 'zero',
  value: 0,
  epsilon: 0.000001,
  allowUnaccountedClassification: false,
};

const SEED_NOTE =
  'Seeded by migration AccountingEngine from the D04 / D06 defaults (DECISIONS.md, 2026-10-07); change by a new version.';

/** The 2.4 definition of `production_losses_v`, restored by `down()`. */
const COMPAT_VIEW_24 =
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

/** The run a v1 reader should show: the approved revision's, else the draft's. */
const SHOWN_RUN =
  `LEFT JOIN LATERAL (SELECT ar."current_run_id" FROM "accounting_revisions" ar ` +
  `WHERE ar."period_id" = p."id" AND ar."lifecycle" IN ('approved', 'draft') AND ar."current_run_id" IS NOT NULL ` +
  `ORDER BY (ar."lifecycle" = 'approved') DESC, ar."revision" DESC LIMIT 1) cur ON true`;

/**
 * Plan 2.5 step 6: `production_losses_v` keeps every 2.4 column and adds the plan-ledger totals of the
 * shown run with the v1 names `losses` (attributed) and `unaccounted_loss` (signed residual); `action`
 * stays null until explanations exist (2.8). `loss_categories_v` lists the active plan lines.
 */
const COMPAT_VIEW_25 =
  COMPAT_VIEW_24.replace(
    `p."current_actuals_run_id" AS "actuals_run_id" `,
    `p."current_actuals_run_id" AS "actuals_run_id", cur."current_run_id" AS "calculation_run_id", ` +
      `t."attributed_qty" AS "losses", t."residual_qty" AS "unaccounted_loss", t."gap_qty" AS "gap", ` +
      `t."overproduction_qty" AS "overproduction", t."flags" AS "plan_flags", NULL::text AS "action" `,
  ) +
  ` ${SHOWN_RUN} LEFT JOIN "period_ledger_totals" t ON t."run_id" = cur."current_run_id" AND t."slice_id" = s."id" AND t."ledger" = 'plan'`;

const CATEGORIES_VIEW =
  `CREATE VIEW "loss_categories_v" AS SELECT l."id" AS "loss_line_id", l."tenant_id", p."unit_id", l."period_id", ` +
  `l."slice_id", s."product_id", l."run_id", l."kind"::text AS "category", l."reason_code_id", l."impact_code_id", ` +
  `l."oee_component", l."schedule_class", l."quantity", l."uom", l."basis", l."source", l."cause_event_id", ` +
  `l."segment_start", l."segment_end" ` +
  `FROM "production_periods" p ${SHOWN_RUN} ` +
  `JOIN "loss_lines" l ON l."run_id" = cur."current_run_id" ` +
  `JOIN "period_product_slices" s ON s."id" = l."slice_id" ` +
  `WHERE l."ledger" = 'plan' AND l."state" = 'active' AND l."kind" <> 'residual'`;

/**
 * Plan 2.5 (ACC01–ACC08, FND03, §14.2): accounting revisions, immutable calculation runs, loss lines with
 * evidence and per-run ledger totals; the `oee_policy` and `reconciliation_tolerance` policy kinds with the
 * D04 / D06 defaults seeded per tenant; the v1 compatibility views. `down()` drops everything it created
 * and restores the 2.4 view.
 */
export class AccountingEngine1792534400000 implements MigrationInterface {
  name = 'AccountingEngine1792534400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    for (const statement of POLICY_KIND_UP) await queryRunner.query(statement);
    await queryRunner.query(FUNCTION_UP);
    for (const table of IMMUTABLE_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER "trg_${table}_immutable" BEFORE UPDATE OR DELETE ON "${table}" ` +
          `FOR EACH ROW EXECUTE FUNCTION "accounting_lines_immutable"()`,
      );
    }
    await queryRunner.query(`DROP VIEW "production_losses_v"`);
    await queryRunner.query(COMPAT_VIEW_25);
    await queryRunner.query(CATEGORIES_VIEW);
    await seedPolicies(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "loss_categories_v"`);
    await queryRunner.query(`DROP VIEW "production_losses_v"`);
    await queryRunner.query(COMPAT_VIEW_24);
    for (const table of IMMUTABLE_TABLES) {
      await queryRunner.query(
        `DROP TRIGGER "trg_${table}_immutable" ON "${table}"`,
      );
    }
    await queryRunner.query(`DROP FUNCTION "accounting_lines_immutable"()`);
    for (const statement of POLICY_KIND_DOWN)
      await queryRunner.query(statement);
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}

async function seedPolicies(queryRunner: QueryRunner): Promise<void> {
  const defaults: Array<[string, object]> = [
    ['oee_policy', OEE_POLICY_DEFAULT],
    ['reconciliation_tolerance', RECONCILIATION_TOLERANCE_DEFAULT],
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
