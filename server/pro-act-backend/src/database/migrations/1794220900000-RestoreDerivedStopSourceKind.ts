import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data repair (Marun E2E, DECISIONS 2026-10-18): coding or revising a state-engine stop re-derived its
 * `source_kind` from the `source` label ("State engine" → `source`), so the engine no longer saw the stop as
 * its own. Rows the state engine wrote are recognisable by their business id `state:<unit>:<state>@<ms>`
 * and source label; they are set back to `derived`. Idempotent. `down` is a no-op: the wrong value is not
 * worth restoring and which rows held it is not recorded.
 */
export class RestoreDerivedStopSourceKind1794220900000
  implements MigrationInterface
{
  name = 'RestoreDerivedStopSourceKind1794220900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "production_events" SET "source_kind" = 'derived'
        WHERE "source" = 'State engine' AND "event_id" LIKE 'state:%' AND "source_kind" <> 'derived'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
