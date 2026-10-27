import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Declared mode: `production_event_physical_type` gains `production_loss` (a day's shortfall declared by
 * the OT system) and `event_review_item_kind` gains the three review kinds of declared figures. Added in
 * their own migration: a new enum value cannot be used in the transaction that adds it, and
 * `ProductionEventDeclaredFigures` (the next migration) names `production_loss` in an index predicate.
 * `down` leaves the values in place, as `GradeTransitionKinds` does: Postgres cannot drop an enum value
 * while columns and partial indexes use the types, and an unused value is harmless.
 */
export class ProductionLossEventKind1794241300000
  implements MigrationInterface
{
  name = 'ProductionLossEventKind1794241300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."production_event_physical_type" ADD VALUE IF NOT EXISTS 'production_loss'`,
    );
    for (const kind of [
      'declared_identity_mismatch',
      'declared_window_mismatch',
      'duplicate_declared_loss',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."event_review_item_kind" ADD VALUE IF NOT EXISTS '${kind}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
