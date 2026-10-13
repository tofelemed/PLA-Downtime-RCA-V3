import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DT-07 (EXPERT_REVIEW, 13 Oct 2026): `kpi_metric` gains `downtime_in_schedule` (stop time inside the
 * schedule, reconciles with scheduled availability) and `downtime_external` (stops classed external).
 * `down` leaves the values in place, as in KpiEquivalentDowntime: Postgres cannot drop an enum value while
 * views read the column (`oee_summaries_v`), and an unused value is harmless; reverting `KpiResults`
 * drops the whole type.
 */
export class KpiScheduleDowntime1793915000000 implements MigrationInterface {
  name = 'KpiScheduleDowntime1793915000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'downtime_in_schedule' AFTER 'downtime_equivalent'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'downtime_external' AFTER 'downtime_in_schedule'`,
    );
  }

  public async down(): Promise<void> {
    // intentionally empty: see the class comment
  }
}
