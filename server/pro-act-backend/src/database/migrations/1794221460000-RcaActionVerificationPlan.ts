import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CA4 verification plan of an action (Marun E2E, additive): how its completion is verified
 * (`verification_method`, free text) and the named verifier (`verifier_id`, a member of the plant who is
 * not the owner; checked by the service like the owner). An RCA `loss_line` link may target an approved
 * manual line by its id (`approved_loss_lines.source_id`), so that column is indexed with the tenant.
 */
export class RcaActionVerificationPlan1794221460000
  implements MigrationInterface
{
  name = 'RcaActionVerificationPlan1794221460000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rca_actions" ADD "verification_method" text, ADD "verifier_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approved_loss_lines_tenant_source" ON "approved_loss_lines" ("tenant_id", "source_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_approved_loss_lines_tenant_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_actions" DROP COLUMN "verifier_id", DROP COLUMN "verification_method"`,
    );
  }
}
