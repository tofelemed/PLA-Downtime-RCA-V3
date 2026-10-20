import { MigrationInterface, QueryRunner } from 'typeorm';

const IS_WEIGHT_LIST = (column: string) =>
  `"${column}" IS NULL OR jsonb_typeof("${column}") = 'array'`;

/**
 * Tier 2 item 2.8 / D-T5 weighted multi-reason stops: the effective weighted reasons of an event
 * (`production_events.reason_weights`) and the weights of each coding revision
 * (`event_coding.reason_weights`), both `[{reasonCodeId, weight}]` with 8-place weights adding up to 1;
 * null = the single `reason_code_id`. Nullable columns only (expand): existing rows stay unweighted.
 */
export class WeightedReasonStops1794240400000 implements MigrationInterface {
  name = 'WeightedReasonStops1794240400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "reason_weights" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_reason_weights"
         CHECK (${IS_WEIGHT_LIST('reason_weights')})`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD "reason_weights" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" ADD CONSTRAINT "CHK_event_coding_reason_weights"
         CHECK (${IS_WEIGHT_LIST('reason_weights')})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP CONSTRAINT "CHK_event_coding_reason_weights"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_coding" DROP COLUMN "reason_weights"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_reason_weights"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "reason_weights"`,
    );
  }
}
