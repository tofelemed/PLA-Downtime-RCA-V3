import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UX remediation U3 (RCA, additive): the cancellation of a corrective action keeps its reason, who and
 * when (F-9); keyset indexes for the cross-case action list (`GET /v2/rca-actions`, F-7) by owner and
 * due date, and by due date for the whole plant.
 */
export class RcaUxRemediation1794210500000 implements MigrationInterface {
  name = 'RcaUxRemediation1794210500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rca_actions" ADD "cancel_reason" text, ADD "cancelled_by" uuid, ADD "cancelled_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_actions_tenant_owner_due" ON "rca_actions" ("tenant_id", "owner_id", "due_date", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_actions_tenant_due" ON "rca_actions" ("tenant_id", "due_date", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_rca_actions_tenant_due"`);
    await queryRunner.query(`DROP INDEX "IDX_rca_actions_tenant_owner_due"`);
    await queryRunner.query(
      `ALTER TABLE "rca_actions" DROP COLUMN "cancelled_at", DROP COLUMN "cancelled_by", DROP COLUMN "cancel_reason"`,
    );
  }
}
