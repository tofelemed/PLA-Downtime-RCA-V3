import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME R9: a `reversal` reconciliation line names the approved line it reverses (`reverses_line_id` →
 * `approved_loss_lines`, RESTRICT: an approved line is never deleted while a reversal cites it), with a
 * partial index for the "already reversed" sums. Existing lines have none.
 */
export class ReversalLines1794130003000 implements MigrationInterface {
  name = 'ReversalLines1794130003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" ADD "reverses_line_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "FK_reconciliation_lines_reverses_line" ` +
        `FOREIGN KEY ("reverses_line_id") REFERENCES "approved_loss_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reconciliation_lines_reverses_line" ON "reconciliation_lines" ("reverses_line_id") ` +
        `WHERE "reverses_line_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reconciliation_lines_reverses_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" DROP CONSTRAINT "FK_reconciliation_lines_reverses_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" DROP COLUMN "reverses_line_id"`,
    );
  }
}
