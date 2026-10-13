import { MigrationInterface, QueryRunner } from 'typeorm';

const PER_ROW = `app_rls_tenant_ids() IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY (app_rls_tenant_ids())`;

/**
 * Same rule as `TenantRowLevelSecurity`, but the tenant list is read through scalar subqueries, which
 * Postgres evaluates once per query (InitPlan) instead of once per row.
 */
export const RLS_POLICY_EXPRESSION = `(SELECT app_rls_tenant_ids()) IS NULL OR tenant_id IS NULL OR tenant_id::text = ANY ((SELECT app_rls_tenant_ids())::text[])`;

const POLICY_TABLES_SQL = `SELECT tablename AS "table" FROM pg_policies
  WHERE schemaname = 'public' AND policyname = 'tenant_isolation' ORDER BY tablename`;

/**
 * DB-04 (EXPERT_REVIEW, 13 Oct 2026): every `tenant_isolation` policy is rewritten so the session's tenant
 * list is computed once per query, not per row (`current_setting` + `string_to_array` on every row of an
 * aggregate). Visibility is unchanged, including rows without a tenant; new tenant tables use
 * `RLS_POLICY_EXPRESSION` (src/database/MIGRATIONS.md).
 */
export class RlsPolicyInitPlan1793910000000 implements MigrationInterface {
  name = 'RlsPolicyInitPlan1793910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, RLS_POLICY_EXPRESSION);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.rewrite(queryRunner, PER_ROW);
  }

  private async rewrite(queryRunner: QueryRunner, expression: string) {
    const tables = (await queryRunner.query(POLICY_TABLES_SQL)) as Array<{
      table: string;
    }>;
    for (const { table } of tables) {
      await queryRunner.query(
        `ALTER POLICY tenant_isolation ON "${table}" USING (${expression}) WITH CHECK (${expression})`,
      );
    }
  }
}
