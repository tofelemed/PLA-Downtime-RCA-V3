import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.10 step 1 (spec MIG02 / MIG04 / MIG05, §18.2, D11): bookkeeping for the remediation jobs and
 * the cutover — `migration_reports` (one row per applied or reverting run), `migration_changes` (row
 * before / after trail used by revert), `migration_review` (legacy rows waiting for a data-owner
 * decision), `legacy_id_crosswalk`, `legacy_reported_values` (client-entered v1 values kept as
 * `UnknownLegacy`), `migration_explanations` (MIG04 difference explanations) and
 * `legacy_write_freezes` (MIG05 v1 write freeze per tenant). Expand-only: no legacy table or row is
 * changed here — the jobs do that, dry-run first, from `scripts/cutover/*`. Generated from the
 * entities against a scratch database; `down()` drops the seven tables (their rows are bookkeeping,
 * not source records — revert applied runs first if their source-row changes must be undone).
 */
const UP: readonly string[] = [
  `CREATE TABLE "migration_review" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "job" character varying(64) NOT NULL, "legacy_table" character varying(64) NOT NULL, "legacy_id" character varying(255) NOT NULL, "issue" character varying(64) NOT NULL, "details" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "report_id" uuid NOT NULL, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolved_by" character varying(255), "resolution" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_migration_review_item" UNIQUE ("job", "legacy_table", "legacy_id", "issue"), CONSTRAINT "CHK_migration_review_status" CHECK ("status" IN ('open', 'resolved', 'dismissed')), CONSTRAINT "PK_dff2b07efa262250bd8f160ffcc" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_migration_review_report" ON "migration_review" ("report_id") `,
  `CREATE INDEX "IDX_migration_review_tenant_status" ON "migration_review" ("tenant_id", "status") `,
  `CREATE TABLE "migration_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "job" character varying(64) NOT NULL, "tenant_id" uuid, "status" character varying(16) NOT NULL, "actor" character varying(255) NOT NULL, "database_name" character varying(128) NOT NULL, "summary" jsonb NOT NULL, "reverts_report_id" uuid, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ddaf8baa7046147fe1764c9d6ee" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_migration_reports_tenant" ON "migration_reports" ("tenant_id") `,
  `CREATE INDEX "IDX_migration_reports_job" ON "migration_reports" ("job", "started_at") `,
  `CREATE TABLE "migration_explanations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "metric" character varying(64) NOT NULL, "scope_key" character varying(255) NOT NULL, "legacy_value" numeric(24,8), "v2_value" numeric(24,8), "category" character varying(32) NOT NULL, "note" text NOT NULL, "author" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_migration_explanations_category" CHECK ("category" IN ('formula_change', 'quality_change', 'defect')), CONSTRAINT "PK_0c26c115904303423f058e8f663" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_migration_explanations_lookup" ON "migration_explanations" ("tenant_id", "metric", "scope_key") `,
  `CREATE TABLE "migration_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "report_id" uuid NOT NULL, "seq" integer NOT NULL, "kind" character varying(8) NOT NULL, "table_name" character varying(64) NOT NULL, "row_id" uuid NOT NULL, "before" jsonb, "after" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_217f77e9413c923d3e50d81567a" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_migration_changes_report" ON "migration_changes" ("report_id", "seq") `,
  `CREATE TABLE "legacy_id_crosswalk" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "legacy_table" character varying(64) NOT NULL, "legacy_id" character varying(255) NOT NULL, "new_table" character varying(64) NOT NULL, "new_id" uuid NOT NULL, "relation" character varying(32) NOT NULL, "report_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_legacy_id_crosswalk" UNIQUE ("legacy_table", "legacy_id", "new_table", "new_id", "relation"), CONSTRAINT "PK_06b72e7bca89e98b0974ac35ca0" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_legacy_id_crosswalk_report" ON "legacy_id_crosswalk" ("report_id") `,
  `CREATE INDEX "IDX_legacy_id_crosswalk_tenant" ON "legacy_id_crosswalk" ("tenant_id") `,
  `CREATE INDEX "IDX_legacy_id_crosswalk_new" ON "legacy_id_crosswalk" ("new_table", "new_id") `,
  `CREATE TABLE "legacy_write_freezes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "reason" text NOT NULL, "frozen_by" character varying(255) NOT NULL, "frozen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "released_at" TIMESTAMP WITH TIME ZONE, "released_by" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_47aef1dd1fba882ae98c5fb7cfa" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX "UQ_legacy_write_freezes_active" ON "legacy_write_freezes" ("tenant_id") WHERE "released_at" IS NULL`,
  `CREATE TABLE "legacy_reported_values" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "legacy_table" character varying(64) NOT NULL, "legacy_id" uuid NOT NULL, "plan_id" uuid, "period_label" character varying(50), "metric" character varying(64) NOT NULL, "value" numeric(24,8) NOT NULL, "method" character varying(16) NOT NULL, "report_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_legacy_reported_values" UNIQUE ("legacy_table", "legacy_id", "metric"), CONSTRAINT "CHK_legacy_reported_values_method" CHECK ("method" = 'UnknownLegacy'), CONSTRAINT "PK_3df24c722387053dac31cf81d64" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_legacy_reported_values_report" ON "legacy_reported_values" ("report_id") `,
  `CREATE INDEX "IDX_legacy_reported_values_tenant_plan" ON "legacy_reported_values" ("tenant_id", "plan_id") `,
  `ALTER TABLE "migration_changes" ADD CONSTRAINT "FK_migration_changes_report" FOREIGN KEY ("report_id") REFERENCES "migration_reports"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const DOWN: readonly string[] = [
  `ALTER TABLE "migration_changes" DROP CONSTRAINT "FK_migration_changes_report"`,
  `DROP TABLE "legacy_reported_values"`,
  `DROP TABLE "legacy_write_freezes"`,
  `DROP TABLE "legacy_id_crosswalk"`,
  `DROP TABLE "migration_changes"`,
  `DROP TABLE "migration_explanations"`,
  `DROP TABLE "migration_reports"`,
  `DROP TABLE "migration_review"`,
];

export class MigrationCutover1793225600000 implements MigrationInterface {
  name = 'MigrationCutover1793225600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
