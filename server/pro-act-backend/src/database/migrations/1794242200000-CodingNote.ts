import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner decision 2026-10-30: the coder may add a free-text note beside the reason code(s) — what happened in
 * their own words — without replacing the code (codes drive the Pareto and the loss lines; the note is for
 * the reader and for the RCA). One nullable text column; no index (never filtered).
 */
export class CodingNote1794242200000 implements MigrationInterface {
  name = 'CodingNote1794242200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD COLUMN IF NOT EXISTS "coding_note" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN IF EXISTS "coding_note"`,
    );
  }
}
