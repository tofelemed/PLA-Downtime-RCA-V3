import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The plant week may start on any day (owner 21 Oct 2026): `CHK_tenants_week_start` accepts the seven
 * weekday names. `down` folds the new values back to 'monday' (ISO) before restoring the narrow check.
 */
export class TenantWeekStartAnyDay1794241000000 implements MigrationInterface {
  name = 'TenantWeekStartAnyDay1794241000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_week_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_week_start" CHECK ("week_start" IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "tenants" SET "week_start" = 'monday' WHERE "week_start" NOT IN ('monday', 'saturday')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "CHK_tenants_week_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "CHK_tenants_week_start" CHECK ("week_start" IN ('monday', 'saturday'))`,
    );
  }
}
