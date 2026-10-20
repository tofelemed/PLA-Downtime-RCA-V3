import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tier 2 item 2.2 / D-T3: the recurrence watch of closed cases records a `reevaluate` recommendation fired
 * after the closure (`fired_on = 'after_closure'`). The index serves the watch's "already recommended in this
 * window" check and the case's own recommendations (`rca_id` is a foreign key without an index so far).
 * Down removes the watch recommendations (they cannot exist without the enum value) and the value.
 */
export class RcaRecurrenceWatch1794240200000 implements MigrationInterface {
  name = 'RcaRecurrenceWatch1794240200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "rca_trigger_fired_on" ADD VALUE IF NOT EXISTS 'after_closure'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rca_trigger_evaluations_rca" ON "rca_trigger_evaluations" ("tenant_id", "rca_id", "trigger")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_rca_trigger_evaluations_rca"`,
    );
    await queryRunner.query(
      `DELETE FROM "rca_trigger_evaluations" WHERE "fired_on" = 'after_closure'`,
    );
    await queryRunner.query(
      `ALTER TYPE "rca_trigger_fired_on" RENAME TO "rca_trigger_fired_on_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "rca_trigger_fired_on" AS ENUM ('threshold_crossed_open', 'closed', 'approved')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rca_trigger_evaluations" ALTER COLUMN "fired_on" TYPE "rca_trigger_fired_on"
         USING "fired_on"::text::"rca_trigger_fired_on"`,
    );
    await queryRunner.query(`DROP TYPE "rca_trigger_fired_on_old"`);
  }
}
