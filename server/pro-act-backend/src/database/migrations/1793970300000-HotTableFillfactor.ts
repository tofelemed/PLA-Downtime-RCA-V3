import { MigrationInterface, QueryRunner } from 'typeorm';

/** Update-heavy tables whose updates leave every indexed column alone (HOT-eligible). */
const HOT_TABLES = ['ingestion_jobs', 'inbox', 'idempotency_keys'];

/**
 * DB-11 (expert review): free space per heap page so frequent in-place updates stay HOT (no new index
 * entries, less bloat) as the tables grow. Chosen from `pg_stat_user_tables` on the dev database:
 * `ingestion_jobs` 3 978 updates on 53 rows (98 % HOT, heartbeats / cursors), `inbox` 489 (98 % HOT),
 * `idempotency_keys` 530 (62 % HOT). Not set where updates change an indexed column — `outbox`
 * (`state` in the pending partial index), `actuals_jobs`, `plan_generation_jobs`, `export_jobs`
 * (`state, created_at` indexes): those updates can never be HOT, so free space would only waste pages.
 * Applies to pages written from now on.
 */
export class HotTableFillfactor1793970300000 implements MigrationInterface {
  name = 'HotTableFillfactor1793970300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of HOT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" SET (fillfactor = 80)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of HOT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" RESET (fillfactor)`);
    }
  }
}
