import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Master data on v2 (units, assets, products, RCA templates, RCA causes, verification checklists):
 * `row_version` for If-Match on every table the v2 master-data screens edit, `retired_at` for units and
 * assets (retire replaces the v1 delete; products and the RCA settings retire through `is_active`), and the
 * indexes the v2 lists filter and sort on (tenant first). Additive only: v1 keeps working unchanged.
 */
export class MasterDataV21793900500000 implements MigrationInterface {
  name = 'MasterDataV21793900500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of VERSIONED_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "row_version" integer NOT NULL DEFAULT '1'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "units" ADD "retired_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "assets" ADD "retired_at" TIMESTAMP WITH TIME ZONE`,
    );
    for (const [name, table, columns] of INDEXES) {
      await queryRunner.query(
        `CREATE INDEX "${name}" ON "${table}" (${columns}) `,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "retired_at"`);
    await queryRunner.query(`ALTER TABLE "units" DROP COLUMN "retired_at"`);
    for (const table of [...VERSIONED_TABLES].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "row_version"`,
      );
    }
  }
}

const VERSIONED_TABLES = [
  'units',
  'assets',
  'products',
  'rca_templates',
  'rca_cause_codes',
  'verification_status_codes',
] as const;

const INDEXES: ReadonlyArray<readonly [string, string, string]> = [
  ['IDX_assets_tenant_unit', 'assets', '"tenant_id", "unit_id"'],
  ['IDX_assets_tenant_code', 'assets', '"tenant_id", "code"'],
  ['IDX_products_organization', 'products', '"organization_id"'],
  [
    'IDX_rca_templates_tenant_name',
    'rca_templates',
    '"tenant_id", "template_name"',
  ],
  ['IDX_rca_cause_codes_tenant_code', 'rca_cause_codes', '"tenant_id", "code"'],
  [
    'IDX_verification_status_codes_tenant_code',
    'verification_status_codes',
    '"tenant_id", "code"',
  ],
];
