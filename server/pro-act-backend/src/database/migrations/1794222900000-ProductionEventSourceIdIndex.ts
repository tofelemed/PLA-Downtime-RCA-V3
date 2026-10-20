import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PI / MQTT ingest looks up the event of every source record by `(tenant_id, event_id)`
 * (`PiFrameIngestService.store`); without an index each frame scanned the tenant's events. Partial: manual
 * events carry no source id.
 */
export class ProductionEventSourceIdIndex1794222900000
  implements MigrationInterface
{
  name = 'ProductionEventSourceIdIndex1794222900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_event_id" ON "production_events" ("tenant_id", "event_id") WHERE "event_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_tenant_event_id"`,
    );
  }
}
