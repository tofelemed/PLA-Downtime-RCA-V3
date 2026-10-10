import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.11 step 4 (EXPLAIN review): the Event Hub's default first page — every event of the tenant,
 * newest first (`ORDER BY start_time DESC, id DESC LIMIT 101`) — had no index and was a parallel seq scan
 * plus sort (158 ms at 50 000 events of one tenant on the perf copy). `(tenant_id, start_time, id)` turns
 * it into a backward index scan (1.2 ms); it also serves the v1 list and keyset cursors on start time.
 */
export class ProductionEventsTenantStartIndex1793571200000
  implements MigrationInterface
{
  name = 'ProductionEventsTenantStartIndex1793571200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_start" ON "production_events" ("tenant_id", "start_time", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_tenant_start"`,
    );
  }
}
