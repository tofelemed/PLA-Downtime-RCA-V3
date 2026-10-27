import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MQTT PLA feed (plans/MQTT_FEEDS.md): `external_production_reports.source_figures` keeps what the source
 * itself reported (OT planned, actual, shortfall, status, quality, …) for comparison only; accounting never
 * reads it. Nullable column only (expand): existing records and API / file imports have none. The index
 * serves GET /v2/external-production-reports?connectionId= (newest local production date first).
 */
export class ExternalReportSourceFigures1794241101000
  implements MigrationInterface
{
  name = 'ExternalReportSourceFigures1794241101000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "external_production_reports" ADD "source_figures" jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_external_production_reports_connection_date" ON "external_production_reports" ("tenant_id", "connection_id", "local_production_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_external_production_reports_connection_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_production_reports" DROP COLUMN "source_figures"`,
    );
  }
}
