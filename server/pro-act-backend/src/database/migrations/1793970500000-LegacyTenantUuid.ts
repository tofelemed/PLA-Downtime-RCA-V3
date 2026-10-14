import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

/** Legacy tables whose `tenant_id varchar(36)` becomes `uuid` with a FK to tenants (table → FK name). */
const TABLES: ReadonlyArray<[string, string]> = [
  ['tasks', 'FK_93edccfc42408754c4b5957105e'],
  ['af_bindings', 'FK_1463179e78a90d088ae8374743e'],
  ['custom_attribute_definitions', 'FK_a66f57e74944f56f84263998924'],
  ['custom_attribute_values', 'FK_6c05f068f12c3d0f0e399670d70'],
  ['dashboard_configurations', 'FK_8b07082a157896b98fd76cdc42a'],
  ['data_sources', 'FK_39dceb76a83f68b33494034bca6'],
  ['historian_tags', 'FK_8d77df8595e77a6d7f866b406c1'],
  ['pi_af_elements', 'FK_a067299e14d010580eebfb86cb7'],
  ['pi_events', 'FK_243a82722abeb72cbadcddd7ff8'],
  ['pi_mappings', 'FK_7fa81bd4264b9df8d18f9d26f03'],
  ['pi_sync_jobs', 'FK_03bc03f60cf3ead27d2290f93ce'],
  ['pi_sync_watermarks', 'FK_68e74a0ab6e2aa327b5c0fe677b'],
  ['production_plan_templates', 'FK_f32f538a0e4947e7339ab9a1b0b'],
  ['query_history', 'FK_8662ec50511259be3076f9c81a3'],
  ['source_hierarchy_mappings', 'FK_bf3eb0c0607310d1195ed28d338'],
  ['unmapped_events', 'FK_4b18d9538c66b7e799f5aeb3307'],
];

const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;

const warn = (message: string) =>
  `DO $do$ BEGIN RAISE WARNING '%', ${quote(message)}; END $do$`;

/**
 * DB-05 (expert review), contract step of the varchar → uuid tenant change for legacy v1 tables with no
 * raw SQL that compares `tenant_id` as text (the work summary's task cells now bind `$1::uuid`) and no
 * dependent view. Per table: values that are not UUIDs leave the table unchanged with a WARNING (never
 * rewritten or deleted); the RLS policy is recreated around the type change (a policy pins its
 * column's type); the FK is added NOT VALID and validated only when no row names an unknown tenant.
 * Dev data (14 Oct 2026): 0 non-UUID and 0 orphan values in all 16 tables. Not converted here, see the
 * Area 6 report: production_events (failure_events_v view, tenant_uuid shadow column, raw SQL),
 * audit_logs (260 orphan tenant ids), production_plans (5 orphans), assets / products, pi_connections,
 * rcas and the RCA analysis tables.
 */
export class LegacyTenantUuid1793970500000 implements MigrationInterface {
  name = 'LegacyTenantUuid1793970500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, fk] of TABLES) {
      const [{ bad }] = (await queryRunner.query(
        `SELECT count(*)::int AS "bad" FROM "${table}" WHERE "tenant_id" !~ '${UUID_PATTERN}'`,
      )) as Array<{ bad: number }>;
      if (bad > 0) {
        await queryRunner.query(
          warn(
            `${table}.tenant_id kept varchar: ${bad} value(s) are not UUIDs`,
          ),
        );
        continue;
      }
      await this.retype(queryRunner, table, 'uuid USING "tenant_id"::uuid');
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ` +
          `ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`,
      );
      await this.validateWhenClean(queryRunner, table, fk);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, fk] of [...TABLES].reverse()) {
      const [column] = (await queryRunner.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`,
        [table],
      )) as Array<{ data_type: string }>;
      if (column?.data_type !== 'uuid') continue;
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fk}"`,
      );
      await this.retype(
        queryRunner,
        table,
        'character varying(36) USING "tenant_id"::text',
      );
    }
  }

  /** ALTER COLUMN TYPE with the tenant_isolation policy dropped and recreated around it. */
  private async retype(
    queryRunner: QueryRunner,
    table: string,
    type: string,
  ): Promise<void> {
    const policies = (await queryRunner.query(
      `SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = $1 AND policyname = 'tenant_isolation'`,
      [table],
    )) as unknown[];
    if (policies.length > 0) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "tenant_id" TYPE ${type}`,
    );
    if (policies.length > 0) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
      );
    }
  }

  private async validateWhenClean(
    queryRunner: QueryRunner,
    table: string,
    fk: string,
  ): Promise<void> {
    const [{ orphans }] = (await queryRunner.query(
      `SELECT count(*)::int AS "orphans" FROM "${table}" t
        WHERE t."tenant_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "tenants" x WHERE x."id" = t."tenant_id")`,
    )) as Array<{ orphans: number }>;
    if (orphans === 0) {
      await queryRunner.query(
        `ALTER TABLE "${table}" VALIDATE CONSTRAINT "${fk}"`,
      );
      return;
    }
    await queryRunner.query(
      warn(
        `${fk} on ${table} stays NOT VALID: ${orphans} row(s) name an unknown tenant`,
      ),
    );
  }
}
