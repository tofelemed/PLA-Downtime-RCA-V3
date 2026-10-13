import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB-01 (EXPERT_REVIEW, 13 Oct 2026): a GiST index on each live event's half-open span per unit, so the
 * period loaders' overlap lookups (`tstzrange(start, end) && window`) read only the events touching the
 * window instead of every earlier event of the unit. `CHK_production_events_interval` (end > start) keeps
 * every range valid; btree_gist (installed with the calendar exclusions) indexes the uuid column.
 */
export class ProductionEventsSpanIndex1793908000000
  implements MigrationInterface
{
  name = 'ProductionEventsSpanIndex1793908000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_unit_span" ON "production_events" USING gist ` +
        `("unit_id", tstzrange("start_time", "end_time", '[)')) ` +
        `WHERE "physical_state" IN ('open', 'closed')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_unit_span"`,
    );
  }
}
