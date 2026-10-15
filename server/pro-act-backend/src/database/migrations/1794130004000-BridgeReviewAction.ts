import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME R8: `approval_action_kind` gains `bridge_review` — the second independent review of bridges above the
 * unit limit, recorded on the submission it reviews. `down` leaves the value in place (Postgres cannot drop
 * an enum value in use; an unused value is harmless), as `ReversalLineKind` does.
 */
export class BridgeReviewAction1794130004000 implements MigrationInterface {
  name = 'BridgeReviewAction1794130004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."approval_action_kind" ADD VALUE IF NOT EXISTS 'bridge_review'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
