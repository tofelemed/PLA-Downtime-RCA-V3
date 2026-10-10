import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.9 (spec RCA01–RCA03, §15.2 rca-link, D13): RCA case links, trigger evaluations and actions;
 * `rcas` gains its unit / asset scope and `row_version`; `accounting_policy_kind` gains `rca_policy`.
 *
 * The circular foreign keys `rcas.event_id` ↔ `production_events.rca_id` (found in 1.1) made a linked
 * event or case undeletable. Ownership decision: the case owns its links (`rca_case_links`, cascading
 * with the case); both legacy pointer columns become `ON DELETE SET NULL`, so deleting either side only
 * clears the other's pointer. Existing pointers are kept and copied into `rca_case_links`
 * (source `migration`); case unit / asset are taken from the linked event. Generated from the entities
 * against a scratch database, then reviewed; `down()` restores the previous constraints and drops the
 * new tables (the copied links are dropped with them, the legacy pointers stay).
 */
const UP: readonly string[] = [
  `ALTER TABLE "production_events" DROP CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a"`,
  `ALTER TABLE "rcas" DROP CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b"`,
  `CREATE TYPE "public"."rca_link_type" AS ENUM('event', 'loss_line', 'work_order', 'occurrence')`,
  `CREATE TABLE "rca_case_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "rca_id" uuid NOT NULL, "link_type" "public"."rca_link_type" NOT NULL, "target_id" character varying(255) NOT NULL, "target_revision" integer, "unit_id" uuid, "source" character varying(16) NOT NULL, "linked_by" uuid, "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" text, "evidence" jsonb, CONSTRAINT "UQ_rca_case_links_target" UNIQUE ("rca_id", "link_type", "target_id"), CONSTRAINT "PK_ac990f1d722b3d6f81c7f5a0e83" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_43fb31c1659c08cb74d9ce169a" ON "rca_case_links" ("tenant_id")`,
  `CREATE INDEX "IDX_rca_case_links_unit" ON "rca_case_links" ("unit_id")`,
  `CREATE INDEX "IDX_rca_case_links_tenant_rca" ON "rca_case_links" ("tenant_id", "rca_id")`,
  `CREATE INDEX "IDX_rca_case_links_tenant_target" ON "rca_case_links" ("tenant_id", "link_type", "target_id")`,
  `CREATE TYPE "public"."rca_trigger_fired_on" AS ENUM('threshold_crossed_open', 'closed', 'approved')`,
  `CREATE TYPE "public"."rca_trigger_outcome" AS ENUM('recommended', 'case_created', 'suppressed_duplicate')`,
  `CREATE TABLE "rca_trigger_evaluations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "idempotency_key" character varying(200) NOT NULL, "source_kind" character varying(16) NOT NULL, "source_id" uuid NOT NULL, "source_version" integer NOT NULL, "trigger" character varying(16) NOT NULL, "event_id" uuid NOT NULL, "occurrence_id" uuid, "unit_id" uuid NOT NULL, "fired_on" "public"."rca_trigger_fired_on" NOT NULL, "provisional" boolean NOT NULL, "outcome" "public"."rca_trigger_outcome" NOT NULL, "state" character varying(16) NOT NULL, "rca_id" uuid, "detail" jsonb NOT NULL, "fired_at" TIMESTAMP WITH TIME ZONE NOT NULL, "confirmed_at" TIMESTAMP WITH TIME ZONE, "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_rca_trigger_evaluations_key" UNIQUE ("tenant_id", "idempotency_key"), CONSTRAINT "PK_b62ebb64058426dbba70269677c" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_0b8772a88f0e68be361d6114dc" ON "rca_trigger_evaluations" ("tenant_id")`,
  `CREATE INDEX "IDX_rca_trigger_evaluations_unit" ON "rca_trigger_evaluations" ("unit_id")`,
  `CREATE INDEX "IDX_rca_trigger_evaluations_state" ON "rca_trigger_evaluations" ("tenant_id", "state", "fired_at")`,
  `CREATE INDEX "IDX_rca_trigger_evaluations_event" ON "rca_trigger_evaluations" ("tenant_id", "event_id")`,
  `CREATE TYPE "public"."rca_action_status" AS ENUM('open', 'in_progress', 'done', 'cancelled')`,
  `CREATE TABLE "rca_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL, "rca_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text, "owner_id" uuid, "due_date" TIMESTAMP WITH TIME ZONE, "status" "public"."rca_action_status" NOT NULL, "completion_evidence_ref" text, "completed_at" TIMESTAMP WITH TIME ZONE, "verification_window_start" TIMESTAMP WITH TIME ZONE, "verification_window_end" TIMESTAMP WITH TIME ZONE, "baseline" jsonb, "post_action" jsonb, "claimed_avoided_loss" numeric(24,8), "claimed_currency" character varying(3), CONSTRAINT "CHK_rca_actions_window" CHECK ("verification_window_end" IS NULL OR "verification_window_end" > "verification_window_start"), CONSTRAINT "PK_8952ced73b485f388cf6b4c003a" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_f8d326764fd59e8c9a44748081" ON "rca_actions" ("tenant_id")`,
  `CREATE INDEX "IDX_rca_actions_verification_due" ON "rca_actions" ("tenant_id", "verification_window_end")`,
  `CREATE INDEX "IDX_rca_actions_tenant_rca" ON "rca_actions" ("tenant_id", "rca_id")`,
  `ALTER TABLE "rcas" ADD "unit_id" uuid`,
  `ALTER TABLE "rcas" ADD "asset_id" uuid`,
  `ALTER TABLE "rcas" ADD "row_version" integer NOT NULL DEFAULT 1`,
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `ALTER TYPE "public"."accounting_policy_kind" RENAME TO "accounting_policy_kind_old"`,
  `CREATE TYPE "public"."accounting_policy_kind" AS ENUM('coverage_gate', 'source_authority', 'oee_policy', 'reconciliation_tolerance', 'valuation_basis', 'rca_policy')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind" USING "policy_kind"::"text"::"public"."accounting_policy_kind"`,
  `DROP TYPE "public"."accounting_policy_kind_old"`,
  `CREATE INDEX "IDX_rcas_tenant" ON "rcas" ("tenant_id")`,
  `CREATE INDEX "IDX_rcas_unit" ON "rcas" ("unit_id")`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from")`,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
  `ALTER TABLE "production_events" ADD CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "rcas" ADD CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "rca_case_links" ADD CONSTRAINT "FK_rca_case_links_rca" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "rca_trigger_evaluations" ADD CONSTRAINT "FK_rca_trigger_evaluations_rca" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  `ALTER TABLE "rca_actions" ADD CONSTRAINT "FK_rca_actions_rca" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
];

/** Case scope from its legacy event, then one `event` link per legacy pointer (both directions). */
const BACKFILL: readonly string[] = [
  `UPDATE "rcas" r SET "unit_id" = e."unit_id", "asset_id" = e."asset_id"
     FROM "production_events" e WHERE e."id" = r."event_id" AND r."unit_id" IS NULL`,
  `INSERT INTO "rca_case_links" ("tenant_id", "row_version", "rca_id", "link_type", "target_id", "target_revision",
          "unit_id", "source", "linked_at", "reason")
   SELECT DISTINCT ON (pair.rca_id, pair.event_id) e."tenant_uuid", 1, pair.rca_id, 'event', pair.event_id::text,
          e."row_version", e."unit_id", 'migration', now(), 'v1 link (rcas.event_id / production_events.rca_id)'
     FROM (SELECT r."id" AS rca_id, r."event_id" AS event_id FROM "rcas" r WHERE r."event_id" IS NOT NULL
           UNION SELECT e."rca_id", e."id" FROM "production_events" e WHERE e."rca_id" IS NOT NULL) pair
     JOIN "production_events" e ON e."id" = pair.event_id
     JOIN "rcas" c ON c."id" = pair.rca_id
    WHERE e."tenant_uuid" IS NOT NULL AND c."tenant_id" = e."tenant_uuid"::text
   ON CONFLICT DO NOTHING`,
];

const DOWN: readonly string[] = [
  `DELETE FROM "accounting_policies" WHERE "policy_kind" = 'rca_policy'`,
  `ALTER TABLE "rca_actions" DROP CONSTRAINT "FK_rca_actions_rca"`,
  `ALTER TABLE "rca_trigger_evaluations" DROP CONSTRAINT "FK_rca_trigger_evaluations_rca"`,
  `ALTER TABLE "rca_case_links" DROP CONSTRAINT "FK_rca_case_links_rca"`,
  `ALTER TABLE "rcas" DROP CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b"`,
  `ALTER TABLE "production_events" DROP CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a"`,
  `ALTER TABLE "accounting_policies" DROP CONSTRAINT "UQ_accounting_policies_kind_scope_version"`,
  `DROP INDEX "public"."IDX_accounting_policies_lookup"`,
  `DROP INDEX "public"."IDX_rcas_unit"`,
  `DROP INDEX "public"."IDX_rcas_tenant"`,
  `CREATE TYPE "public"."accounting_policy_kind_old" AS ENUM('coverage_gate', 'source_authority', 'oee_policy', 'reconciliation_tolerance', 'valuation_basis')`,
  `ALTER TABLE "accounting_policies" ALTER COLUMN "policy_kind" TYPE "public"."accounting_policy_kind_old" USING "policy_kind"::"text"::"public"."accounting_policy_kind_old"`,
  `DROP TYPE "public"."accounting_policy_kind"`,
  `ALTER TYPE "public"."accounting_policy_kind_old" RENAME TO "accounting_policy_kind"`,
  `ALTER TABLE "accounting_policies" ADD CONSTRAINT "UQ_accounting_policies_kind_scope_version" UNIQUE ("tenant_id", "policy_kind", "scope_key", "version")`,
  `CREATE INDEX "IDX_accounting_policies_lookup" ON "accounting_policies" ("tenant_id", "policy_kind", "unit_id", "effective_from")`,
  `ALTER TABLE "rcas" DROP COLUMN "row_version"`,
  `ALTER TABLE "rcas" DROP COLUMN "asset_id"`,
  `ALTER TABLE "rcas" DROP COLUMN "unit_id"`,
  `DROP INDEX "public"."IDX_rca_actions_tenant_rca"`,
  `DROP INDEX "public"."IDX_rca_actions_verification_due"`,
  `DROP INDEX "public"."IDX_f8d326764fd59e8c9a44748081"`,
  `DROP TABLE "rca_actions"`,
  `DROP TYPE "public"."rca_action_status"`,
  `DROP INDEX "public"."IDX_rca_trigger_evaluations_event"`,
  `DROP INDEX "public"."IDX_rca_trigger_evaluations_state"`,
  `DROP INDEX "public"."IDX_rca_trigger_evaluations_unit"`,
  `DROP INDEX "public"."IDX_0b8772a88f0e68be361d6114dc"`,
  `DROP TABLE "rca_trigger_evaluations"`,
  `DROP TYPE "public"."rca_trigger_outcome"`,
  `DROP TYPE "public"."rca_trigger_fired_on"`,
  `DROP INDEX "public"."IDX_rca_case_links_tenant_target"`,
  `DROP INDEX "public"."IDX_rca_case_links_tenant_rca"`,
  `DROP INDEX "public"."IDX_rca_case_links_unit"`,
  `DROP INDEX "public"."IDX_43fb31c1659c08cb74d9ce169a"`,
  `DROP TABLE "rca_case_links"`,
  `DROP TYPE "public"."rca_link_type"`,
  `ALTER TABLE "rcas" ADD CONSTRAINT "FK_a0e2a9c25b398c12e232d861b3b" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
  `ALTER TABLE "production_events" ADD CONSTRAINT "FK_f6b86cfe4d0085cf0ab70695b6a" FOREIGN KEY ("rca_id") REFERENCES "rcas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
];

export class RcaLinks1793139200000 implements MigrationInterface {
  name = 'RcaLinks1793139200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of [...UP, ...BACKFILL]) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
