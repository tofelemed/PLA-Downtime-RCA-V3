import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes of the analytics reads (plan 3.6, docs/UI_UX_AUDIT.md finding 6):
 * - `loss_lines (run_id, ledger, kind)`: the period states of a report scope load the plan candidates of
 *   up to 500 runs at once (`run_id = ANY(…) AND ledger = 'plan'`); the only run index is the partial
 *   `(run_id, auto_key)`, so every page was a sequential scan (91 ms → 1.4 ms per page, Demo Plant month);
 * - `(tenant_id, created_at)` on `rcas`, `tasks` and `audit_logs`: the Reports activity summary counts the
 *   records a tenant created in a window (`GET /v2/reports/activity-summary`).
 */
export class PlaReportIndexes1793902000000 implements MigrationInterface {
  name = 'PlaReportIndexes1793902000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_loss_lines_run_ledger_kind" ON "loss_lines" ("run_id", "ledger", "kind")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_rcas_tenant_created" ON "rcas" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_tenant_created" ON "tasks" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_tenant_created" ON "audit_logs" ("tenant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_tenant_created"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_rcas_tenant_created"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_loss_lines_run_ledger_kind"`,
    );
  }
}
