import { MigrationInterface, QueryRunner } from 'typeorm';

const CLASSES_UP = `'minor', 'significant', 'major', 'critical'`;
const CLASSES_DOWN = `'minor', 'significant', 'major'`;

/**
 * Tier 2 item 2.7 / D-T4: the investigation depth matrix has four consequence classes; `critical` (logic
 * tree plus FMEA or fault tree, team charter, coded causes, independent closure) joins minor, significant
 * (the moderate tier) and major. Down folds critical cases into major, the closest earlier class.
 */
export class RcaCriticalConsequenceClass1794240210000
  implements MigrationInterface
{
  name = 'RcaCriticalConsequenceClass1794240210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rcas" DROP CONSTRAINT "CHK_rcas_consequence_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" ADD CONSTRAINT "CHK_rcas_consequence_class"
         CHECK ("consequence_class" IS NULL OR "consequence_class" IN (${CLASSES_UP}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rcas" SET "consequence_class" = 'major' WHERE "consequence_class" = 'critical'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" DROP CONSTRAINT "CHK_rcas_consequence_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rcas" ADD CONSTRAINT "CHK_rcas_consequence_class"
         CHECK ("consequence_class" IS NULL OR "consequence_class" IN (${CLASSES_DOWN}))`,
    );
  }
}
