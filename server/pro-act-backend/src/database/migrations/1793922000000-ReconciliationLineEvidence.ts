import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME R7 / R8 / R11 (EXPERT_REVIEW §3.1): a reconciliation line carries the category of an Unaccounted or
 * bridge line (`classification`) and the record a manual quantity rests on when no event or approved
 * adjustment backs it (`evidence_type`, `evidence_ref`). Existing lines keep null.
 */
export class ReconciliationLineEvidence1793922000000
  implements MigrationInterface
{
  name = 'ReconciliationLineEvidence1793922000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" ADD "classification" character varying(32), ` +
        `ADD "evidence_type" character varying(32), ADD "evidence_ref" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reconciliation_lines" DROP COLUMN "evidence_ref", DROP COLUMN "evidence_type", DROP COLUMN "classification"`,
    );
  }
}
