import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SME D15: `kpi_metric` gains `controllable_availability` (scheduled availability without stops classed
 * external, its own name; the headline availability keeps them). `down` leaves the enum value in place
 * (Postgres cannot drop an enum value while views read the column), like UnitStateMappings.
 */
export class ControllableAvailabilityMetric1794150100000
  implements MigrationInterface
{
  name = 'ControllableAvailabilityMetric1794150100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."kpi_metric" ADD VALUE IF NOT EXISTS 'controllable_availability'`,
    );
  }

  /** kpi_results rows are immutable and the value stays valid, so nothing is undone. */
  public async down(): Promise<void> {
    await Promise.resolve();
  }
}
