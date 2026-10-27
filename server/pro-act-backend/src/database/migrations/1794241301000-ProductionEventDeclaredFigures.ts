import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Declared mode: `production_events.declared_figures` (OT planned, actual, shortfall and provenance of a
 * `production_loss` event; nullable, expand only) and the partial index that serves the unit's live
 * production loss events by start (duplicate-window check, declared ledger). The predicate is
 * `declared_figures IS NOT NULL` (only production loss events carry figures) and not
 * `physical_type = 'production_loss'`: the new enum value cannot be used in the transaction that added it,
 * and migrations may run in one transaction. Queries that want the index add the same condition.
 */
export class ProductionEventDeclaredFigures1794241301000
  implements MigrationInterface
{
  name = 'ProductionEventDeclaredFigures1794241301000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "declared_figures" jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_declared" ON "production_events" ("tenant_id", "unit_id", "start_time") WHERE "declared_figures" IS NOT NULL AND "retracted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_declared"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "declared_figures"`,
    );
  }
}
