import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB audit F04 (docs/db-audit/AUDIT_REPORT.md): the state engine (every minute per mapped unit,
 * `derived-stop-window.ts` NEW_SAMPLES_SQL) and the period sweep (every 5 min, LATE_STATE_SAMPLES) ask
 * for a signal's samples stored after a cursor (`inserted_at > $x`). The identity key (signal_id,
 * observed_at, source_revision) cannot bound `inserted_at`, so each tick read the whole month partition.
 *
 * Created on the partitioned parent, so every existing and future monthly partition gets it.
 * Lock: SHARE on each partition while it builds (blocks sample inserts, not reads); at 3.2k rows this
 * takes milliseconds. On a large database build it online first (it is then a no-op here):
 *   CREATE INDEX ... ON ONLY "measurement_samples" (...);
 *   CREATE INDEX CONCURRENTLY ... ON <each partition> (...);  ALTER INDEX ... ATTACH PARTITION ...;
 */
export class MeasurementSamplesInsertedIndex1794240600000
  implements MigrationInterface
{
  name = 'MeasurementSamplesInsertedIndex1794240600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_measurement_samples_signal_inserted" ON "measurement_samples" ("signal_id", "inserted_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_measurement_samples_signal_inserted"`,
    );
  }
}
