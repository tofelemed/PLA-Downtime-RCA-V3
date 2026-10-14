import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

/**
 * FE-02 (owner, 2026-10-14): the plan dashboard settings are retired — nothing read them. The v1
 * `/dashboard-configurations` and v2 `/v2/dashboard-configuration` routes are gone, so their only table goes
 * too. `down` recreates the table as the Baseline made it, with the current tenant-isolation policy; the
 * stored settings themselves are not restored.
 */
export class DropDashboardConfigurations1793980070000
  implements MigrationInterface
{
  name = 'DropDashboardConfigurations1793980070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dashboard_configurations"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "dashboard_configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dashboard_name" character varying(255) NOT NULL, ` +
        `"dashboard_type" character varying(100), "layout_config" text, "widget_config" text, "tenant_id" character varying(36), ` +
        `"organization_id" character varying(36), "is_default" boolean NOT NULL DEFAULT false, "is_public" boolean NOT NULL DEFAULT false, ` +
        `"created_by" character varying(36), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_82164825b0d6cca17ca2f8bf932" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "dashboard_configurations" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_configurations" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_configurations" FORCE ROW LEVEL SECURITY`,
    );
  }
}
