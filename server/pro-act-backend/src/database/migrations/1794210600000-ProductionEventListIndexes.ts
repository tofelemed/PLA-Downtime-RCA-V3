import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UX audit E-1 / E-7 (plans/UX_REMEDIATION.md Phase U3): indexes of the new v2 event list options.
 * - `sort=durationSeconds|-durationSeconds` and `minDurationSeconds`: the sort key is the stored duration
 *   with running events (no end) as the longest — the expression must stay identical to `sortKeyOf()` in
 *   `src/v2/production-events/production-event-sort.ts` for the planner to use the index.
 * - `verificationStates=verified`: verified events of the tenant, newest first (`not_verified` stops are
 *   served by `IDX_production_events_unverified_stops`).
 */
export class ProductionEventListIndexes1794210600000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_duration" ON "production_events" ` +
        `("tenant_id", (COALESCE("duration_seconds", CAST('Infinity' AS numeric))), "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_verified" ON "production_events" ` +
        `("tenant_id", "start_time", "id") WHERE "verified_at" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_production_events_tenant_verified"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_production_events_tenant_duration"',
    );
  }
}
