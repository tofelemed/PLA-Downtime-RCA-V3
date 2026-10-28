import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `event_review_item_kind` gains `source_reason_changed`: the source re-coded a stop that already has a
 * reason code (the code stays the user's; the disagreement is a dismissable review item). Added in its own
 * migration, as `ProductionLossEventKind`: a new enum value cannot be used in the transaction that adds it.
 * `down` leaves the value in place: Postgres cannot drop an enum value while columns use the type, and an
 * unused value is harmless.
 */
export class SourceReasonChangedReviewKind1794242100000
  implements MigrationInterface
{
  name = 'SourceReasonChangedReviewKind1794242100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_review_item_kind" ADD VALUE IF NOT EXISTS 'source_reason_changed'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
