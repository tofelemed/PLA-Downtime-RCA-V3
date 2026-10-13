import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DT-10 (owner decision 13 Oct 2026): `tenants.week_start` — the first day of the plant's reporting week,
 * 'monday' (ISO 8601, default) or 'saturday'. Iranian plants (plant or site time zone Asia/Tehran, or the
 * Persian calendar) are set to Saturday: the Iranian week runs Saturday–Friday, weekend Thursday–Friday.
 */
export class TenantWeekStart1793916000000 implements MigrationInterface {
  name = 'TenantWeekStart1793916000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "week_start" character varying(16) NOT NULL DEFAULT 'monday'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_week_start" CHECK ("week_start" IN ('monday', 'saturday'))`,
    );
    await queryRunner.query(
      `UPDATE "tenants" t SET "week_start" = 'saturday'
        WHERE t."timezone" = 'Asia/Tehran' OR t."calendar_system" = 'persian'
           OR EXISTS (SELECT 1 FROM "sites" s WHERE s."tenant_id" = t."id" AND s."timezone" = 'Asia/Tehran')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_week_start"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "week_start"`);
  }
}
