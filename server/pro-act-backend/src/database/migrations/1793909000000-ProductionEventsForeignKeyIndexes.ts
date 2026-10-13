import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB-10 (EXPERT_REVIEW, 13 Oct 2026): partial indexes on the foreign keys of `production_events` that
 * deleting a plan, an impact / OEE code or an RCA case checks (`ON DELETE SET NULL` / `RESTRICT`), so
 * those deletes stop scanning every event. NULL references are not indexed.
 */
export class ProductionEventsForeignKeyIndexes1793909000000
  implements MigrationInterface
{
  name = 'ProductionEventsForeignKeyIndexes1793909000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_rca" ON "production_events" ("rca_id") WHERE "rca_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_oee_code" ON "production_events" ("oee_code_id") WHERE "oee_code_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_impact_code" ON "production_events" ("impact_code_id") WHERE "impact_code_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_plan" ON "production_events" ("plan_id") WHERE "plan_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_production_events_plan"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_impact_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_oee_code"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_production_events_rca"`);
  }
}
