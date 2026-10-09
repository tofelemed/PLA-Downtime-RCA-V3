import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables, indexes and foreign keys of plan 2.9 (generated from the entities, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `CREATE TYPE "public"."export_report_type" AS ENUM('period_summary', 'loss_lines')`,
  `CREATE TYPE "public"."export_format" AS ENUM('csv')`,
  `CREATE TYPE "public"."export_revision_selector" AS ENUM('published', 'revision_ids')`,
  `CREATE TYPE "public"."export_job_state" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled')`,
  `CREATE TABLE "export_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "report_type" "public"."export_report_type" NOT NULL, "format" "public"."export_format" NOT NULL, "revision_selector" "public"."export_revision_selector" NOT NULL, "filters" jsonb NOT NULL, "unit_ids" uuid array, "requested_by" uuid NOT NULL, "state" "public"."export_job_state" NOT NULL DEFAULT 'queued', "counts" jsonb NOT NULL, "partial" boolean NOT NULL DEFAULT false, "cancel_requested" boolean NOT NULL DEFAULT false, "object_key" character varying(255), "content_hash" character varying(64), "size_bytes" bigint, "row_count" integer, "generated_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "download_count" integer NOT NULL DEFAULT '0', "error_code" character varying(64), "error_message" text, "attempts" integer NOT NULL DEFAULT '0', "lease_owner" character varying(128), "lease_expiry" TIMESTAMP WITH TIME ZONE, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3044ce6f1c6af24058ee609e063" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_12376c181edbdcc0bfa1f432e2" ON "export_jobs" ("tenant_id") `,
  `CREATE INDEX "IDX_export_jobs_expires" ON "export_jobs" ("expires_at") WHERE "object_key" IS NOT NULL`,
  `CREATE INDEX "IDX_export_jobs_state_created" ON "export_jobs" ("state", "created_at") `,
  `CREATE INDEX "IDX_export_jobs_tenant_created" ON "export_jobs" ("tenant_id", "created_at") `,
  `CREATE TABLE "export_job_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "export_job_id" uuid NOT NULL, "position" integer NOT NULL, "period_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "unit_name" character varying(255), "revision_id" uuid NOT NULL, "snapshot_id" uuid NOT NULL, "slice_products" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_1d5c6273964ed5f4eedc5211182" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_export_job_sources_snapshot" ON "export_job_sources" ("snapshot_id") `,
  `CREATE INDEX "IDX_export_job_sources_revision" ON "export_job_sources" ("revision_id") `,
  `CREATE UNIQUE INDEX "UQ_export_job_sources_job_position" ON "export_job_sources" ("export_job_id", "position") `,
  `CREATE INDEX "IDX_accounting_revisions_tenant_approved" ON "accounting_revisions" ("tenant_id", "approved_at") WHERE "lifecycle" = 'approved'`,
  `ALTER TABLE "export_job_sources" ADD CONSTRAINT "FK_export_job_sources_job" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "export_job_sources" ADD CONSTRAINT "FK_export_job_sources_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "export_job_sources" ADD CONSTRAINT "FK_export_job_sources_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "approval_snapshots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "export_job_sources" DROP CONSTRAINT "FK_export_job_sources_snapshot"`,
  `ALTER TABLE "export_job_sources" DROP CONSTRAINT "FK_export_job_sources_revision"`,
  `ALTER TABLE "export_job_sources" DROP CONSTRAINT "FK_export_job_sources_job"`,
  `DROP INDEX "public"."IDX_accounting_revisions_tenant_approved"`,
  `DROP INDEX "public"."UQ_export_job_sources_job_position"`,
  `DROP INDEX "public"."IDX_export_job_sources_revision"`,
  `DROP INDEX "public"."IDX_export_job_sources_snapshot"`,
  `DROP TABLE "export_job_sources"`,
  `DROP INDEX "public"."IDX_export_jobs_tenant_created"`,
  `DROP INDEX "public"."IDX_export_jobs_state_created"`,
  `DROP INDEX "public"."IDX_export_jobs_expires"`,
  `DROP INDEX "public"."IDX_12376c181edbdcc0bfa1f432e2"`,
  `DROP TABLE "export_jobs"`,
  `DROP TYPE "public"."export_job_state"`,
  `DROP TYPE "public"."export_revision_selector"`,
  `DROP TYPE "public"."export_format"`,
  `DROP TYPE "public"."export_report_type"`,
];

/**
 * A completed export is immutable: its state and content columns never change; only the download counter
 * and the purge of an expired file (`object_key` → NULL) are allowed. Export jobs are never deleted.
 */
const COMPLETED_FUNCTION =
  `CREATE FUNCTION "export_job_completed_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
  `BEGIN IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'export jobs are never deleted'; END IF; ` +
  `IF OLD."state" = 'completed' AND (NEW."state" IS DISTINCT FROM OLD."state" ` +
  `OR NEW."content_hash" IS DISTINCT FROM OLD."content_hash" OR NEW."size_bytes" IS DISTINCT FROM OLD."size_bytes" ` +
  `OR NEW."row_count" IS DISTINCT FROM OLD."row_count" OR NEW."filters" IS DISTINCT FROM OLD."filters" ` +
  `OR NEW."unit_ids" IS DISTINCT FROM OLD."unit_ids" OR NEW."generated_at" IS DISTINCT FROM OLD."generated_at" ` +
  `OR (NEW."object_key" IS NOT NULL AND NEW."object_key" IS DISTINCT FROM OLD."object_key")) THEN ` +
  `RAISE EXCEPTION 'completed export job % is immutable', OLD."id"; END IF; RETURN NEW; END $fn$`;

/**
 * Plan 2.9 (AN03, API04, §14.2 `export_jobs`): export jobs with API04 counts, lease and cancellation
 * columns; the approved revisions and snapshots each export renders (`export_job_sources`, append-only
 * through the 2.8 `workflow_rows_append_only` function); a completed export is immutable (trigger); and an
 * index of approved revisions by approval time for the delivery reconciliation. `down()` drops all of it.
 */
export class ExportsAndDomainEvents1792707200000 implements MigrationInterface {
  name = 'ExportsAndDomainEvents1792707200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    await queryRunner.query(
      `CREATE TRIGGER "trg_export_job_sources_append_only" BEFORE UPDATE OR DELETE ON "export_job_sources" ` +
        `FOR EACH ROW EXECUTE FUNCTION "workflow_rows_append_only"()`,
    );
    await queryRunner.query(COMPLETED_FUNCTION);
    await queryRunner.query(
      `CREATE TRIGGER "trg_export_jobs_completed_immutable" BEFORE UPDATE OR DELETE ON "export_jobs" ` +
        `FOR EACH ROW EXECUTE FUNCTION "export_job_completed_immutable"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_export_jobs_completed_immutable" ON "export_jobs"`,
    );
    await queryRunner.query(`DROP FUNCTION "export_job_completed_immutable"()`);
    await queryRunner.query(
      `DROP TRIGGER "trg_export_job_sources_append_only" ON "export_job_sources"`,
    );
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}
