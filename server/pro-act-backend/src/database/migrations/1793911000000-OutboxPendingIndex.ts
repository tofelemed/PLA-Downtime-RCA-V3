import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB-07 (EXPERT_REVIEW, 13 Oct 2026): the relay polls pending messages every second; its index now covers
 * pending rows only (`next_attempt_at, id`), so the published history does not grow it.
 */
export class OutboxPendingIndex1793911000000 implements MigrationInterface {
  name = 'OutboxPendingIndex1793911000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_outbox_state_next_attempt"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_pending_next_attempt" ON "outbox" ("next_attempt_at", "id") WHERE "state" = 'pending'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_outbox_pending_next_attempt"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_state_next_attempt" ON "outbox" ("state", "next_attempt_at") `,
    );
  }
}
