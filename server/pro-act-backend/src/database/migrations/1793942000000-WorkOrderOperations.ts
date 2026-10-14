import { MigrationInterface, QueryRunner } from 'typeorm';
import { RLS_POLICY_EXPRESSION } from './1793910000000-RlsPolicyInitPlan';

const TABLE = 'work_order_operations';

/**
 * SME D10 (EXPERT_REVIEW §2.1): CMMS work-order operations with their own start / end and waiting time
 * (parts, permit, crew), linked to the stop they repaired — the evidence of mean active repair time, kept
 * apart from mean time to restore production (the stop). Work-order creation / closure is never stored as
 * repair evidence. One row per work order + operation; RLS `tenant_isolation` (DB-04 form).
 */
export class WorkOrderOperations1793942000000 implements MigrationInterface {
  name = 'WorkOrderOperations1793942000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${TABLE}" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "work_order_id" character varying(100) NOT NULL, "operation_id" character varying(50) NOT NULL, "unit_id" uuid NOT NULL, "asset_id" uuid, "event_id" uuid, "operation_kind" character varying(16) NOT NULL, "description" text, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "waiting_seconds" integer NOT NULL DEFAULT '0', "waiting_reason" character varying(100), "source" character varying(50) NOT NULL DEFAULT 'import', CONSTRAINT "CHK_work_order_operations_waiting" CHECK ("waiting_seconds" >= 0), CONSTRAINT "CHK_work_order_operations_kind" CHECK ("operation_kind" IN ('diagnosis', 'repair', 'test', 'other')), CONSTRAINT "CHK_work_order_operations_interval" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"), CONSTRAINT "PK_8610d0dbf2b2145d9933bad5263" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68ad038635e2343241e4c85215" ON "${TABLE}" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_order_operations_tenant_asset_start" ON "${TABLE}" ("tenant_id", "asset_id", "started_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_order_operations_tenant_event" ON "${TABLE}" ("tenant_id", "event_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_work_order_operations_operation" ON "${TABLE}" ("tenant_id", "work_order_id", "operation_id") `,
    );
    await queryRunner.query(
      `CREATE POLICY tenant_isolation ON "${TABLE}" USING (${RLS_POLICY_EXPRESSION}) WITH CHECK (${RLS_POLICY_EXPRESSION})`,
    );
    await queryRunner.query(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY tenant_isolation ON "${TABLE}"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_work_order_operations_operation"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_work_order_operations_tenant_event"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_work_order_operations_tenant_asset_start"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68ad038635e2343241e4c85215"`,
    );
    await queryRunner.query(`DROP TABLE "${TABLE}"`);
  }
}
