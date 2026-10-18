import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UX D-2 (plans/UX_REMEDIATION.md): the rate a rate-based loss line was computed with — the plan ledger's
 * planning rate scaled to the slice target (SME Q1), else the rate version's value — and its timebase.
 * Expand only: nullable, lines of earlier runs stay null (loss lines are immutable, never backfilled).
 */
export class LossLineAppliedRate1794220700000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loss_lines" ADD "applied_rate" numeric, ADD "applied_rate_timebase" character varying(8)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loss_lines" DROP COLUMN "applied_rate_timebase", DROP COLUMN "applied_rate"`,
    );
  }
}
