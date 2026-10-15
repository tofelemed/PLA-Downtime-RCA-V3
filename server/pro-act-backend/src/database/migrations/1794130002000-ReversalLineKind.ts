import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME R9: `loss_line_kind` gains `reversal` — an evidence-backed reversal of an erroneous approved line of an
 * earlier period. In its own migration: a new enum value cannot be used in the transaction that adds it.
 * `down` leaves the value in place, as `GradeTransitionKinds` does: Postgres cannot drop an enum value
 * while views read the columns, an unused value is harmless, and reverting `AccountingEngine` drops the
 * whole type.
 */
export class ReversalLineKind1794130002000 implements MigrationInterface {
  name = 'ReversalLineKind1794130002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."loss_line_kind" ADD VALUE IF NOT EXISTS 'reversal'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
