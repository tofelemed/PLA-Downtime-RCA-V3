import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LA-05 / DT-01 (SME Q5, 13 Oct 2026): `kpi_metric` gains `downtime_equivalent` — the rate lost by
 * partial-impact events expressed as time at the reference rate, kept apart from stopped time.
 * `down` leaves the value in place: Postgres cannot drop an enum value while views read the column
 * (`oee_summaries_v`), and an unused value is harmless; reverting `KpiResults` drops the whole type.
 */
export class KpiEquivalentDowntime1793912000000 implements MigrationInterface {
  name = 'KpiEquivalentDowntime1793912000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'downtime_equivalent' AFTER 'downtime_unplanned'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
