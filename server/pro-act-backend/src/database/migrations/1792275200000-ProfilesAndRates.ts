import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const STATES = `'draft', 'approved', 'retired'`;
const TIMEBASES = `'s', 'min', 'h', 'd'`;

const ENUMS: Record<string, string> = {
  production_profile_rate_timebase: TIMEBASES,
  production_profile_capacity_model: `'single_stream', 'shared_capacity', 'independent_streams'`,
  production_profile_state: STATES,
  valuation_rate_basis: `'contribution_margin', 'standard_cost', 'cost_per_hour'`,
  valuation_rate_state: STATES,
  rate_import_kind: `'budget', 'forecast', 'mpc'`,
  rate_import_state: `'queued', 'completed', 'failed'`,
  unit_product_rate_kind: `'nameplate', 'demonstrated', 'sustained', 'planning', 'budget', 'forecast'`,
  unit_product_rate_timebase: TIMEBASES,
  unit_product_rate_state: STATES,
  unit_product_rate_source: `'manual', 'import'`,
};

const FK: ReadonlyArray<[table: string, name: string, definition: string]> = [
  [
    'production_profiles',
    'FK_7f150424efcfbe1e1e0d7dc23bd',
    `("unit_id") REFERENCES "units"("id")`,
  ],
  [
    'production_profiles',
    'FK_1153e094a665f9c223993823fa9',
    `("product_id") REFERENCES "products"("id")`,
  ],
  [
    'valuation_rates',
    'FK_c43b65b42543a0f992b0de2727e',
    `("profile_id") REFERENCES "production_profiles"("id")`,
  ],
  [
    'valuation_rates',
    'FK_84f5cfca9fd8b463f90218f4bba',
    `("impact_code_id") REFERENCES "impact_codes"("id")`,
  ],
  [
    'unit_product_rates',
    'FK_db9f823eb23a8eb9b27f28df301',
    `("profile_id") REFERENCES "production_profiles"("id")`,
  ],
  [
    'unit_product_rates',
    'FK_84787a5fbf49c2d14e38e8b05bb',
    `("rate_import_id") REFERENCES "rate_imports"("id")`,
  ],
];

const EFFECTIVE = `CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")`;
const APPROVED_AT = `CHECK ("state" <> 'approved' OR "approved_at" IS NOT NULL)`;
const RANGE = `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`;

/**
 * Plan 2.2 (PLAN01, PLAN06, VAL01, §14.2): production profiles, unit-product rates, valuation rates and
 * rate imports. Approved versions never overlap per key (btree_gist exclusion constraints, extension
 * from Calendars). Legacy bridge: one **draft** profile per (unit, product) seen in v1 plans of the same
 * tenant, with the v1 capacity / unit of measure / ideal cycle time / `standard_rate` kept as review
 * values only (no timebase is guessed; `standard_rate` is an unconfirmed legacy cost, D08). Expand-only;
 * `down()` drops everything it created.
 */
export class ProfilesAndRates1792275200000 implements MigrationInterface {
  name = 'ProfilesAndRates1792275200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of Object.entries(ENUMS)) {
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${values})`,
      );
    }
    await this.createProfiles(queryRunner);
    await this.createValuationRates(queryRunner);
    await this.createRateImports(queryRunner);
    await this.createRates(queryRunner);
    for (const [table, name, definition] of FK) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await this.seedLegacyProfiles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, name] of [...FK].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`,
      );
    }
    for (const table of [
      'unit_product_rates',
      'rate_imports',
      'valuation_rates',
      'production_profiles',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
    for (const type of Object.keys(ENUMS).reverse()) {
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
    }
  }

  private async createProfiles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "production_profiles" (${TENANT_SCOPED_COLUMNS}, "unit_id" uuid NOT NULL, "product_id" uuid NOT NULL, ` +
        `"operating_mode" character varying(64) NOT NULL DEFAULT 'normal', "quantity_uom" character varying(50), ` +
        `"rate_timebase" "public"."production_profile_rate_timebase", ` +
        `"capacity_model" "public"."production_profile_capacity_model" NOT NULL DEFAULT 'single_stream', ` +
        `"actuals_policy_id" uuid, "oee_policy_id" uuid, "valuation_policy_id" uuid, "product_mix_constraints" jsonb, ` +
        `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, ` +
        `"state" "public"."production_profile_state" NOT NULL DEFAULT 'draft', "approved_by" uuid, ` +
        `"approved_at" TIMESTAMP WITH TIME ZONE, "legacy_values" jsonb, ` +
        `CONSTRAINT "UQ_production_profiles_key_version" UNIQUE ("tenant_id", "unit_id", "product_id", "operating_mode", "version"), ` +
        `CONSTRAINT "CHK_production_profiles_approved_at" ${APPROVED_AT}, ` +
        `CONSTRAINT "CHK_production_profiles_effective" ${EFFECTIVE}, ` +
        `CONSTRAINT "EX_production_profiles_approved_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, "product_id" WITH =, ` +
        `"operating_mode" WITH =, ${RANGE}, ` +
        `CONSTRAINT "PK_ffc00934315c8134cf2db648797" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae728f988ed7af9c4bfe77b61a" ON "production_profiles" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_profiles_product" ON "production_profiles" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_profiles_tenant_unit_product" ON "production_profiles" ("tenant_id", "unit_id", "product_id") `,
    );
  }

  private async createValuationRates(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "valuation_rates" (${TENANT_SCOPED_COLUMNS}, "profile_id" uuid, "impact_code_id" uuid, ` +
        `"basis" "public"."valuation_rate_basis" NOT NULL, "value" numeric(24,8) NOT NULL, ` +
        `"currency" character varying(3) NOT NULL, "per_uom" character varying(50) NOT NULL, ` +
        `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, ` +
        `"state" "public"."valuation_rate_state" NOT NULL DEFAULT 'draft', "approved_by" uuid, ` +
        `"approved_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "CHK_valuation_rates_approved_at" ${APPROVED_AT}, ` +
        `CONSTRAINT "CHK_valuation_rates_currency" CHECK ("currency" ~ '^[A-Z]{3}$'), ` +
        `CONSTRAINT "CHK_valuation_rates_effective" ${EFFECTIVE}, ` +
        `CONSTRAINT "CHK_valuation_rates_owner" CHECK (("profile_id" IS NOT NULL) <> ("impact_code_id" IS NOT NULL)), ` +
        `CONSTRAINT "EX_valuation_rates_approved_no_overlap" EXCLUDE USING gist ((COALESCE("profile_id", "impact_code_id")) WITH =, ` +
        `"basis" WITH =, ${RANGE}, ` +
        `CONSTRAINT "PK_b9ad46c0ffe25fc459a49554363" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e57b4f47c9f913c284d686721" ON "valuation_rates" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_valuation_rates_impact_code" ON "valuation_rates" ("impact_code_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_valuation_rates_profile" ON "valuation_rates" ("profile_id") `,
    );
  }

  private async createRateImports(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rate_imports" (${TENANT_SCOPED_COLUMNS}, "kind" "public"."rate_import_kind" NOT NULL, ` +
        `"external_id" character varying(255) NOT NULL, "revision" integer NOT NULL, "file_ref" character varying(500), ` +
        `"state" "public"."rate_import_state" NOT NULL DEFAULT 'queued', "payload" jsonb NOT NULL, "counts" jsonb, ` +
        `"report" jsonb, "imported_by" uuid, "finished_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "UQ_rate_imports_document_revision" UNIQUE ("tenant_id", "kind", "external_id", "revision"), ` +
        `CONSTRAINT "PK_1d7b96edf1e2949b7b09298fd85" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83749665d60550ebcbc2171fc6" ON "rate_imports" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rate_imports_state_created" ON "rate_imports" ("state", "created_at") `,
    );
  }

  private async createRates(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "unit_product_rates" (${TENANT_SCOPED_COLUMNS}, "profile_id" uuid NOT NULL, ` +
        `"rate_kind" "public"."unit_product_rate_kind" NOT NULL, "rate" numeric(24,8) NOT NULL, ` +
        `"timebase" "public"."unit_product_rate_timebase" NOT NULL, ` +
        `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL, ` +
        `"state" "public"."unit_product_rate_state" NOT NULL DEFAULT 'draft', "approved_by" uuid, ` +
        `"approved_at" TIMESTAMP WITH TIME ZONE, "source" "public"."unit_product_rate_source" NOT NULL DEFAULT 'manual', ` +
        `"external_id" character varying(255), "rate_import_id" uuid, ` +
        `CONSTRAINT "UQ_unit_product_rates_profile_kind_version" UNIQUE ("profile_id", "rate_kind", "version"), ` +
        `CONSTRAINT "CHK_unit_product_rates_approved_at" ${APPROVED_AT}, ` +
        `CONSTRAINT "CHK_unit_product_rates_rate" CHECK ("rate" >= 0), ` +
        `CONSTRAINT "CHK_unit_product_rates_effective" ${EFFECTIVE}, ` +
        `CONSTRAINT "EX_unit_product_rates_approved_no_overlap" EXCLUDE USING gist ("profile_id" WITH =, "rate_kind" WITH =, ` +
        `${RANGE}, ` +
        `CONSTRAINT "PK_f735f2993e0ef900b2eb9be1b6f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c756eb42e3acfec0ff7673fc47" ON "unit_product_rates" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_unit_product_rates_import" ON "unit_product_rates" ("rate_import_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_unit_product_rates_tenant_kind_external" ON "unit_product_rates" ("tenant_id", "rate_kind", "external_id") `,
    );
  }

  /**
   * Plan 2.2 step 3: one draft profile per (unit, product) pair of the v1 plans, both of the plan's
   * tenant, valid from the pair's first plan start. Nothing is approved and no rate is created: v1
   * `capacity` has no timebase, so it stays a review value (MIG §18.2), and plans need explicit rates.
   */
  private async seedLegacyProfiles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "production_profiles" ("tenant_id", "unit_id", "product_id", "operating_mode", "quantity_uom", ` +
        `"effective_from", "version", "state", "legacy_values", "row_version") ` +
        `SELECT u."tenant_id", u."id", p."id", 'normal', ` +
        `COALESCE(NULLIF(btrim(p."uom"), ''), NULLIF(btrim(u."unit_of_measure"), '')), ` +
        `MIN(pl."start_date"), 1, 'draft', ` +
        `jsonb_build_object('capacity', u."capacity"::text, 'capacityUom', NULLIF(btrim(u."unit_of_measure"), ''), ` +
        `'idealCycleTime', u."ideal_cycle_time"::text, 'standardRate', p."standard_rate"::text, ` +
        `'standardRateStatus', 'unconfirmed_legacy_cost'), 1 ` +
        `FROM "production_plans" pl ` +
        `JOIN "units" u ON u."id"::text = lower(btrim(pl."unit_id")) ` +
        `JOIN "products" p ON p."id"::text = lower(btrim(pl."product_id")) AND lower(p."tenant_id") = u."tenant_id"::text ` +
        `WHERE pl."tenant_id" IS NULL OR lower(pl."tenant_id") = u."tenant_id"::text ` +
        `GROUP BY u."tenant_id", u."id", p."id"`,
    );
  }
}
