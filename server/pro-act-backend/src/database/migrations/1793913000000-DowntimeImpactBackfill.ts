import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LA-05 (SME Q5, 13 Oct 2026): the engine now honours `impact_mode` on downtime — `none` = equipment event
 * without production loss, `fractional` = rate loss, anything else = stopped time. Until now downtime was
 * always stopped time and events entered through v2 without an impact stored the advisory default `none`,
 * so those rows are set to `full_stop`: every existing result stays as it was. `row_version` is not
 * touched (no recalculation, no restatement). `down` is a no-op: which rows were `none` is not kept.
 */
export class DowntimeImpactBackfill1793913000000 implements MigrationInterface {
  name = 'DowntimeImpactBackfill1793913000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "production_events" SET "impact_mode" = 'full_stop'
        WHERE "physical_type" = 'downtime' AND "impact_mode" = 'none'`,
    );
  }

  public async down(): Promise<void> {
    // no-op: the previous value was the meaningless default `none`, see the class comment
  }
}
