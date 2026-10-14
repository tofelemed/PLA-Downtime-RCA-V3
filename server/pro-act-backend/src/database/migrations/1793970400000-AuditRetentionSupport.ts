import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit_log` stays append-only except for a retention delete: a DELETE passes only when the
 * transaction declared `app.audit_retention_cutoff` (set_config(…, true), DataRetentionService) and the
 * row is older than it. UPDATE is always refused, as before.
 */
const AUDIT_LOG_FUNCTION =
  `CREATE FUNCTION "audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
  `DECLARE cutoff text := current_setting('app.audit_retention_cutoff', true); BEGIN ` +
  `IF TG_OP = 'DELETE' AND cutoff IS NOT NULL AND cutoff <> '' AND OLD."at" < cutoff::timestamptz THEN RETURN OLD; END IF; ` +
  `RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME; END $fn$`;

/**
 * DB-07 (expert review), retention support for the two audit tables. The windows are not chosen yet
 * (owner), so the job is disabled by default; this adds what an enabled run needs: time indexes for
 * the oldest-first batches (the existing indexes lead with `tenant_id` and cannot bound a global
 * `time < cutoff` scan) and the retention exception of the `audit_log` append-only trigger.
 */
export class AuditRetentionSupport1793970400000 implements MigrationInterface {
  name = 'AuditRetentionSupport1793970400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_at" ON "audit_log" ("at") `,
    );
    await queryRunner.query(AUDIT_LOG_FUNCTION);
    await queryRunner.query(
      `DROP TRIGGER "trg_audit_log_append_only" ON "audit_log"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_audit_log_append_only" BEFORE UPDATE OR DELETE ON "audit_log" ` +
        `FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_audit_log_append_only" ON "audit_log"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_audit_log_append_only" BEFORE UPDATE OR DELETE ON "audit_log" ` +
        `FOR EACH ROW EXECUTE FUNCTION "workflow_rows_append_only"()`,
    );
    await queryRunner.query(`DROP FUNCTION "audit_log_append_only"()`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_timestamp"`);
  }
}
