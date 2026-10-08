import { MigrationInterface, QueryRunner } from 'typeorm';

const ISO_MS = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;
const iso = (column: string): string =>
  `to_char("${column}" AT TIME ZONE 'UTC', ${ISO_MS})`;

/** Fact key → SQL expression; frozen copy of SOURCE_FIELDS in src/production-event/revisions/event-facts.ts. */
const SOURCE_FACTS: ReadonlyArray<[key: string, sql: string]> = [
  ['startTime', iso('start_time')],
  ['endTime', iso('end_time')],
  ['eventType', '"event_type"'],
  ['description', '"description"'],
  ['quantity', '"quantity"'],
  ['cost', '"cost"'],
  ['value', '"value"'],
  ['severity', '"severity"'],
  ['parameter', '"parameter"'],
  ['limit', '"limit_value"'],
  ['limitType', '"limit_type"'],
  ['breachDuration', '"breach_duration"'],
  ['solType', '"sol_type"'],
  ['apmType', '"apm_type"'],
  ['recommendedAction', '"recommended_action"'],
  ['workOrderId', '"work_order_id"'],
  ['failureMode', '"failure_mode"'],
  ['defectiveQuantity', '"defective_quantity"'],
  ['shift', '"shift"'],
  ['crew', '"crew"'],
  ['lossCategory', '"loss_category"'],
  ['operatorName', '"operator_name"'],
  ['assetId', '"asset_id"'],
  ['planId', '"plan_id"'],
];

/** CODING_FIELDS (description included) */
const CODING_FACTS: ReadonlyArray<[key: string, sql: string]> = [
  ['reasonCodeId', '"reason_code_id"'],
  ['impactCodeId', '"impact_code_id"'],
  ['oeeCodeId', '"oee_code_id"'],
  ['scheduleClass', '"schedule_class"'],
  ['oeeComponent', '"oee_component"'],
  ['impactMode', '"impact_mode"'],
  ['impactFraction', '"impact_fraction"'],
  ['description', '"description"'],
];

const STATE_FACTS: ReadonlyArray<[key: string, sql: string]> = [
  ['physicalType', '"physical_type"'],
  ['physicalState', '"physical_state"'],
  ['codingState', '"coding_state"'],
  ['rcaState', '"rca_state"'],
  ['rcaId', '"rca_id"'],
  ['status', '"status"'],
];

const jsonbOf = (facts: ReadonlyArray<[string, string]>): string =>
  `jsonb_build_object(${facts.map(([key, sql]) => `'${key}', ${sql}`).join(', ')})`;

const SOURCE_JSON = jsonbOf(SOURCE_FACTS);
const CODING_JSON = jsonbOf(CODING_FACTS);
const EFFECTIVE_JSON = `${SOURCE_JSON} || ${CODING_JSON} || ${jsonbOf(STATE_FACTS)}`;

const FK = {
  revisions: 'FK_cff28cc6154ae420bce7414eb21',
  reviewItems: 'FK_25ab6786605a498c12d34c3c1a9',
  coding: 'FK_ef1cf2a6fc0eacbb8ed0fe58495',
};

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

/**
 * Plan 1.2 (spec ING01, ING06, §5.3, §14.2): immutable event revisions, explicit coding revisions,
 * review items, and source-ownership columns on `production_events`.
 *
 * Expand-only. Backfill is set-based and idempotent on a fresh table: one revision 1 per event with a
 * tenant (`user` for manual events, `source` otherwise, `source_facts` only for source events) and one
 * baseline coding revision 1. The JSON snapshots use the same keys and value forms as `factsOf()`
 * (timestamps ISO with ms in UTC, numerics as JSON numbers); the backfill integration spec pins both.
 * Events whose `tenant_uuid` is null (legacy non-uuid tenant ids) get no rows.
 */
export class EventRevisions1791670400000 implements MigrationInterface {
  name = 'EventRevisions1791670400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRevisions(queryRunner);
    await this.createReviewItems(queryRunner);
    await this.createCoding(queryRunner);
    await this.addEventColumns(queryRunner);
    await this.backfill(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'user_overrides',
      'duplicate_deliveries',
      'retracted_at',
      'current_coding_revision',
      'current_source_revision',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "production_events" DROP COLUMN "${column}"`,
      );
    }
    // dropping a table drops its indexes, constraints and foreign keys
    await queryRunner.query(`DROP TABLE "event_coding"`);
    await queryRunner.query(`DROP TABLE "event_review_items"`);
    await queryRunner.query(`DROP TYPE "public"."event_review_item_state"`);
    await queryRunner.query(`DROP TYPE "public"."event_review_item_kind"`);
    await queryRunner.query(`DROP TABLE "event_revisions"`);
    await queryRunner.query(`DROP TYPE "public"."event_revision_actor_kind"`);
    await queryRunner.query(`DROP TYPE "public"."event_revision_kind"`);
  }

  private async createRevisions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_revision_kind" AS ENUM('source', 'user', 'system', 'retraction')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_revision_actor_kind" AS ENUM('user', 'connector', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_revisions" (${TENANT_SCOPED_COLUMNS}, "event_id" uuid NOT NULL, "revision" integer NOT NULL, ` +
        `"kind" "public"."event_revision_kind" NOT NULL, "source_facts" jsonb, "effective_facts" jsonb NOT NULL, ` +
        `"change_reason" text, "actor_id" uuid, "actor_kind" "public"."event_revision_actor_kind" NOT NULL, ` +
        `"source_revision" character varying(255), ` +
        `CONSTRAINT "UQ_event_revisions_event_revision" UNIQUE ("event_id", "revision"), ` +
        `CONSTRAINT "PK_de85c26390b0fe638666227b5fe" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "${FK.revisions}" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61f562215e491df0d6be3089c8" ON "event_revisions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_revisions_tenant_event" ON "event_revisions" ("tenant_id", "event_id")`,
    );
  }

  private async createReviewItems(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_review_item_kind" AS ENUM('source_vs_override_conflict', 'late_correction', 'retraction')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_review_item_state" AS ENUM('open', 'kept_override', 'accepted_source', 'dismissed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_review_items" (${TENANT_SCOPED_COLUMNS}, "event_id" uuid NOT NULL, ` +
        `"kind" "public"."event_review_item_kind" NOT NULL, "field" character varying(64), "source_revision_id" uuid, ` +
        `"coding_revision_id" uuid, "state" "public"."event_review_item_state" NOT NULL DEFAULT 'open', ` +
        `"resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "PK_f546c5052e8e2c6214cb39d83d6" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "${FK.reviewItems}" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_768c28ade4f54ed5bfb3be28bb" ON "event_review_items" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_review_items_event" ON "event_review_items" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_review_items_tenant_state" ON "event_review_items" ("tenant_id", "state")`,
    );
  }

  private async createCoding(queryRunner: QueryRunner): Promise<void> {
    // the classification enum types belong to EventIntervalModel and are reused here
    await queryRunner.query(
      `CREATE TABLE "event_coding" (${TENANT_SCOPED_COLUMNS}, "event_id" uuid NOT NULL, "revision" integer NOT NULL, ` +
        `"reason_code_id" uuid, "impact_code_id" uuid, "oee_code_id" uuid, ` +
        `"schedule_class" "public"."production_event_schedule_class" NOT NULL, ` +
        `"oee_component" "public"."production_event_oee_component" NOT NULL, ` +
        `"impact_mode" "public"."production_event_impact_mode" NOT NULL, "impact_fraction" numeric(9,8), ` +
        `"comment" text, "is_override" boolean NOT NULL DEFAULT false, "overrides_source_revision" integer, ` +
        `"old_values" jsonb NOT NULL, "new_values" jsonb NOT NULL, "reason" text, "author_id" uuid, ` +
        `CONSTRAINT "UQ_event_coding_event_revision" UNIQUE ("event_id", "revision"), ` +
        `CONSTRAINT "PK_deb54018d298a448151a8b3dc64" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "${FK.coding}" FOREIGN KEY ("event_id") REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_01e38f5ea9f551f60095f137dd" ON "event_coding" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_coding_tenant_event" ON "event_coding" ("tenant_id", "event_id")`,
    );
  }

  private async addEventColumns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "current_source_revision" integer NOT NULL DEFAULT '0', ` +
        `ADD "current_coding_revision" integer NOT NULL DEFAULT '0', ` +
        `ADD "retracted_at" TIMESTAMP WITH TIME ZONE, ` +
        `ADD "duplicate_deliveries" integer NOT NULL DEFAULT '0', ` +
        `ADD "user_overrides" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "event_revisions" ("tenant_id", "event_id", "revision", "kind", "source_facts", "effective_facts", ` +
        `"change_reason", "actor_kind", "row_version", "created_at", "updated_at") ` +
        `SELECT "tenant_uuid", "id", 1, ` +
        `CASE WHEN "source_kind" = 'manual' THEN 'user' ELSE 'source' END::"event_revision_kind", ` +
        `CASE WHEN "source_kind" = 'manual' THEN NULL ELSE ${SOURCE_JSON} END, ${EFFECTIVE_JSON}, ` +
        `'baseline', 'system', 1, "created_at", "created_at" ` +
        `FROM "production_events" WHERE "tenant_uuid" IS NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "event_coding" ("tenant_id", "event_id", "revision", "reason_code_id", "impact_code_id", "oee_code_id", ` +
        `"schedule_class", "oee_component", "impact_mode", "impact_fraction", "comment", "is_override", ` +
        `"old_values", "new_values", "reason", "row_version", "created_at", "updated_at") ` +
        `SELECT "tenant_uuid", "id", 1, "reason_code_id", "impact_code_id", "oee_code_id", ` +
        `"schedule_class", "oee_component", "impact_mode", "impact_fraction", "description", false, ` +
        `'{}'::jsonb, ${CODING_JSON}, 'baseline', 1, "created_at", "created_at" ` +
        `FROM "production_events" WHERE "tenant_uuid" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "production_events" SET "current_coding_revision" = 1, ` +
        `"current_source_revision" = CASE WHEN "source_kind" = 'manual' THEN 0 ELSE 1 END ` +
        `WHERE "tenant_uuid" IS NOT NULL`,
    );
  }
}
