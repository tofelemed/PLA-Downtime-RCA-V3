import { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_TRIGGERS = [
  'event_change',
  'actuals_change',
  'plan_change',
  'rate_change',
  'calendar_change',
  'source_retraction',
  'recalculation',
  'manual_correction',
];

/**
 * Marun E2E (SME V7): a change proposal opened by an approved FX rate, valuation policy or demand status
 * is a `valuation_change`, no longer read as a rate change. Expand only: existing proposals keep their
 * trigger. `down` maps valuation proposals back to `rate_change` (what they were recorded as before) and
 * rebuilds the enum without the value.
 */
export class ValuationChangeTrigger1794221550000 implements MigrationInterface {
  name = 'ValuationChangeTrigger1794221550000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."period_change_trigger" ADD VALUE IF NOT EXISTS 'valuation_change'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = PREVIOUS_TRIGGERS.map((v) => `'${v}'`).join(', ');
    await queryRunner.query(
      `UPDATE "period_change_proposals" SET "trigger" = 'rate_change' WHERE "trigger" = 'valuation_change'`,
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
