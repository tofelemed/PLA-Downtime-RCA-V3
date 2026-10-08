import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const FK: ReadonlyArray<[table: string, name: string, definition: string]> = [
  [
    'units',
    'FK_2e1f4c47dcaa5ff0cb28211963b',
    `("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT`,
  ],
  [
    'crews',
    'FK_137fe7d87345eeaa9eee3ee2067',
    `("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT`,
  ],
  [
    'calendar_versions',
    'FK_49bc94bef03897db386268dac22',
    `("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT`,
  ],
  [
    'calendar_versions',
    'FK_dc755cdbb7ce2b332b452961d37',
    `("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT`,
  ],
  [
    'shift_instances',
    'FK_68654c5b55f02f36cd88a30ea51',
    `("calendar_version_id") REFERENCES "calendar_versions"("id") ON DELETE RESTRICT`,
  ],
  [
    'shift_instances',
    'FK_0093bbcc37b152bfd44f797f5c1',
    `("unit_id") REFERENCES "units"("id") ON DELETE CASCADE`,
  ],
  [
    'shift_instances',
    'FK_3d31f4fa45f3f6f3bfc4dd01667',
    `("crew_id") REFERENCES "crews"("id") ON DELETE SET NULL`,
  ],
  [
    'crew_rotations',
    'FK_84685edba4dc886bc63f03765c7',
    `("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE`,
  ],
];

/** Definition columns a published calendar version may never change (spec §14.2: new changes = new version). */
const DEFINITION_COLUMNS = [
  'state',
  'site_id',
  'unit_id',
  'version',
  'timezone',
  'operational_day_start',
  'shift_templates',
  'working_intervals',
  'holidays',
  'exclusions',
  'effective_from',
  'effective_to',
];

/**
 * Plan 2.1 (CAL01, CAL02, §14.2): sites (one default site per tenant from `tenants.timezone`, `UTC` with
 * `timezone_fallback` when it is not an IANA name), `units.site_id` backfilled to it, versioned
 * calendars (published rows immutable by trigger), shift instances with stored UTC bounds, offsets and
 * local labels (no overlap per unit: btree_gist exclusion), crews and crew rotations. Expand-only;
 * `down()` drops everything it created.
 */
export class Calendars1792188800000 implements MigrationInterface {
  name = 'Calendars1792188800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
    await this.createSitesAndCrews(queryRunner);
    await this.createCalendarVersions(queryRunner);
    await this.createShiftInstances(queryRunner);
    await queryRunner.query(`ALTER TABLE "units" ADD "site_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_units_site_id" ON "units" ("site_id") `,
    );
    for (const [table, name, definition] of FK) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ${definition} ON UPDATE NO ACTION`,
      );
    }
    await this.createImmutabilityTrigger(queryRunner);
    await this.backfillDefaultSites(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_calendar_versions_published_immutable" ON "calendar_versions"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "calendar_versions_published_immutable"()`,
    );
    for (const [table, name] of [...FK].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`,
      );
    }
    await queryRunner.query(`DROP INDEX "public"."IDX_units_site_id"`);
    await queryRunner.query(`ALTER TABLE "units" DROP COLUMN "site_id"`);
    for (const table of [
      'crew_rotations',
      'shift_instances',
      'calendar_versions',
      'crews',
      'sites',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
    await queryRunner.query(`DROP TYPE "public"."calendar_version_state"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "btree_gist"`);
  }

  private async createSitesAndCrews(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sites" (${TENANT_SCOPED_COLUMNS}, "organization_id" uuid, "name" character varying(255) NOT NULL, ` +
        `"timezone" character varying(64) NOT NULL, "timezone_fallback" boolean NOT NULL DEFAULT false, ` +
        `"operational_day_start" TIME NOT NULL, "is_default" boolean NOT NULL DEFAULT false, ` +
        `CONSTRAINT "PK_4f5eccb1dfde10c9170502595a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bee73a348dcf70a5e113e865bb" ON "sites" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sites_tenant_name" ON "sites" ("tenant_id", "name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sites_default_per_tenant" ON "sites" ("tenant_id") WHERE "is_default"`,
    );
    await queryRunner.query(
      `CREATE TABLE "crews" (${TENANT_SCOPED_COLUMNS}, "site_id" uuid NOT NULL, "name" character varying(100) NOT NULL, ` +
        `CONSTRAINT "PK_4316f43ffc0d2bbb0c4c767ba5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1de00b5048d8462a8d84698c22" ON "crews" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_crews_site_name" ON "crews" ("site_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "crew_rotations" (${TENANT_SCOPED_COLUMNS}, "crew_id" uuid NOT NULL, "pattern" jsonb NOT NULL, ` +
        `"effective_from" date NOT NULL, "effective_to" date, ` +
        `CONSTRAINT "CHK_crew_rotations_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
        `CONSTRAINT "PK_2a1c78f8352704430ad3965dbf6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39ca7dfd04021dc96cd14c0c68" ON "crew_rotations" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crew_rotations_crew_from" ON "crew_rotations" ("crew_id", "effective_from") `,
    );
  }

  private async createCalendarVersions(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."calendar_version_state" AS ENUM('draft', 'published')`,
    );
    await queryRunner.query(
      `CREATE TABLE "calendar_versions" (${TENANT_SCOPED_COLUMNS}, "site_id" uuid NOT NULL, "unit_id" uuid, ` +
        `"version" integer NOT NULL, "state" "public"."calendar_version_state" NOT NULL DEFAULT 'draft', ` +
        `"timezone" character varying(64) NOT NULL, "operational_day_start" TIME NOT NULL, "shift_templates" jsonb NOT NULL, ` +
        `"working_intervals" jsonb NOT NULL DEFAULT '[]', "holidays" jsonb NOT NULL DEFAULT '[]', ` +
        `"exclusions" jsonb NOT NULL DEFAULT '[]', "effective_from" date NOT NULL, "effective_to" date, ` +
        `"published_by" uuid, "published_at" TIMESTAMP WITH TIME ZONE, "republish_reason" text, ` +
        `CONSTRAINT "CHK_calendar_versions_published_at" CHECK ("state" = 'draft' OR "published_at" IS NOT NULL), ` +
        `CONSTRAINT "CHK_calendar_versions_effective" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
        `CONSTRAINT "PK_b4305e70ef56d38c702630470db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_42c70bceb21f44824c5545b48e" ON "calendar_versions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_calendar_versions_unit_version" ON "calendar_versions" ("unit_id", "version") WHERE "unit_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_calendar_versions_site_version" ON "calendar_versions" ("site_id", "version") WHERE "unit_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_calendar_versions_tenant_site_unit" ON "calendar_versions" ("tenant_id", "site_id", "unit_id") `,
    );
  }

  private async createShiftInstances(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shift_instances" (${TENANT_SCOPED_COLUMNS}, "calendar_version_id" uuid NOT NULL, "unit_id" uuid NOT NULL, ` +
        `"local_date" date NOT NULL, "shift_name" character varying(64) NOT NULL, ` +
        `"utc_start" TIMESTAMP WITH TIME ZONE NOT NULL, "utc_end" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"utc_offset_start" integer NOT NULL, "utc_offset_end" integer NOT NULL, ` +
        `"local_start" character varying(32) NOT NULL, "local_end" character varying(32) NOT NULL, ` +
        `"is_excluded" boolean NOT NULL DEFAULT false, "exclusion_kind" character varying(32), "exclusion_reason" text, ` +
        `"crew_id" uuid, CONSTRAINT "UQ_shift_instances_unit_start" UNIQUE ("unit_id", "utc_start"), ` +
        `CONSTRAINT "CHK_shift_instances_exclusion" CHECK ("is_excluded" = ("exclusion_kind" IS NOT NULL)), ` +
        `CONSTRAINT "CHK_shift_instances_interval" CHECK ("utc_end" > "utc_start"), ` +
        `CONSTRAINT "EX_shift_instances_unit_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, tstzrange("utc_start", "utc_end", '[)') WITH &&), ` +
        `CONSTRAINT "PK_345c381a2cb26a0d881deebf78d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b944406914d03364e7dadaadd5" ON "shift_instances" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_instances_crew" ON "shift_instances" ("crew_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_instances_calendar_version" ON "shift_instances" ("calendar_version_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_instances_tenant_unit_date" ON "shift_instances" ("tenant_id", "unit_id", "local_date") `,
    );
  }

  /** Published versions: definition columns frozen, rows never deleted. */
  private async createImmutabilityTrigger(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const changed = DEFINITION_COLUMNS.map(
      (c) => `NEW."${c}" IS DISTINCT FROM OLD."${c}"`,
    ).join(' OR ');
    await queryRunner.query(
      `CREATE FUNCTION "calendar_versions_published_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
        `BEGIN IF OLD."state" = 'published' AND (TG_OP = 'DELETE' OR ${changed}) THEN ` +
        `RAISE EXCEPTION 'published calendar versions are immutable (publish a new version)'; END IF; ` +
        `IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $fn$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_calendar_versions_published_immutable" BEFORE UPDATE OR DELETE ON "calendar_versions" ` +
        `FOR EACH ROW EXECUTE FUNCTION "calendar_versions_published_immutable"()`,
    );
  }

  /** One default site per tenant (D03: operational day 06:00); units point at it. */
  private async backfillDefaultSites(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "sites" ("tenant_id", "organization_id", "name", "timezone", "timezone_fallback", ` +
        `"operational_day_start", "is_default", "row_version") ` +
        `SELECT t."id", t."organization_id", t."name", COALESCE(tz."name", 'UTC'), tz."name" IS NULL, '06:00', true, 1 ` +
        `FROM "tenants" t LEFT JOIN LATERAL (SELECT z."name" FROM pg_timezone_names z ` +
        `WHERE z."name" = btrim(t."timezone") LIMIT 1) tz ON true`,
    );
    await queryRunner.query(
      `UPDATE "units" u SET "site_id" = s."id" FROM "sites" s WHERE s."tenant_id" = u."tenant_id" AND s."is_default"`,
    );
  }
}
