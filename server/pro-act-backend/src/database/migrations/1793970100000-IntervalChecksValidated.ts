import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Validates `constraint` on `table` when it is still NOT VALID and no row breaks `violation`; otherwise
 * leaves it NOT VALID (new and updated rows are still checked) and raises a WARNING with the count, so a
 * database with legacy rows migrates and the rows are reported instead of being changed here.
 */
const validateWhenClean = (
  table: string,
  constraint: string,
  violation: string,
) =>
  `DO $do$ DECLARE bad bigint; BEGIN ` +
  `IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"${table}"'::regclass ` +
  `AND conname = '${constraint}' AND NOT convalidated) THEN ` +
  `SELECT count(*) INTO bad FROM "${table}" WHERE ${violation}; ` +
  `IF bad = 0 THEN ALTER TABLE "${table}" VALIDATE CONSTRAINT "${constraint}"; ` +
  `ELSE RAISE WARNING '% stays NOT VALID: % row(s) of % break it', '${constraint}', bad, '${table}'; END IF; ` +
  `END IF; END $do$`;

/**
 * DB-11 (expert review), interval checks:
 * - `CHK_production_events_interval` was added NOT VALID by `EventIntervalModel` and validated only when no
 *   legacy row broke it; databases migrated with such rows kept it unvalidated. Validated now when clean
 *   (VALIDATE takes only a SHARE UPDATE EXCLUSIVE lock).
 * - `loss_lines` had no `segment_end > segment_start` check: every engine segment is a positive clip of a
 *   `[start, end)` claim or window (0 of 106 923 dev rows break it). Added NOT VALID, then validated.
 * `down` drops the new loss line check; a validated event check stays validated (validation only proves
 * the data, it changes nothing that a revert would need back).
 */
export class IntervalChecksValidated1793970100000
  implements MigrationInterface
{
  name = 'IntervalChecksValidated1793970100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      validateWhenClean(
        'production_events',
        'CHK_production_events_interval',
        '"end_time" <= "start_time"',
      ),
    );
    await queryRunner.query(
      `ALTER TABLE "loss_lines" ADD CONSTRAINT "CHK_loss_lines_segment" ` +
        `CHECK ("segment_end" > "segment_start") NOT VALID`,
    );
    await queryRunner.query(
      validateWhenClean(
        'loss_lines',
        'CHK_loss_lines_segment',
        '"segment_end" <= "segment_start"',
      ),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loss_lines" DROP CONSTRAINT "CHK_loss_lines_segment"`,
    );
  }
}
