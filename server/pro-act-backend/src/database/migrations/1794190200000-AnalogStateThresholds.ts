import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 1.10 analog state mapping (DT01): `unit_state_mappings.thresholds` — stop / reduced-rate
 * thresholds with a hysteresis band, the stop state an analog stop maps to and the signal's rated value
 * (the reduced-rate slowdown's fraction lost). Null on every existing version: rules only, as before.
 */
export class AnalogStateThresholds1794190200000 implements MigrationInterface {
  name = 'AnalogStateThresholds1794190200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit_state_mappings" ADD "thresholds" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit_state_mappings" DROP COLUMN "thresholds"`,
    );
  }
}
