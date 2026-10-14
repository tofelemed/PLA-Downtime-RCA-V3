import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D4 (EXPERT_REVIEW §2.1): a planned stop can carry the approved end of its window
 * (`production_events.planned_end_time`, frozen before the work); time after it is the stop's unplanned
 * overrun. `kpi_metric` gains `downtime_maintenance_overrun`. `down` drops the column; the enum value
 * stays, as in KpiEquivalentDowntime (views read the column).
 */
export class PlannedStopWindow1793920000000 implements MigrationInterface {
  name = 'PlannedStopWindow1793920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "planned_end_time" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_planned_end" CHECK ("planned_end_time" IS NULL OR "planned_end_time" > "start_time")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'downtime_maintenance_overrun' AFTER 'downtime_external'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_planned_end"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "planned_end_time"`,
    );
  }
}
