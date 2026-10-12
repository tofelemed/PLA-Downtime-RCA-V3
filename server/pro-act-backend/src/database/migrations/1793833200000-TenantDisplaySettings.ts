import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tenant display settings (UI/UX audit §10, Option A): how dates and digits are shown for a plant.
 * - `tenants.calendar_system`: 'gregorian' (default) or 'persian' (Solar Hijri);
 * - `tenants.digits`: 'latin' (default) or 'persian'.
 * Display only: stored instants, bucket keys and exports stay UTC / ISO Gregorian.
 */
export class TenantDisplaySettings1793833200000 implements MigrationInterface {
  name = 'TenantDisplaySettings1793833200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "calendar_system" character varying(16) NOT NULL DEFAULT 'gregorian'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "digits" character varying(8) NOT NULL DEFAULT 'latin'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_calendar_system" CHECK ("calendar_system" IN ('gregorian', 'persian'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_digits" CHECK ("digits" IN ('latin', 'persian'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_digits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_calendar_system"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "digits"`);
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "calendar_system"`,
    );
  }
}
