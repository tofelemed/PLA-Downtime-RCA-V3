import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D12 (EXPERT_REVIEW §2.1): `kpi_metric` gains `coded_downtime_ratio` — stop time with a reason code
 * over all stop time, the coding-coverage measure. `down` leaves the value in place, as in
 * KpiEquivalentDowntime: Postgres cannot drop an enum value while views read the column.
 */
export class KpiCodedDowntime1793918000000 implements MigrationInterface {
  name = 'KpiCodedDowntime1793918000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'coded_downtime_ratio' AFTER 'downtime_external'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
