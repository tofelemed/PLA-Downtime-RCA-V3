import { MigrationInterface, QueryRunner } from 'typeorm';

/** `normalizePath()` of src/source-mapping/mapping-rule.ts in SQL: separators → '/', trimmed, lower-case. */
const normalizedPath = (column: string): string =>
  `lower(regexp_replace(regexp_replace(btrim(${column}), '[\\\\/]+', '/', 'g'), '^/|/$', '', 'g'))`;

const UUID_PATTERN = `'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`;

/** `source_hierarchy_mappings` rows that have an equivalent: uuid tenant, unit or asset target. */
const LEGACY_SOURCE = `FROM "source_hierarchy_mappings" l
  WHERE l."tenant_id" ~ ${UUID_PATTERN} AND l."target_type" IN ('unit', 'asset')`;

const LEGACY_COLUMNS = `"tenant_id", "connection_id", "source_system", "match_kind", "match_value", "normalized_value",
  "precedence", "target_type", "target_id", "is_active", "description", "legacy_mapping_id", "row_version"`;

const legacyRows = (
  kind: string,
  value: string,
  normalized: string,
  filter: string,
): string =>
  `INSERT INTO "source_mappings" (${LEGACY_COLUMNS})
   SELECT l."tenant_id"::uuid, l."source_connection_id", l."source_type", '${kind}', ${value}, ${normalized},
          l."priority", l."target_type"::"public"."source_mapping_target_type", l."target_id", l."is_active",
          l."description", l."id", 1
   ${LEGACY_SOURCE} AND ${filter}
   ON CONFLICT DO NOTHING`;

/** Code libraries whose rows get a version 1 in `code_versions`. */
const VERSIONED_LIBRARIES: ReadonlyArray<[library: string, table: string]> = [
  ['reason', 'reason_codes'],
  ['impact', 'impact_codes'],
  ['oee', 'oee_codes'],
];

/** Tables whose global UNIQUE(code) becomes UNIQUE(tenant_id, code), with the original constraint name. */
const GLOBAL_CODE_UNIQUES: ReadonlyArray<[table: string, constraint: string]> =
  [
    ['units', 'UQ_47635c1ab22d02fc3ebae3608b8'],
    ['impact_codes', 'UQ_83aeac110d18f6080f118f6b597'],
    ['reason_codes', 'UQ_10a9f60ddba7bc9f6396a38eaae'],
    ['oee_codes', 'UQ_d8ba3be5670be09142d190594a1'],
    ['products', 'UQ_7cfc24d6c24f0ec91294003d6b8'],
  ];

/**
 * Plan 1.3 (spec ING03, ING04, §3.2, §14.2, NFR01): `source_mappings` (replaces the loose
 * `source_hierarchy_mappings`, which stays as the v1 write store and is mirrored), typed
 * `attribute_mapping_versions`, per-tenant versioned hierarchical code libraries (`reason_codes` tree and
 * defaults, `failure_code_groups`, `loss_category_defs`, `code_versions`, `code_mapping_rules`), code
 * version FKs on `event_coding`, `production_events.classification_basis`.
 *
 * Expand: the per-tenant UNIQUE(tenant_id, code) is added before the global UNIQUE(code) is dropped; the
 * global constraint guaranteed there were no cross-tenant duplicates, so no row is renamed. Backfill
 * (set-based, idempotent on fresh tables): reason codes `path = id`, `level 0`; every code of a tenant
 * gets version 1 in `code_versions` (effective from its creation); `event_coding` points at those versions;
 * legacy hierarchy mappings become `source_mappings` (pattern → pattern; identifier → exact_id; path →
 * exact_path; tenant/organisation targets and non-uuid tenants have no equivalent and stay in the old table).
 * `down()` refuses to restore the global UNIQUE(code) while two tenants share a code (no data is destroyed).
 */

export class HierarchyMappingAndCodeLibraries1791756800000
  implements MigrationInterface
{
  name = 'HierarchyMappingAndCodeLibraries1791756800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."source_mapping_match_kind" AS ENUM('exact_id', 'exact_path', 'pattern', 'af_binding')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."source_mapping_target_type" AS ENUM('unit', 'asset')`,
    );
    await queryRunner.query(
      `CREATE TABLE "source_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "connection_id" uuid, "source_system" character varying(50) NOT NULL DEFAULT 'PI', "match_kind" "public"."source_mapping_match_kind" NOT NULL, "match_value" text NOT NULL, "normalized_value" text NOT NULL, "precedence" integer NOT NULL DEFAULT '0', "target_type" "public"."source_mapping_target_type" NOT NULL, "target_id" uuid NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, "description" text, "legacy_mapping_id" uuid, CONSTRAINT "PK_416b3a7ce8cd3fbf4347ffaee2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae9a6d92f453c8773b2227e0ee" ON "source_mappings" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_mappings_legacy" ON "source_mappings" ("legacy_mapping_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_mappings_tenant_kind" ON "source_mappings" ("tenant_id", "match_kind") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_source_mappings_active_any_connection" ON "source_mappings" ("tenant_id", "source_system", "match_kind", "normalized_value") WHERE "is_active" AND "connection_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_source_mappings_active_connection" ON "source_mappings" ("tenant_id", "source_system", "connection_id", "match_kind", "normalized_value") WHERE "is_active" AND "connection_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "loss_category_defs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "parent_id" uuid, "path" text, "level" integer NOT NULL DEFAULT '0', "report_order" integer NOT NULL DEFAULT '0', "version" integer NOT NULL DEFAULT '1', "effective_from" TIMESTAMP WITH TIME ZONE, "effective_to" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_loss_category_defs_tenant_code" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_58f8f76c344820a6cb3d6ed23ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_830758bdb0fa45d45b34d17938" ON "loss_category_defs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loss_category_defs_tenant_path" ON "loss_category_defs" ("tenant_id", "path") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loss_category_defs_tenant_parent" ON "loss_category_defs" ("tenant_id", "parent_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."failure_code_group_kind" AS ENUM('class', 'problem', 'cause', 'remedy')`,
    );
    await queryRunner.query(
      `CREATE TABLE "failure_code_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "group_kind" "public"."failure_code_group_kind" NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "parent_id" uuid, "path" text, "level" integer NOT NULL DEFAULT '0', "version" integer NOT NULL DEFAULT '1', "effective_from" TIMESTAMP WITH TIME ZONE, "effective_to" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_failure_code_groups_tenant_kind_code" UNIQUE ("tenant_id", "group_kind", "code"), CONSTRAINT "PK_40cf6d405479f4279147894018f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4a07909a5653e70d2e5e883550" ON "failure_code_groups" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_failure_code_groups_tenant_path" ON "failure_code_groups" ("tenant_id", "path") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_failure_code_groups_tenant_parent" ON "failure_code_groups" ("tenant_id", "parent_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."code_library_kind" AS ENUM('reason', 'impact', 'oee', 'failure', 'loss_category')`,
    );
    await queryRunner.query(
      `CREATE TABLE "code_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "library" "public"."code_library_kind" NOT NULL, "code_id" uuid NOT NULL, "version" integer NOT NULL, "code" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "parent_id" uuid, "snapshot" jsonb NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_code_versions_library_code_version" UNIQUE ("library", "code_id", "version"), CONSTRAINT "PK_dfcc317afdad57e1654fa060409" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ccd01e20166022423d510a615a" ON "code_versions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_code_versions_tenant_code" ON "code_versions" ("tenant_id", "code_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."code_mapping_rule_kind" AS ENUM('reason_to_oee', 'reason_to_schedule_class', 'reason_to_impact', 'impact_to_valuation')`,
    );
    await queryRunner.query(
      `CREATE TABLE "code_mapping_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "rule_kind" "public"."code_mapping_rule_kind" NOT NULL, "source_code_id" uuid NOT NULL, "target_value" character varying(64), "target_code_id" uuid, "version" integer NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_code_mapping_rules_tenant_kind_source_version" UNIQUE ("tenant_id", "rule_kind", "source_code_id", "version"), CONSTRAINT "PK_89445c96c7c3a11405e5bf03c4f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_12522f4e4a573535f49f91706b" ON "code_mapping_rules" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_code_mapping_rules_tenant_source" ON "code_mapping_rules" ("tenant_id", "source_code_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_mapping_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "connection_id" uuid, "template_name" character varying(255) NOT NULL, "version" integer NOT NULL, "field_rules" jsonb NOT NULL, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_attribute_mapping_versions_tenant_template_version" UNIQUE ("tenant_id", "template_name", "version"), CONSTRAINT "PK_7f599418a14f8f02391b1fb4589" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1510a82722301bb123b7211fbf" ON "attribute_mapping_versions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attribute_mapping_versions_tenant_template" ON "attribute_mapping_versions" ("tenant_id", "template_name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" ADD "version" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" ADD "effective_from" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" ADD "effective_to" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "reason_codes" ADD "parent_id" uuid`);
    await queryRunner.query(`ALTER TABLE "reason_codes" ADD "path" text`);
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "level" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "version" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "effective_from" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "effective_to" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "default_oee_component" "public"."production_event_oee_component"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "default_schedule_class" "public"."production_event_schedule_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD "default_impact_code_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" ADD "version" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" ADD "effective_from" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" ADD "effective_to" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "classification_basis" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD "reason_code_version_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD "impact_code_version_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD "oee_code_version_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reason_codes_tenant_path" ON "reason_codes" ("tenant_id", "path") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reason_codes_tenant_parent" ON "reason_codes" ("tenant_id", "parent_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "units" ADD CONSTRAINT "UQ_units_tenant_code" UNIQUE ("tenant_id", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" ADD CONSTRAINT "UQ_impact_codes_tenant_code" UNIQUE ("tenant_id", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD CONSTRAINT "UQ_reason_codes_tenant_code" UNIQUE ("tenant_id", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" ADD CONSTRAINT "UQ_oee_codes_tenant_code" UNIQUE ("tenant_id", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "UQ_products_tenant_code" UNIQUE ("tenant_id", "code")`,
    );
    for (const [table, constraint] of GLOBAL_CODE_UNIQUES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${constraint}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD CONSTRAINT "FK_1a590363bbe4694d21c2e252e7b" FOREIGN KEY ("parent_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" ADD CONSTRAINT "FK_20fc0f6c74c7e4eb0df205f40e5" FOREIGN KEY ("default_impact_code_id") REFERENCES "impact_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "loss_category_defs" ADD CONSTRAINT "FK_4e8e4ce35034eb1201676740eeb" FOREIGN KEY ("parent_id") REFERENCES "loss_category_defs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "failure_code_groups" ADD CONSTRAINT "FK_2a89de98b2b8da866bdeb4ae537" FOREIGN KEY ("parent_id") REFERENCES "failure_code_groups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "FK_5392982fe3abc3700ac382a592e" FOREIGN KEY ("reason_code_version_id") REFERENCES "code_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "FK_d20ef97b79daf51e1afb8336776" FOREIGN KEY ("impact_code_version_id") REFERENCES "code_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "FK_4e8136c698ead2d487411c64e4c" FOREIGN KEY ("oee_code_version_id") REFERENCES "code_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await this.backfill(queryRunner);
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "reason_codes" SET "path" = "id"::text, "level" = 0 WHERE "path" IS NULL`,
    );
    for (const [library, table] of VERSIONED_LIBRARIES) {
      await queryRunner.query(
        `UPDATE "${table}" SET "effective_from" = "created_at" WHERE "effective_from" IS NULL`,
      );
      await queryRunner.query(
        `INSERT INTO "code_versions" ("tenant_id", "library", "code_id", "version", "code", "name", "parent_id",
                   "snapshot", "effective_from", "row_version")
                 SELECT c."tenant_id", '${library}', c."id", 1, c."code", c."name", NULL,
                   jsonb_build_object('library', '${library}', 'code', c."code", 'name', c."name",
                     'description', c."description", 'category', c."category", 'version', 1),
                   c."created_at", 1
                 FROM "${table}" c WHERE c."tenant_id" IS NOT NULL`,
      );
      await queryRunner.query(
        `UPDATE "event_coding" ec SET "${library}_code_version_id" = cv."id"
                   FROM "code_versions" cv
                  WHERE cv."library" = '${library}' AND cv."code_id" = ec."${library}_code_id" AND cv."version" = 1`,
      );
    }
    await queryRunner.query(
      legacyRows(
        'pattern',
        'l."pattern"',
        normalizedPath('l."pattern"'),
        `l."is_pattern" AND btrim(coalesce(l."pattern", '')) <> ''`,
      ),
    );
    await queryRunner.query(
      legacyRows(
        'exact_id',
        'l."source_identifier"',
        'btrim(l."source_identifier")',
        `NOT l."is_pattern" AND btrim(l."source_identifier") <> ''`,
      ),
    );
    await queryRunner.query(
      legacyRows(
        'exact_path',
        'l."source_path"',
        normalizedPath('l."source_path"'),
        `NOT l."is_pattern" AND btrim(coalesce(l."source_path", '')) <> ''`,
      ),
    );
  }

  /** Throws when restoring a global UNIQUE(code) would need two tenants' codes to be merged or renamed. */
  private async assertNoCrossTenantDuplicates(
    queryRunner: QueryRunner,
  ): Promise<void> {
    for (const [table] of GLOBAL_CODE_UNIQUES) {
      const rows = (await queryRunner.query(
        `SELECT "code" FROM "${table}" GROUP BY "code" HAVING count(*) > 1 LIMIT 5`,
      )) as Array<{ code: string }>;
      if (rows.length > 0) {
        throw new Error(
          `Cannot revert HierarchyMappingAndCodeLibraries: ${table} has codes used by several tenants ` +
            `(${rows.map((row) => row.code).join(', ')}); a global UNIQUE(code) would lose data`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoCrossTenantDuplicates(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "FK_4e8136c698ead2d487411c64e4c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "FK_d20ef97b79daf51e1afb8336776"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "FK_5392982fe3abc3700ac382a592e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "failure_code_groups" DROP CONSTRAINT "FK_2a89de98b2b8da866bdeb4ae537"`,
    );
    await queryRunner.query(
      `ALTER TABLE "loss_category_defs" DROP CONSTRAINT "FK_4e8e4ce35034eb1201676740eeb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP CONSTRAINT "FK_20fc0f6c74c7e4eb0df205f40e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP CONSTRAINT "FK_1a590363bbe4694d21c2e252e7b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "UQ_products_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" DROP CONSTRAINT "UQ_oee_codes_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP CONSTRAINT "UQ_reason_codes_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" DROP CONSTRAINT "UQ_impact_codes_tenant_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "units" DROP CONSTRAINT "UQ_units_tenant_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reason_codes_tenant_parent"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reason_codes_tenant_path"`,
    );
    for (const [table, constraint] of GLOBAL_CODE_UNIQUES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" UNIQUE ("code")`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP COLUMN "oee_code_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP COLUMN "impact_code_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP COLUMN "reason_code_version_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "classification_basis"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" DROP COLUMN "effective_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oee_codes" DROP COLUMN "effective_from"`,
    );
    await queryRunner.query(`ALTER TABLE "oee_codes" DROP COLUMN "version"`);
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "default_impact_code_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "default_schedule_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "default_oee_component"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "effective_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "effective_from"`,
    );
    await queryRunner.query(`ALTER TABLE "reason_codes" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "reason_codes" DROP COLUMN "level"`);
    await queryRunner.query(`ALTER TABLE "reason_codes" DROP COLUMN "path"`);
    await queryRunner.query(
      `ALTER TABLE "reason_codes" DROP COLUMN "parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" DROP COLUMN "effective_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "impact_codes" DROP COLUMN "effective_from"`,
    );
    await queryRunner.query(`ALTER TABLE "impact_codes" DROP COLUMN "version"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_attribute_mapping_versions_tenant_template"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1510a82722301bb123b7211fbf"`,
    );
    await queryRunner.query(`DROP TABLE "attribute_mapping_versions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_code_mapping_rules_tenant_source"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_12522f4e4a573535f49f91706b"`,
    );
    await queryRunner.query(`DROP TABLE "code_mapping_rules"`);
    await queryRunner.query(`DROP TYPE "public"."code_mapping_rule_kind"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_code_versions_tenant_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ccd01e20166022423d510a615a"`,
    );
    await queryRunner.query(`DROP TABLE "code_versions"`);
    await queryRunner.query(`DROP TYPE "public"."code_library_kind"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_failure_code_groups_tenant_parent"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_failure_code_groups_tenant_path"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4a07909a5653e70d2e5e883550"`,
    );
    await queryRunner.query(`DROP TABLE "failure_code_groups"`);
    await queryRunner.query(`DROP TYPE "public"."failure_code_group_kind"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loss_category_defs_tenant_parent"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loss_category_defs_tenant_path"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_830758bdb0fa45d45b34d17938"`,
    );
    await queryRunner.query(`DROP TABLE "loss_category_defs"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_source_mappings_active_connection"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_source_mappings_active_any_connection"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_mappings_tenant_kind"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_source_mappings_legacy"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae9a6d92f453c8773b2227e0ee"`,
    );
    await queryRunner.query(`DROP TABLE "source_mappings"`);
    await queryRunner.query(`DROP TYPE "public"."source_mapping_target_type"`);
    await queryRunner.query(`DROP TYPE "public"."source_mapping_match_kind"`);
  }
}
