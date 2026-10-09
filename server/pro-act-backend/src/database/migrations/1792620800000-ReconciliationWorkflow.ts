import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables, columns, indexes and foreign keys of plan 2.8 (generated from the entities, reviewed). */
const SCHEMA_UP: readonly string[] = [
  `DROP INDEX "public"."UQ_accounting_revisions_period_draft"`,
  `DROP INDEX "public"."UQ_accounting_revisions_period_approved"`,
  `CREATE TYPE "public"."period_change_trigger" AS ENUM('event_change', 'actuals_change', 'plan_change', 'rate_change', 'calendar_change', 'source_retraction', 'recalculation')`,
  `CREATE TYPE "public"."period_change_proposal_state" AS ENUM('open', 'accepted', 'dismissed')`,
  `CREATE TABLE "period_change_proposals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "period_id" uuid NOT NULL, "unit_id" uuid NOT NULL, "approved_revision_id" uuid NOT NULL, "trigger" "public"."period_change_trigger" NOT NULL, "state" "public"."period_change_proposal_state" NOT NULL DEFAULT 'open', "input_hash" character varying(64), "before" jsonb NOT NULL, "after" jsonb, "affected_reports" jsonb NOT NULL DEFAULT '[]', "detail" jsonb NOT NULL DEFAULT '{}', "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_reason" text, "created_revision_id" uuid, CONSTRAINT "PK_6fa32fe23618527feeb81cb2463" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_80e4e5c2b0f6f69646dca73bde" ON "period_change_proposals" ("tenant_id") `,
  `CREATE INDEX "IDX_period_change_proposals_created_revision" ON "period_change_proposals" ("created_revision_id") `,
  `CREATE INDEX "IDX_period_change_proposals_approved_revision" ON "period_change_proposals" ("approved_revision_id") `,
  `CREATE INDEX "IDX_period_change_proposals_tenant_period_created" ON "period_change_proposals" ("tenant_id", "period_id", "created_at") `,
  `CREATE UNIQUE INDEX "UQ_period_change_proposals_open" ON "period_change_proposals" ("approved_revision_id") WHERE "state" = 'open'`,
  `CREATE TABLE "reconciliation_line_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "version" integer NOT NULL, "base_run_id" uuid NOT NULL, "origin" character varying(32) NOT NULL, CONSTRAINT "UQ_reconciliation_line_sets_revision_version" UNIQUE ("revision_id", "version"), CONSTRAINT "PK_7b4e53e5a058f89d2c9dc02d962" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_4def568e3a54288dd8f16bb896" ON "reconciliation_line_sets" ("tenant_id") `,
  `CREATE INDEX "IDX_reconciliation_line_sets_tenant_period" ON "reconciliation_line_sets" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_reconciliation_line_sets_base_run" ON "reconciliation_line_sets" ("base_run_id") `,
  `CREATE TYPE "public"."reconciliation_line_action" AS ENUM('accept', 'adjust', 'replace', 'reject', 'manual', 'tolerance')`,
  `CREATE TABLE "reconciliation_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "line_set_id" uuid NOT NULL, "period_id" uuid NOT NULL, "slice_id" uuid NOT NULL, "position" integer NOT NULL, "action" "public"."reconciliation_line_action" NOT NULL, "auto_key" text, "kind" "public"."loss_line_kind", "quantity" numeric(24,8), "base_quantity" numeric(24,8), "uom" character varying(50), "basis" "public"."loss_line_basis", "reason_code_id" uuid, "impact_code_id" uuid, "evidence" jsonb NOT NULL DEFAULT '[]', "adjustment_id" uuid, "missing_code" boolean NOT NULL DEFAULT false, "missing_event" boolean NOT NULL DEFAULT false, "reason" text, "comment" text, "author_id" uuid, CONSTRAINT "PK_09ad4523a3b76ca30c8c022161f" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_2fbf7af88f913ca105c2c44708" ON "reconciliation_lines" ("tenant_id") `,
  `CREATE INDEX "IDX_reconciliation_lines_tenant_period" ON "reconciliation_lines" ("tenant_id", "period_id") `,
  `CREATE INDEX "IDX_reconciliation_lines_adjustment" ON "reconciliation_lines" ("adjustment_id") `,
  `CREATE INDEX "IDX_reconciliation_lines_slice" ON "reconciliation_lines" ("slice_id") `,
  `CREATE INDEX "IDX_reconciliation_lines_set" ON "reconciliation_lines" ("line_set_id") `,
  `CREATE TYPE "public"."approval_action_kind" AS ENUM('save_draft', 'submit', 'approve', 'reject', 'revise', 'cancel', 'recompute', 'stale')`,
  `CREATE TABLE "approval_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "action" "public"."approval_action_kind" NOT NULL, "from_lifecycle" character varying(16) NOT NULL, "to_lifecycle" character varying(16) NOT NULL, "actor_id" uuid, "service" character varying(64), "reason" text, "submitted_hash" character varying(64), "correlation_id" character varying(128), CONSTRAINT "PK_dcf156731ecc8b420b6c39d22c8" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_7e1c798ad723662cfd98453fb7" ON "approval_actions" ("tenant_id") `,
  `CREATE INDEX "IDX_approval_actions_tenant_period_created" ON "approval_actions" ("tenant_id", "period_id", "created_at") `,
  `CREATE INDEX "IDX_approval_actions_revision" ON "approval_actions" ("revision_id") `,
  `CREATE TABLE "approval_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "revision_id" uuid NOT NULL, "period_id" uuid NOT NULL, "content" jsonb NOT NULL, "content_hash" character varying(64) NOT NULL, "submitted_hash" character varying(64) NOT NULL, CONSTRAINT "PK_a97613260c950996b24a999d5ef" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_b2468a20339717a30e1a29998f" ON "approval_snapshots" ("tenant_id") `,
  `CREATE INDEX "IDX_approval_snapshots_tenant_period" ON "approval_snapshots" ("tenant_id", "period_id") `,
  `CREATE UNIQUE INDEX "UQ_approval_snapshots_revision" ON "approval_snapshots" ("revision_id") `,
  `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "actor_id" uuid, "service" character varying(64), "action" character varying(64) NOT NULL, "entity_type" character varying(64) NOT NULL, "entity_id" uuid NOT NULL, "revision" integer, "before_hash" character varying(64), "after_hash" character varying(64), "reason" text, "correlation_id" character varying(128), "detail" jsonb NOT NULL DEFAULT '{}', "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_audit_log_tenant_entity_at" ON "audit_log" ("tenant_id", "entity_type", "entity_id", "at") `,
  `ALTER TABLE "accounting_revisions" ADD "current_line_set_id" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "submitted_by" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "submitted_at" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "accounting_revisions" ADD "submitted_hash" character varying(64)`,
  `ALTER TABLE "accounting_revisions" ADD "submitted_run_id" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "approved_by" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "approved_at" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "accounting_revisions" ADD "approval_snapshot_id" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "rejected_by" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "rejected_at" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "accounting_revisions" ADD "reject_reason" text`,
  `ALTER TABLE "accounting_revisions" ADD "cancelled_by" uuid`,
  `ALTER TABLE "accounting_revisions" ADD "cancelled_at" TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE "accounting_revisions" ADD "is_stale" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "accounting_revisions" ADD "stale_reason" text`,
  `ALTER TABLE "accounting_revisions" ADD "comment" text`,
  `CREATE UNIQUE INDEX "UQ_accounting_revisions_period_open" ON "accounting_revisions" ("period_id") WHERE "lifecycle" IN ('draft', 'in_review')`,
  `ALTER TABLE "period_change_proposals" ADD CONSTRAINT "FK_period_change_proposals_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_change_proposals" ADD CONSTRAINT "FK_period_change_proposals_approved_revision" FOREIGN KEY ("approved_revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "period_change_proposals" ADD CONSTRAINT "FK_period_change_proposals_created_revision" FOREIGN KEY ("created_revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_line_sets" ADD CONSTRAINT "FK_reconciliation_line_sets_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_line_sets" ADD CONSTRAINT "FK_reconciliation_line_sets_period" FOREIGN KEY ("period_id") REFERENCES "production_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_line_sets" ADD CONSTRAINT "FK_reconciliation_line_sets_base_run" FOREIGN KEY ("base_run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "FK_reconciliation_lines_set" FOREIGN KEY ("line_set_id") REFERENCES "reconciliation_line_sets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "FK_reconciliation_lines_slice" FOREIGN KEY ("slice_id") REFERENCES "period_product_slices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "reconciliation_lines" ADD CONSTRAINT "FK_reconciliation_lines_adjustment" FOREIGN KEY ("adjustment_id") REFERENCES "actuals_adjustments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "approval_actions" ADD CONSTRAINT "FK_approval_actions_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "approval_snapshots" ADD CONSTRAINT "FK_approval_snapshots_revision" FOREIGN KEY ("revision_id") REFERENCES "accounting_revisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

const SCHEMA_DOWN: readonly string[] = [
  `ALTER TABLE "approval_snapshots" DROP CONSTRAINT "FK_approval_snapshots_revision"`,
  `ALTER TABLE "approval_actions" DROP CONSTRAINT "FK_approval_actions_revision"`,
  `ALTER TABLE "reconciliation_lines" DROP CONSTRAINT "FK_reconciliation_lines_adjustment"`,
  `ALTER TABLE "reconciliation_lines" DROP CONSTRAINT "FK_reconciliation_lines_slice"`,
  `ALTER TABLE "reconciliation_lines" DROP CONSTRAINT "FK_reconciliation_lines_set"`,
  `ALTER TABLE "reconciliation_line_sets" DROP CONSTRAINT "FK_reconciliation_line_sets_base_run"`,
  `ALTER TABLE "reconciliation_line_sets" DROP CONSTRAINT "FK_reconciliation_line_sets_period"`,
  `ALTER TABLE "reconciliation_line_sets" DROP CONSTRAINT "FK_reconciliation_line_sets_revision"`,
  `ALTER TABLE "period_change_proposals" DROP CONSTRAINT "FK_period_change_proposals_created_revision"`,
  `ALTER TABLE "period_change_proposals" DROP CONSTRAINT "FK_period_change_proposals_approved_revision"`,
  `ALTER TABLE "period_change_proposals" DROP CONSTRAINT "FK_period_change_proposals_period"`,
  `DROP INDEX "public"."UQ_accounting_revisions_period_open"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "comment"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "stale_reason"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "is_stale"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "cancelled_at"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "cancelled_by"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "reject_reason"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "rejected_at"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "rejected_by"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "approval_snapshot_id"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "approved_at"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "approved_by"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "submitted_run_id"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "submitted_hash"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "submitted_at"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "submitted_by"`,
  `ALTER TABLE "accounting_revisions" DROP COLUMN "current_line_set_id"`,
  `DROP INDEX "public"."IDX_audit_log_tenant_entity_at"`,
  `DROP TABLE "audit_log"`,
  `DROP INDEX "public"."UQ_approval_snapshots_revision"`,
  `DROP INDEX "public"."IDX_approval_snapshots_tenant_period"`,
  `DROP INDEX "public"."IDX_b2468a20339717a30e1a29998f"`,
  `DROP TABLE "approval_snapshots"`,
  `DROP INDEX "public"."IDX_approval_actions_revision"`,
  `DROP INDEX "public"."IDX_approval_actions_tenant_period_created"`,
  `DROP INDEX "public"."IDX_7e1c798ad723662cfd98453fb7"`,
  `DROP TABLE "approval_actions"`,
  `DROP TYPE "public"."approval_action_kind"`,
  `DROP INDEX "public"."IDX_reconciliation_lines_set"`,
  `DROP INDEX "public"."IDX_reconciliation_lines_slice"`,
  `DROP INDEX "public"."IDX_reconciliation_lines_adjustment"`,
  `DROP INDEX "public"."IDX_reconciliation_lines_tenant_period"`,
  `DROP INDEX "public"."IDX_2fbf7af88f913ca105c2c44708"`,
  `DROP TABLE "reconciliation_lines"`,
  `DROP TYPE "public"."reconciliation_line_action"`,
  `DROP INDEX "public"."IDX_reconciliation_line_sets_base_run"`,
  `DROP INDEX "public"."IDX_reconciliation_line_sets_tenant_period"`,
  `DROP INDEX "public"."IDX_4def568e3a54288dd8f16bb896"`,
  `DROP TABLE "reconciliation_line_sets"`,
  `DROP INDEX "public"."UQ_period_change_proposals_open"`,
  `DROP INDEX "public"."IDX_period_change_proposals_tenant_period_created"`,
  `DROP INDEX "public"."IDX_period_change_proposals_approved_revision"`,
  `DROP INDEX "public"."IDX_period_change_proposals_created_revision"`,
  `DROP INDEX "public"."IDX_80e4e5c2b0f6f69646dca73bde"`,
  `DROP TABLE "period_change_proposals"`,
  `DROP TYPE "public"."period_change_proposal_state"`,
  `DROP TYPE "public"."period_change_trigger"`,
  `CREATE UNIQUE INDEX "UQ_accounting_revisions_period_approved" ON "accounting_revisions" ("period_id") WHERE "lifecycle" = 'approved'`,
  `CREATE UNIQUE INDEX "UQ_accounting_revisions_period_draft" ON "accounting_revisions" ("period_id") WHERE "lifecycle" = 'draft'`,
];

/** Rows of these tables are written once and never changed or deleted. */
const APPEND_ONLY_TABLES = [
  'reconciliation_line_sets',
  'reconciliation_lines',
  'approval_actions',
  'approval_snapshots',
  'audit_log',
] as const;

const APPEND_ONLY_FUNCTION =
  `CREATE FUNCTION "workflow_rows_append_only"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
  `BEGIN RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME; END $fn$`;

/** Approved revisions are history: a revise writes a new revision, nothing updates or deletes one. */
const APPROVED_FUNCTION =
  `CREATE FUNCTION "accounting_revision_approved_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
  `BEGIN IF OLD."lifecycle" = 'approved' THEN ` +
  `RAISE EXCEPTION 'approved accounting revision % is immutable (revise opens a new revision)', OLD."id"; END IF; ` +
  `IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $fn$`;

/**
 * Plan 2.8 (ACC07–ACC10, WF01–WF05, §14.2): workflow columns of `accounting_revisions` (one open — draft or
 * in review — revision per period instead of one draft and one approved; approved revisions accumulate and
 * the latest is published), reconciliation line sets and lines, approval actions and snapshots, period
 * change proposals and the append-only `audit_log`; triggers keep approved revisions and every workflow
 * row immutable. `down()` drops all of it and restores the 2.5 indexes (it fails while a period has more
 * than one approved revision — history is never thrown away silently).
 */
export class ReconciliationWorkflow1792620800000 implements MigrationInterface {
  name = 'ReconciliationWorkflow1792620800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of SCHEMA_UP) await queryRunner.query(statement);
    await queryRunner.query(APPEND_ONLY_FUNCTION);
    for (const table of APPEND_ONLY_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER "trg_${table}_append_only" BEFORE UPDATE OR DELETE ON "${table}" ` +
          `FOR EACH ROW EXECUTE FUNCTION "workflow_rows_append_only"()`,
      );
    }
    await queryRunner.query(`REVOKE UPDATE, DELETE ON "audit_log" FROM PUBLIC`);
    await queryRunner.query(APPROVED_FUNCTION);
    await queryRunner.query(
      `CREATE TRIGGER "trg_accounting_revisions_approved_immutable" BEFORE UPDATE OR DELETE ON "accounting_revisions" ` +
        `FOR EACH ROW EXECUTE FUNCTION "accounting_revision_approved_immutable"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "trg_accounting_revisions_approved_immutable" ON "accounting_revisions"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "accounting_revision_approved_immutable"()`,
    );
    for (const table of APPEND_ONLY_TABLES) {
      await queryRunner.query(
        `DROP TRIGGER "trg_${table}_append_only" ON "${table}"`,
      );
    }
    await queryRunner.query(`DROP FUNCTION "workflow_rows_append_only"()`);
    for (const statement of SCHEMA_DOWN) await queryRunner.query(statement);
  }
}
