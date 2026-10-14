import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D3 (EXPERT_REVIEW §2.1): a stop can name the unit and asset whose failure caused it — the extruder
 * starved by a reactor trip keeps the stop in its own availability, coded external, with the reactor as
 * origin. Both columns are optional (null = the event's own unit), restrict deletes, and are indexed
 * for the origin breakdowns.
 */
export class EventOrigin1793919000000 implements MigrationInterface {
  name = 'EventOrigin1793919000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "origin_unit_id" uuid, ADD "origin_asset_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "FK_production_events_origin_unit" FOREIGN KEY ("origin_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "FK_production_events_origin_asset" FOREIGN KEY ("origin_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_origin_unit" ON "production_events" ("origin_unit_id") WHERE "origin_unit_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_origin_asset" ON "production_events" ("origin_asset_id") WHERE "origin_asset_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_origin_asset"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_origin_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "FK_production_events_origin_asset"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "FK_production_events_origin_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "origin_asset_id", DROP COLUMN "origin_unit_id"`,
    );
  }
}
