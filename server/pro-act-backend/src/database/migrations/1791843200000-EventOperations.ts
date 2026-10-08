import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const FK = {
  relationFrom: 'FK_1161551aeffa4ecaef63adc7d8c',
  relationTo: 'FK_6243ca3de560c4a3f4af22de725',
};

const REVIEW_KINDS_BEFORE = `'source_vs_override_conflict', 'late_correction', 'retraction'`;

/**
 * Plan 1.4 (spec DT09/DT10, API04, §14.2 `event_relations`): lineage between events, the physical stop
 * occurrence on every event, async bulk jobs, and the `pending_source_confirmation` review item kind
 * (a closed source-owned event waits for its source to confirm the end).
 *
 * Expand-only. `occurrence_id` is backfilled with the event's own id (set-based); a BEFORE INSERT
 * trigger gives every new row from any writer (v1, v2, PI, seeders) the same default.
 */
export class EventOperations1791843200000 implements MigrationInterface {
  name = 'EventOperations1791843200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRelations(queryRunner);
    await this.createBulkJobs(queryRunner);
    await this.addOccurrence(queryRunner);
    await this.recreateReviewKind(
      queryRunner,
      `${REVIEW_KINDS_BEFORE}, 'pending_source_confirmation'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "event_review_items" WHERE "kind"::text = 'pending_source_confirmation'`,
    );
    await this.recreateReviewKind(queryRunner, REVIEW_KINDS_BEFORE);
    await queryRunner.query(
      `DROP TRIGGER "trg_production_events_occurrence" ON "production_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "production_events_default_occurrence"()`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_production_events_tenant_occurrence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "superseded_by_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "occurrence_id"`,
    );
    await queryRunner.query(`DROP TABLE "bulk_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_job_state"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_job_kind"`);
    await queryRunner.query(`DROP TABLE "event_relations"`);
    await queryRunner.query(`DROP TYPE "public"."event_relation_type"`);
  }

  private async createRelations(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_relation_type" AS ENUM('split_child_of', 'merged_from', 'correlated_with', 'impact_of')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_relations" (${TENANT_SCOPED_COLUMNS}, "from_event_id" uuid NOT NULL, ` +
        `"to_event_id" uuid NOT NULL, "relation_type" "public"."event_relation_type" NOT NULL, ` +
        `"occurrence_id" uuid, "confidence" numeric(5,4), "approved_by" uuid, ` +
        `CONSTRAINT "UQ_event_relations_from_to_type" UNIQUE ("from_event_id", "to_event_id", "relation_type"), ` +
        `CONSTRAINT "CHK_event_relations_not_self" CHECK ("from_event_id" <> "to_event_id"), ` +
        `CONSTRAINT "PK_b04840f1dc7caec6d69351c951f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fc5d781e06c4f407969f7d146" ON "event_relations" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_relations_tenant_to" ON "event_relations" ("tenant_id", "to_event_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_relations_tenant_from" ON "event_relations" ("tenant_id", "from_event_id") `,
    );
    for (const [name, column] of [
      [FK.relationFrom, 'from_event_id'],
      [FK.relationTo, 'to_event_id'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "event_relations" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") ` +
          `REFERENCES "production_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }
  }

  private async createBulkJobs(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_job_kind" AS ENUM('bulk_code')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_job_state" AS ENUM('queued', 'running', 'completed', 'partial', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bulk_jobs" (${TENANT_SCOPED_COLUMNS}, "kind" "public"."bulk_job_kind" NOT NULL, ` +
        `"state" "public"."bulk_job_state" NOT NULL DEFAULT 'queued', "total" integer NOT NULL, ` +
        `"processed" integer NOT NULL DEFAULT '0', "failed" integer NOT NULL DEFAULT '0', ` +
        `"chunks" jsonb NOT NULL DEFAULT '[]', "payload" jsonb NOT NULL, "requested_by" uuid, ` +
        `"finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ce068dac8365125a4ce2f94c23e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9df48d1ec44bcd8648c488abe5" ON "bulk_jobs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_jobs_state_created" ON "bulk_jobs" ("state", "created_at") `,
    );
  }

  /** `occurrence_id` = own id for existing rows and, by trigger, for every insert that omits it. */
  private async addOccurrence(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "occurrence_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "production_events" SET "occurrence_id" = "id" WHERE "occurrence_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ALTER COLUMN "occurrence_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "superseded_by_event_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_production_events_tenant_occurrence" ON "production_events" ("tenant_id", "occurrence_id") `,
    );
    await queryRunner.query(
      `CREATE FUNCTION "production_events_default_occurrence"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
        `BEGIN NEW."occurrence_id" := COALESCE(NEW."occurrence_id", NEW."id"); RETURN NEW; END $fn$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_production_events_occurrence" BEFORE INSERT ON "production_events" ` +
        `FOR EACH ROW EXECUTE FUNCTION "production_events_default_occurrence"()`,
    );
  }

  /** Enum values cannot be dropped in Postgres: the type is recreated with `labels` (both directions). */
  private async recreateReviewKind(
    queryRunner: QueryRunner,
    labels: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_review_item_kind" RENAME TO "event_review_item_kind_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_review_item_kind" AS ENUM(${labels})`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_review_items" ALTER COLUMN "kind" TYPE "public"."event_review_item_kind" ` +
        `USING "kind"::"text"::"public"."event_review_item_kind"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_review_item_kind_old"`);
  }
}
