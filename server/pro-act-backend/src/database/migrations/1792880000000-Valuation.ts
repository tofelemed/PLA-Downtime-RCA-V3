import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables, enums, indexes and foreign keys of plan 2.6 (generated from the entities, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `CREATE TYPE "public"."valuation_totals_view" AS ENUM('contribution_margin', 'standard_cost', 'cost_per_hour', 'independent_components')`,
  `CREATE TABLE "period_valuation_totals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "run_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "ledger" "public"."loss_ledger" NOT NULL, "kind" "public"."loss_line_kind" NOT NULL, "view" "public"."valuation_totals_view" NOT NULL, "currency" character varying(3) NOT NULL, "uom" character varying(50), "amount" numeric(28,8), "native_amount" numeric(28,8) NOT NULL, "valued_lines" integer NOT NULL, "unvalued_lines" integer NOT NULL, "fx_missing_lines" integer NOT NULL, "unvalued_quantity" numeric(24,8) NOT NULL, "unvalued_seconds" numeric(24,8) NOT NULL, "status" character varying(16) NOT NULL, "reasons" jsonb NOT NULL DEFAULT '[]', "fx_rate_ids" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_period_valuation_totals_cell" UNIQUE ("run_id", "slice_id", "ledger", "kind", "view", "currency"), CONSTRAINT "PK_6eab802064fbfe1206ea387b8e8" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_be45fe5eaafad6c9c468c40ae0" ON "period_valuation_totals" ("tenant_id") `,
  `CREATE INDEX "IDX_period_valuation_totals_tenant_period" ON "period_valuation_totals" ("tenant_id", "period_id") `,
  `CREATE TYPE "public"."fx_rate_state" AS ENUM('draft', 'approved', 'retired')`,
  `CREATE TABLE "fx_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "from_currency" character varying(3) NOT NULL, "to_currency" character varying(3) NOT NULL, "rate" numeric(24,10) NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, "state" "public"."fx_rate_state" NOT NULL DEFAULT 'draft', "source" text, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_fx_rates_approved_at" CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL), CONSTRAINT "CHK_fx_rates_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "CHK_fx_rates_rate_positive" CHECK ("rate" > 0), CONSTRAINT "CHK_fx_rates_currencies" CHECK ("from_currency" ~ '^[A-Z]{3}$' AND "to_currency" ~ '^[A-Z]{3}$' AND "from_currency" <> "to_currency"), CONSTRAINT "EX_fx_rates_approved_no_overlap" EXCLUDE USING gist ("tenant_id" WITH =, "from_currency" WITH =, "to_currency" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved'), CONSTRAINT "PK_94eb17e7eddb6df0cec5985ea5f" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_1b7a67348d189f9f49f6f8f99f" ON "fx_rates" ("tenant_id") `,
  `CREATE INDEX "IDX_fx_rates_tenant_pair_from" ON "fx_rates" ("tenant_id", "from_currency", "to_currency", "effective_from") `,
  `CREATE TYPE "public"."valuation_view" AS ENUM('contribution_margin', 'standard_cost', 'cost_per_hour')`,
  `CREATE TYPE "public"."line_valuation_status" AS ENUM('valued', 'unvalued')`,
  `CREATE TABLE "loss_line_valuations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "run_id" uuid NOT NULL, "loss_line_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "ledger" "public"."loss_ledger" NOT NULL, "view" "public"."valuation_view" NOT NULL, "currency" character varying(3) NOT NULL, "amount" numeric(28,8), "native" boolean NOT NULL, "status" "public"."line_valuation_status" NOT NULL, "reason" character varying(64), "rate_version_ids" jsonb NOT NULL DEFAULT '[]', "fx_rate_ids" jsonb NOT NULL DEFAULT '[]', "valuation_date" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_loss_line_valuations_line_view_currency" UNIQUE ("loss_line_id", "view", "currency"), CONSTRAINT "PK_7b0cf92210c093d1b6c567cf463" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_767a0033709f2c0fddfe5c79b5" ON "loss_line_valuations" ("tenant_id") `,
  `CREATE INDEX "IDX_loss_line_valuations_run" ON "loss_line_valuations" ("run_id") `,
  `CREATE INDEX "IDX_loss_line_valuations_period" ON "loss_line_valuations" ("period_id") `,
  `CREATE INDEX "IDX_loss_line_valuations_tenant_run" ON "loss_line_valuations" ("tenant_id", "run_id") `,
  `ALTER TABLE "calculation_runs" ADD "valuation_context" jsonb`,
  `ALTER TABLE "period_valuation_totals" ADD CONSTRAINT "FK_period_valuation_totals_run" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_line_valuations" ADD CONSTRAINT "FK_loss_line_valuations_run" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "loss_line_valuations" ADD CONSTRAINT "FK_loss_line_valuations_line" FOREIGN KEY ("loss_line_id") REFERENCES "loss_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "loss_line_valuations" DROP CONSTRAINT "FK_loss_line_valuations_line"`,
  `ALTER TABLE "loss_line_valuations" DROP CONSTRAINT "FK_loss_line_valuations_run"`,
  `ALTER TABLE "period_valuation_totals" DROP CONSTRAINT "FK_period_valuation_totals_run"`,
  `ALTER TABLE "calculation_runs" DROP COLUMN "valuation_context"`,
  `DROP INDEX "public"."IDX_loss_line_valuations_tenant_run"`,
  `DROP INDEX "public"."IDX_loss_line_valuations_period"`,
  `DROP INDEX "public"."IDX_loss_line_valuations_run"`,
  `DROP INDEX "public"."IDX_767a0033709f2c0fddfe5c79b5"`,
  `DROP TABLE "loss_line_valuations"`,
  `DROP TYPE "public"."line_valuation_status"`,
  `DROP TYPE "public"."valuation_view"`,
  `DROP INDEX "public"."IDX_fx_rates_tenant_pair_from"`,
  `DROP INDEX "public"."IDX_1b7a67348d189f9f49f6f8f99f"`,
  `DROP TABLE "fx_rates"`,
  `DROP TYPE "public"."fx_rate_state"`,
  `DROP INDEX "public"."IDX_period_valuation_totals_tenant_period"`,
  `DROP INDEX "public"."IDX_be45fe5eaafad6c9c468c40ae0"`,
  `DROP TABLE "period_valuation_totals"`,
  `DROP TYPE "public"."valuation_totals_view"`,
];

/** `accounting_policy_kind` gains `valuation_basis` (type recreated: a new enum value is unusable in its own transaction). */
const POLICY_KIND_UP: readonly string[] = [
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `ALTER TYPE "public"."accounting_policy_kind" RENAME TO "accounting_policy_kind_old"`,
  `CREATE TYPE "public"."accounting_policy_kind" AS ENUM('coverage_gate', 'source_authority', 'oee_policy', 'reconciliation_tolerance', 'valuation_basis')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind" USING "policy_kind"::"text"::"public"."accounting_policy_kind"`,
  `DROP TYPE "public"."accounting_policy_kind_old"`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from") `,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
];

const POLICY_KIND_DOWN: readonly string[] = [
  `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'valuation_basis'`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `CREATE TYPE "public"."accounting_policy_kind_old" AS ENUM('coverage_gate', 'source_authority', 'oee_policy', 'reconciliation_tolerance')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind_old" USING "policy_kind"::"text"::"public"."accounting_policy_kind_old"`,
  `DROP TYPE "public"."accounting_policy_kind"`,
  `ALTER TYPE "public"."accounting_policy_kind_old" RENAME TO "accounting_policy_kind"`,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from") `,
];

const IMMUTABLE_TABLES = ['loss_line_valuations', 'period_valuation_totals'];

/** Frozen copies of the contracts defaults (`valuation_basis.default.json` v1 and `.v2.default.json`). */
const V1_BODY = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  currency: 'XXX',
  fxPolicy: 'none',
};
const V2_BODY = {
  defaultBasis: 'contribution_margin',
  timeBasisRule: 'exclusive',
  reportingCurrencies: ['IRR', 'USD'],
  fxPolicy: 'snapshot',
  independentImpactCodeIds: [],
};
const V1_NOTE =
  'Seed default of 2026-10-07 (D08 "use as proposed"); currency XXX = D08 Q2 unanswered. Kept as history, never approved (VAL01).';
const V2_NOTE =
  'D08 Q2 answered 2026-10-09: IRR and USD through approved, dated FX rates. Unapproved until a manager approver records the finance approval (VAL01).';

/**
 * Plan 2.6 (VAL01–VAL03, D08): `valuation_basis` joins `accounting_policies` with, per existing tenant,
 * version 1 (the XXX placeholder, history) and version 2 (IRR and USD, FX snapshot), both unapproved;
 * the approved FX rate table `fx_rates`; per-run valuation rows `loss_line_valuations` and totals
 * `period_valuation_totals` (immutable like the run's lines); `calculation_runs.valuation_context`.
 * `down()` removes everything, including the valuation policies.
 */
export class Valuation1792880000000 implements MigrationInterface {
  name = 'Valuation1792880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    for (const statement of POLICY_KIND_UP) await queryRunner.query(statement);
    for (const table of IMMUTABLE_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER "trg_${table}_immutable" BEFORE UPDATE OR DELETE ON "${table}" ` +
          `FOR EACH ROW EXECUTE FUNCTION "accounting_lines_immutable"()`,
      );
    }
    const versions: Array<[number, object, string]> = [
      [1, V1_BODY, V1_NOTE],
      [2, V2_BODY, V2_NOTE],
    ];
    for (const [version, body, note] of versions) {
      await queryRunner.query(
        `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
                "version", "body", "effective_from", "approved_at", "notes")
         SELECT t."id", 1, 'valuation_basis', NULL, 'tenant', $1, $2::jsonb, '1970-01-01T00:00:00Z', NULL, $3
           FROM "tenants" t`,
        [version, JSON.stringify(body), note],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of IMMUTABLE_TABLES) {
      await queryRunner.query(
        `DROP TRIGGER "trg_${table}_immutable" ON "${table}"`,
      );
    }
    for (const statement of POLICY_KIND_DOWN)
      await queryRunner.query(statement);
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}
