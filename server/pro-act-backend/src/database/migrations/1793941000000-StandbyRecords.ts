import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLES = ['standby_equipment', 'standby_records'];

/**
 * SME D9 (EXPERT_REVIEW §2.1): standby equipment and its demand / test / running log. `standby_equipment`
 * says over which interval an asset is evaluated as standby (on demand, running or both); `standby_records`
 * holds start demands, proof tests and running periods with their outcome (failed start, failed while
 * running), so failure on demand = failed starts / demands and operating MTBF uses the asset's own running
 * exposure. RLS `tenant_isolation` (DB-04 form).
 */
export class StandbyRecords1793941000000 implements MigrationInterface {
  name = 'StandbyRecords1793941000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "standby_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "asset_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "record_kind" character varying(16) NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "outcome" character varying(24) NOT NULL, "event_id" uuid, "external_ref" character varying(100), "notes" text, CONSTRAINT "CHK_standby_records_outcome" CHECK ("outcome" IN ('success', 'failed_start', 'failed_while_running') AND ("outcome" <> 'failed_while_running' OR "record_kind" = 'run') AND ("outcome" <> 'failed_start' OR "record_kind" <> 'run')), CONSTRAINT "CHK_standby_records_kind" CHECK ("record_kind" IN ('demand', 'test', 'run')), CONSTRAINT "CHK_standby_records_interval" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"), CONSTRAINT "PK_9fd2e96011ec87b2a9708d98a9c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e32a020c89dbed51d53d26e5fc" ON "standby_records" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_standby_records_unit" ON "standby_records" ("unit_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_standby_records_external_ref" ON "standby_records" ("tenant_id", "external_ref") WHERE "external_ref" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_standby_records_tenant_asset_start" ON "standby_records" ("tenant_id", "asset_id", "started_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "standby_equipment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "asset_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "evaluation" character varying(24) NOT NULL, "notes" text, "effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_standby_equipment_evaluation" CHECK ("evaluation" IN ('demand', 'running', 'demand_and_running')), CONSTRAINT "CHK_standby_equipment_interval" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), CONSTRAINT "PK_d68ac11a2eb8d5a720422ceec9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e014b70e91d35a67b595d17fd5" ON "standby_equipment" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_standby_equipment_unit" ON "standby_equipment" ("unit_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_standby_equipment_current" ON "standby_equipment" ("tenant_id", "asset_id") WHERE "effective_to" IS NULL`,
    );
    for (const table of TABLES) {
      await queryRunner.query(
        `CREATE POLICY tenant_isolation ON "${table}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`DROP POLICY tenant_isolation ON "${table}"`);
    }
    await queryRunner.query(
      `DROP INDEX "public"."UQ_standby_equipment_current"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_standby_equipment_unit"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e014b70e91d35a67b595d17fd5"`,
    );
    await queryRunner.query(`DROP TABLE "standby_equipment"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_standby_records_tenant_asset_start"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_standby_records_external_ref"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_standby_records_unit"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e32a020c89dbed51d53d26e5fc"`,
    );
    await queryRunner.query(`DROP TABLE "standby_records"`);
  }
}
