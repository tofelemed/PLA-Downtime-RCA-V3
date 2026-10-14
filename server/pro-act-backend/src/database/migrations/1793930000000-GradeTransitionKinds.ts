import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LA-08 (SME Q9 / Q10 / E1): grade transitions become their own events and loss kinds —
 * `production_event_physical_type` gains `grade_transition`, `loss_line_kind` gains
 * `transition_allowance` (within the approved transition standard) and `transition_excess` (beyond
 * it, or without one). Added in their own migration: a new enum value cannot be used in the
 * transaction that adds it, and `GradeTransitionStandards` never names it.
 * `down` leaves the values in place, as `KpiEquivalentDowntime` does: Postgres cannot drop an enum
 * value while views read the columns, an unused value is harmless, and reverting
 * `EventIntervalModel` / `AccountingEngine` drops the whole types.
 */
export class GradeTransitionKinds1793930000000 implements MigrationInterface {
  name = 'GradeTransitionKinds1793930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."production_event_physical_type" ADD VALUE IF NOT EXISTS 'grade_transition'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."loss_line_kind" ADD VALUE IF NOT EXISTS 'transition_allowance'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."loss_line_kind" ADD VALUE IF NOT EXISTS 'transition_excess'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
