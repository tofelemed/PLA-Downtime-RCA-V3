import { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_TRIGGERS = [
  'event_change',
  'actuals_change',
  'plan_change',
  'rate_change',
  'calendar_change',
  'source_retraction',
  'recalculation',
];

/**
 * Area 3 leftover (EXPERT_REVIEW §3, SME R4): a correction of an approved period in a locked or closing month
 * can be proposed by a user (`manual_correction`), not only by the system. `down` maps manual proposals to
 * `recalculation` (their reason and evidence stay in `detail.manual`) and rebuilds the enum without the value.
 */
export class ManualChangeProposal1794060000000 implements MigrationInterface {
  name = 'ManualChangeProposal1794060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."period_change_trigger" ADD VALUE IF NOT EXISTS 'manual_correction'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = PREVIOUS_TRIGGERS.map((v) => `'${v}'`).join(', ');
    await queryRunner.query(
      `UPDATE "period_change_proposals" SET "trigger" = 'recalculation' WHERE "trigger" = 'manual_correction'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."period_change_trigger" RENAME TO "period_change_trigger_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."period_change_trigger" AS ENUM (${values})`,
    );
    await queryRunner.query(
      `ALTER TABLE "period_change_proposals" ALTER COLUMN "trigger" TYPE "public"."period_change_trigger" ` +
        `USING "trigger"::text::"public"."period_change_trigger"`,
    );
    await queryRunner.query(`DROP TYPE "public"."period_change_trigger_old"`);
  }
}
