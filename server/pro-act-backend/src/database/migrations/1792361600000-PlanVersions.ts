import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const QTY = 'numeric(24,8)';

const ENUMS: Record<string, string> = {
  plan_version_basis: `'time', 'quantity', 'manual'`,
  plan_version_target_source: `'generated', 'entered', 'imported'`,
  plan_version_distribution: `'scheduled_capacity', 'explicit_weights', 'equal'`,
  plan_version_approval_state: `'draft', 'submitted', 'approved', 'superseded'`,
  plan_product_slice_stream: `'sequential', 'independent', 'shared'`,
  plan_generation_job_state: `'queued', 'running', 'completed', 'failed'`,
};

const FK: ReadonlyArray<[table: string, name: string, definition: string]> = [
  [
    'production_plans',
    'FK_production_plans_scenario',
    `("scenario_id") REFERENCES "plan_scenarios"("id") ON DELETE RESTRICT`,
  ],
  [
    'production_plans',
    'FK_production_plans_unit_ref',
    `("unit_ref_id") REFERENCES "units"("id") ON DELETE RESTRICT`,
  ],
  [
    'production_plans',
    'FK_production_plans_product_ref',
    `("product_ref_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_versions',
    'FK_plan_versions_plan',
    `("plan_id") REFERENCES "production_plans"("id") ON DELETE CASCADE`,
  ],
  [
    'plan_versions',
    'FK_plan_versions_scenario',
    `("scenario_id") REFERENCES "plan_scenarios"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_versions',
    'FK_plan_versions_unit',
    `("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_versions',
    'FK_plan_versions_calendar_version',
    `("calendar_version_id") REFERENCES "calendar_versions"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_versions',
    'FK_plan_versions_supersedes',
    `("supersedes_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_product_slices',
    'FK_plan_product_slices_version',
    `("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE`,
  ],
  [
    'plan_product_slices',
    'FK_plan_product_slices_product',
    `("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_product_slices',
    'FK_plan_product_slices_profile',
    `("profile_id") REFERENCES "production_profiles"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_version',
    `("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_slice',
    `("slice_id") REFERENCES "plan_product_slices"("id") ON DELETE CASCADE`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_unit',
    `("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_shift_instance',
    `("shift_instance_id") REFERENCES "shift_instances"("id") ON DELETE SET NULL`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_planning_rate',
    `("planning_rate_version_id") REFERENCES "unit_product_rates"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_periods',
    'FK_plan_periods_sustained_rate',
    `("sustained_rate_version_id") REFERENCES "unit_product_rates"("id") ON DELETE RESTRICT`,
  ],
  [
    'plan_generation_jobs',
    'FK_plan_generation_jobs_version',
    `("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE`,
  ],
];

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  ['IDX_905e4f0b87f62e0dcc791e042c', `"plan_scenarios" ("tenant_id")`],
  [
    'UQ_plan_scenarios_tenant_baseline',
    `"plan_scenarios" ("tenant_id") WHERE "is_accounting_baseline"`,
  ],
  ['IDX_b612b99ef80a15bb16c6695502', `"plan_versions" ("tenant_id")`],
  ['IDX_plan_versions_supersedes', `"plan_versions" ("supersedes_version_id")`],
  [
    'IDX_plan_versions_calendar_version',
    `"plan_versions" ("calendar_version_id")`,
  ],
  ['IDX_plan_versions_unit', `"plan_versions" ("unit_id")`],
  ['IDX_plan_versions_scenario', `"plan_versions" ("scenario_id")`],
  ['IDX_plan_versions_tenant_unit', `"plan_versions" ("tenant_id", "unit_id")`],
  [
    'UQ_plan_versions_plan_approved',
    `"plan_versions" ("plan_id") WHERE "approval_state" = 'approved'`,
  ],
  [
    'UQ_plan_versions_plan_open',
    `"plan_versions" ("plan_id") WHERE "approval_state" IN ('draft', 'submitted')`,
  ],
  ['IDX_bf6a3fb8000706722a8ac1c3cb', `"plan_product_slices" ("tenant_id")`],
  [
    'IDX_plan_product_slices_scenario_unit',
    `"plan_product_slices" ("scenario_id", "unit_id")`,
  ],
  ['IDX_plan_product_slices_profile', `"plan_product_slices" ("profile_id")`],
  ['IDX_plan_product_slices_product', `"plan_product_slices" ("product_id")`],
  ['IDX_a058ce1c198cb5b09920ba68ce', `"plan_periods" ("tenant_id")`],
  [
    'IDX_plan_periods_sustained_rate',
    `"plan_periods" ("sustained_rate_version_id")`,
  ],
  [
    'IDX_plan_periods_planning_rate',
    `"plan_periods" ("planning_rate_version_id")`,
  ],
  ['IDX_plan_periods_shift_instance', `"plan_periods" ("shift_instance_id")`],
  ['IDX_plan_periods_unit', `"plan_periods" ("unit_id")`],
  ['IDX_plan_periods_slice', `"plan_periods" ("slice_id")`],
  [
    'IDX_plan_periods_tenant_unit_start',
    `"plan_periods" ("tenant_id", "unit_id", "utc_start")`,
  ],
  ['IDX_cf77cb884567ad22e66a90f061', `"plan_generation_jobs" ("tenant_id")`],
  [
    'IDX_plan_generation_jobs_version',
    `"plan_generation_jobs" ("plan_version_id")`,
  ],
  [
    'IDX_plan_generation_jobs_state_created',
    `"plan_generation_jobs" ("state", "created_at")`,
  ],
  ['IDX_production_plans_product_ref', `"production_plans" ("product_ref_id")`],
  ['IDX_production_plans_unit_ref', `"production_plans" ("unit_ref_id")`],
  ['IDX_production_plans_scenario', `"production_plans" ("scenario_id")`],
];

const PLAN_COLUMNS = [
  'legacy_id',
  'scenario_id',
  'current_version',
  'unit_ref_id',
  'product_ref_id',
];

const TABLES = [
  `CREATE TABLE "plan_scenarios" (${TENANT_SCOPED_COLUMNS}, "name" character varying(255) NOT NULL, "description" text, ` +
    `"is_accounting_baseline" boolean NOT NULL DEFAULT false, ` +
    `CONSTRAINT "UQ_plan_scenarios_tenant_name" UNIQUE ("tenant_id", "name"), ` +
    `CONSTRAINT "PK_8f5639fc3724a8084bfeb2e5f80" PRIMARY KEY ("id"))`,
  `CREATE TABLE "plan_versions" (${TENANT_SCOPED_COLUMNS}, "plan_id" uuid NOT NULL, "version" integer NOT NULL, ` +
    `"scenario_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "valid_from" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
    `"valid_to" TIMESTAMP WITH TIME ZONE NOT NULL, "basis" "public"."plan_version_basis" NOT NULL, "calendar_version_id" uuid, ` +
    `"header_target" ${QTY}, "target_source" "public"."plan_version_target_source" NOT NULL DEFAULT 'generated', ` +
    `"distribution" "public"."plan_version_distribution" NOT NULL DEFAULT 'scheduled_capacity', ` +
    `"approval_state" "public"."plan_version_approval_state" NOT NULL DEFAULT 'draft', "approved_by" uuid, ` +
    `"approved_at" TIMESTAMP WITH TIME ZONE, "supersedes_version_id" uuid, "change_reason" text, "manual_targets" jsonb, ` +
    `"periods_generated_at" TIMESTAMP WITH TIME ZONE, "generation_warnings" jsonb, "generation_error" jsonb, ` +
    `CONSTRAINT "UQ_plan_versions_plan_version" UNIQUE ("plan_id", "version"), ` +
    `CONSTRAINT "CHK_plan_versions_approved_at" CHECK ("approval_state" NOT IN ('approved', 'superseded') OR "approved_at" IS NOT NULL), ` +
    `CONSTRAINT "CHK_plan_versions_window" CHECK ("valid_to" > "valid_from"), ` +
    `CONSTRAINT "PK_dd2f605d45f2679a86a7c1c5b20" PRIMARY KEY ("id"))`,
  `CREATE TABLE "plan_product_slices" (${TENANT_SCOPED_COLUMNS}, "plan_version_id" uuid NOT NULL, "position" integer NOT NULL, ` +
    `"product_id" uuid NOT NULL, "profile_id" uuid, "campaign_from" TIMESTAMP WITH TIME ZONE, "campaign_to" TIMESTAMP WITH TIME ZONE, ` +
    `"weight" numeric(12,8), "target" ${QTY}, "stream" "public"."plan_product_slice_stream" NOT NULL DEFAULT 'sequential', ` +
    `"scenario_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "active_from" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
    `"active_to" TIMESTAMP WITH TIME ZONE NOT NULL, "is_approved" boolean NOT NULL DEFAULT false, ` +
    `CONSTRAINT "UQ_plan_product_slices_version_position" UNIQUE ("plan_version_id", "position"), ` +
    `CONSTRAINT "CHK_plan_product_slices_campaign" CHECK ("campaign_from" IS NULL OR "campaign_to" IS NULL OR "campaign_to" > "campaign_from"), ` +
    `CONSTRAINT "CHK_plan_product_slices_active" CHECK ("active_to" > "active_from"), ` +
    `CONSTRAINT "EX_plan_product_slices_approved_no_overlap" EXCLUDE USING gist ("scenario_id" WITH =, "unit_id" WITH =, ` +
    `"product_id" WITH =, tstzrange("active_from", "active_to", '[)') WITH &&) WHERE ("is_approved"), ` +
    `CONSTRAINT "PK_caf7dc14b895c594d808ee321df" PRIMARY KEY ("id"))`,
  `CREATE TABLE "plan_periods" (${TENANT_SCOPED_COLUMNS}, "plan_version_id" uuid NOT NULL, "slice_id" uuid NOT NULL, ` +
    `"unit_id" uuid NOT NULL, "shift_instance_id" uuid, "calendar_version_id" uuid, "utc_start" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
    `"utc_end" TIMESTAMP WITH TIME ZONE NOT NULL, "local_date" date NOT NULL, "shift_name" character varying(64) NOT NULL, ` +
    `"scheduled_seconds" integer NOT NULL, "target" ${QTY} NOT NULL, "planning_capacity_qty" ${QTY}, ` +
    `"sustained_capacity_qty" ${QTY}, "quantity_uom" character varying(50), "profile_id" uuid, ` +
    `"planning_rate_version_id" uuid, "sustained_rate_version_id" uuid, "is_excluded" boolean NOT NULL DEFAULT false, ` +
    `"exclusion_kind" character varying(32), ` +
    `CONSTRAINT "UQ_plan_periods_version_slice_start" UNIQUE ("plan_version_id", "slice_id", "utc_start"), ` +
    `CONSTRAINT "CHK_plan_periods_target" CHECK ("target" >= 0), ` +
    `CONSTRAINT "CHK_plan_periods_interval" CHECK ("utc_end" > "utc_start"), ` +
    `CONSTRAINT "PK_9f671e5a7495ba16a4cea196982" PRIMARY KEY ("id"))`,
  `CREATE TABLE "plan_generation_jobs" (${TENANT_SCOPED_COLUMNS}, "plan_id" uuid NOT NULL, "plan_version_id" uuid NOT NULL, ` +
    `"state" "public"."plan_generation_job_state" NOT NULL DEFAULT 'queued', "request" jsonb NOT NULL, "result" jsonb, ` +
    `"error_code" character varying(64), "error_message" text, "requested_by" uuid, "lease_owner" text, ` +
    `"lease_expiry" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "finished_at" TIMESTAMP WITH TIME ZONE, ` +
    `CONSTRAINT "PK_5ffe2878e7b7d4d6af52c8a6273" PRIMARY KEY ("id"))`,
];

/** Approved/superseded plan versions are never deleted; their periods are frozen (only the instance link may drop). */
const FROZEN_FUNCTIONS = [
  `CREATE FUNCTION "plan_periods_frozen"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
    `DECLARE frozen boolean; BEGIN ` +
    `SELECT "approval_state" IN ('approved', 'superseded') INTO frozen FROM "plan_versions" WHERE "id" = OLD."plan_version_id"; ` +
    `IF COALESCE(frozen, false) AND NOT (TG_OP = 'UPDATE' AND ` +
    `(to_jsonb(NEW) - 'shift_instance_id') = (to_jsonb(OLD) - 'shift_instance_id')) THEN ` +
    `RAISE EXCEPTION 'periods of an approved plan version are frozen (create a new plan version)'; END IF; ` +
    `IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $fn$`,
  `CREATE FUNCTION "plan_versions_approved_kept"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
    `BEGIN IF OLD."approval_state" IN ('approved', 'superseded') THEN ` +
    `RAISE EXCEPTION 'approved plan versions are never deleted'; END IF; RETURN OLD; END $fn$`,
];

const TRIGGERS = [
  `CREATE TRIGGER "trg_plan_periods_frozen" BEFORE UPDATE OR DELETE ON "plan_periods" ` +
    `FOR EACH ROW EXECUTE FUNCTION "plan_periods_frozen"()`,
  `CREATE TRIGGER "trg_plan_versions_approved_kept" BEFORE DELETE ON "plan_versions" ` +
    `FOR EACH ROW EXECUTE FUNCTION "plan_versions_approved_kept"()`,
];

/**
 * Plan 2.3 (PLAN02–PLAN05, §14.2): plan scenarios (one accounting baseline per tenant), plan versions,
 * product slices, plan periods and generation jobs; `production_plans` gains `legacy_id`, `scenario_id`,
 * `current_version` and uuid FKs `unit_ref_id` / `product_ref_id` (expand step; the varchar columns stay
 * until 3.10). Backfill: a default baseline scenario per tenant, and for every v1 plan whose unit resolves
 * in the plan's tenant a **draft** version 1 (v1 `target_quantity` → quantity basis distributed by scheduled
 * capacity, none → time basis) with one sequential slice when its product resolves. No periods are
 * generated here (no approved rates exist yet). `down()` drops everything it created.
 */
export class PlanVersions1792361600000 implements MigrationInterface {
  name = 'PlanVersions1792361600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const run = (sql: string) => queryRunner.query(sql);
    for (const [type, values] of Object.entries(ENUMS)) {
      await run(`CREATE TYPE "public"."${type}" AS ENUM(${values})`);
    }
    for (const sql of TABLES) await run(sql);
    await run(
      `ALTER TABLE "production_plans" ADD "legacy_id" uuid, ADD "scenario_id" uuid, ADD "current_version" integer, ` +
        `ADD "unit_ref_id" uuid, ADD "product_ref_id" uuid`,
    );
    for (const [name, definition] of INDEXES) {
      const unique = name.startsWith('UQ_') ? 'UNIQUE ' : '';
      await run(`CREATE ${unique}INDEX "${name}" ON ${definition}`);
    }
    for (const [table, name, definition] of FK) {
      await run(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON UPDATE NO ACTION`,
      );
    }
    for (const sql of [...FROZEN_FUNCTIONS, ...TRIGGERS]) await run(sql);
    await this.backfill(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const run = (sql: string) => queryRunner.query(sql);
    await run(
      `DROP TRIGGER "trg_plan_versions_approved_kept" ON "plan_versions"`,
    );
    await run(`DROP TRIGGER "trg_plan_periods_frozen" ON "plan_periods"`);
    await run(`DROP FUNCTION "plan_versions_approved_kept"()`);
    await run(`DROP FUNCTION "plan_periods_frozen"()`);
    for (const [table, name] of [...FK].reverse()) {
      await run(`ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`);
    }
    for (const [name] of [...INDEXES].reverse()) {
      await run(`DROP INDEX "public"."${name}"`);
    }
    for (const column of [...PLAN_COLUMNS].reverse()) {
      await run(`ALTER TABLE "production_plans" DROP COLUMN "${column}"`);
    }
    for (const table of [
      'plan_generation_jobs',
      'plan_periods',
      'plan_product_slices',
      'plan_versions',
      'plan_scenarios',
    ]) {
      await run(`DROP TABLE "${table}"`);
    }
    for (const type of Object.keys(ENUMS).reverse()) {
      await run(`DROP TYPE "public"."${type}"`);
    }
  }

  /** Plan 2.3 step 1: default scenarios, uuid references, draft version 1 per resolvable legacy plan. */
  private async backfill(queryRunner: QueryRunner): Promise<void> {
    const run = (sql: string) => queryRunner.query(sql);
    await run(`UPDATE "production_plans" SET "legacy_id" = "id"`);
    await run(
      `INSERT INTO "plan_scenarios" ("tenant_id", "name", "description", "is_accounting_baseline", "row_version") ` +
        `SELECT "id", 'Baseline', 'Default accounting baseline (plan 2.3)', true, 1 FROM "tenants"`,
    );
    await run(
      `UPDATE "production_plans" pl SET "unit_ref_id" = u."id" FROM "units" u ` +
        `WHERE u."id"::text = lower(btrim(pl."unit_id")) AND u."tenant_id" IS NOT NULL ` +
        `AND (pl."tenant_id" IS NULL OR lower(btrim(pl."tenant_id")) = u."tenant_id"::text)`,
    );
    await run(
      `UPDATE "production_plans" pl SET "product_ref_id" = p."id" FROM "units" u, "products" p ` +
        `WHERE u."id" = pl."unit_ref_id" AND p."id"::text = lower(btrim(pl."product_id")) ` +
        `AND lower(p."tenant_id") = u."tenant_id"::text`,
    );
    await run(
      `UPDATE "production_plans" pl SET "scenario_id" = s."id" FROM "units" u ` +
        `JOIN "plan_scenarios" s ON s."tenant_id" = u."tenant_id" AND s."is_accounting_baseline" ` +
        `WHERE u."id" = pl."unit_ref_id"`,
    );
    await this.backfillVersions(queryRunner);
  }

  private async backfillVersions(queryRunner: QueryRunner): Promise<void> {
    const run = (sql: string) => queryRunner.query(sql);
    await run(
      `INSERT INTO "plan_versions" ("tenant_id", "plan_id", "version", "scenario_id", "unit_id", "valid_from", "valid_to", ` +
        `"basis", "header_target", "target_source", "distribution", "approval_state", "change_reason", "row_version") ` +
        `SELECT u."tenant_id", pl."id", 1, pl."scenario_id", pl."unit_ref_id", date_trunc('second', pl."start_date"), ` +
        `date_trunc('second', pl."end_date"), ` +
        `(CASE WHEN pl."target_quantity" IS NULL THEN 'time' ELSE 'quantity' END)::"public"."plan_version_basis", ` +
        `CASE WHEN pl."target_quantity" >= 0 THEN pl."target_quantity" END, ` +
        `(CASE WHEN pl."target_quantity" IS NULL THEN 'generated' ELSE 'entered' END)::"public"."plan_version_target_source", ` +
        `'scheduled_capacity', 'draft', 'created from the v1 plan header (plan 2.3 migration)', 1 ` +
        `FROM "production_plans" pl JOIN "units" u ON u."id" = pl."unit_ref_id" ` +
        `WHERE pl."scenario_id" IS NOT NULL AND date_trunc('second', pl."end_date") > date_trunc('second', pl."start_date")`,
    );
    await run(
      `UPDATE "production_plans" pl SET "current_version" = 1 FROM "plan_versions" v WHERE v."plan_id" = pl."id"`,
    );
    await run(
      `INSERT INTO "plan_product_slices" ("tenant_id", "plan_version_id", "position", "product_id", "stream", "scenario_id", ` +
        `"unit_id", "active_from", "active_to", "is_approved", "row_version") ` +
        `SELECT v."tenant_id", v."id", 0, pl."product_ref_id", 'sequential', v."scenario_id", v."unit_id", v."valid_from", ` +
        `v."valid_to", false, 1 FROM "plan_versions" v JOIN "production_plans" pl ON pl."id" = v."plan_id" ` +
        `WHERE pl."product_ref_id" IS NOT NULL`,
    );
  }
}
