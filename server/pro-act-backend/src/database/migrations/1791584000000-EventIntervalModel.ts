import { MigrationInterface, QueryRunner } from 'typeorm';

const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const DURATION_SECONDS_EXPRESSION =
  'CASE WHEN "end_time" IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM ("end_time" - "start_time")) END';
/** PI open frames used to be stored with this end time (B6) */
const OPEN_FRAME_SENTINEL = '9999-01-01T00:00:00Z';

const ENUMS: ReadonlyArray<
  [column: string, type: string, labels: string[], fallback: string]
> = [
  [
    'physical_type',
    'production_event_physical_type',
    ['downtime', 'slowdown', 'quality_loss', 'production_output', 'advisory'],
    'advisory',
  ],
  [
    'schedule_class',
    'production_event_schedule_class',
    ['planned', 'unplanned', 'external', 'unknown'],
    'unknown',
  ],
  [
    'oee_component',
    'production_event_oee_component',
    ['availability', 'performance', 'quality', 'idle', 'none'],
    'none',
  ],
  [
    'impact_mode',
    'production_event_impact_mode',
    ['none', 'full_stop', 'fractional', 'measured'],
    'none',
  ],
  [
    'physical_state',
    'production_event_physical_state',
    ['open', 'closed', 'superseded', 'retracted'],
    'open',
  ],
  [
    'coding_state',
    'production_event_coding_state',
    ['uncoded', 'coded', 'reviewed'],
    'uncoded',
  ],
  [
    'rca_state',
    'production_event_rca_state',
    ['none', 'required', 'linked', 'completed'],
    'none',
  ],
  [
    'source_kind',
    'production_event_source_kind',
    ['manual', 'source', 'derived', 'imported'],
    'manual',
  ],
];

const INDEXES: ReadonlyArray<[name: string, definition: string]> = [
  [
    'IDX_production_events_tenant_unit_start',
    '("tenant_id", "unit_id", "start_time")',
  ],
  [
    'IDX_production_events_tenant_asset_start',
    '("tenant_id", "asset_id", "start_time")',
  ],
  [
    'IDX_production_events_tenant_type_start',
    '("tenant_id", "physical_type", "start_time")',
  ],
  [
    'IDX_production_events_open_by_unit',
    '("tenant_id", "unit_id") WHERE "end_time" IS NULL',
  ],
];

/**
 * Plan 1.1 (spec §3.2, §3.3, DT05, DT08, DT11, DB02, DB03): interval model for `production_events`.
 *
 * Expand-only. New columns carry safe defaults (advisory, unknown, none, open, uncoded, manual) and are
 * then backfilled set-based from the legacy columns with the same rules as `classifyLegacyEventType`,
 * `fromLegacyStatus` and `sourceKindOf` (src/domain/events; the integration spec pins SQL and TS
 * together). The legacy `status` label is not rewritten: the adapter rewrites it on the next write.
 * The interval CHECK is added NOT VALID and validated only when no legacy row breaks it (the backfill
 * report lists them). `tenant_uuid` is the expand half of the varchar → uuid change, kept in sync by
 * trigger until v1 reads switch over.
 */
export class EventIntervalModel1791584000000 implements MigrationInterface {
  name = 'EventIntervalModel1791584000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumns(queryRunner);
    await this.backfill(queryRunner);
    await this.addTenantUuidSync(queryRunner);
    await this.addConstraintsAndIndexes(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of INDEXES) {
      await queryRunner.query(`DROP INDEX "public"."${name}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_interval"`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP CONSTRAINT "CHK_production_events_impact_fraction"`,
    );
    await queryRunner.query(
      `DROP TRIGGER "trg_production_events_tenant_uuid" ON "production_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "production_events_sync_tenant_uuid"()`,
    );
    // Put the PI sentinel back so v1 readers see the rows as before
    await queryRunner.query(
      `UPDATE "production_events" SET "end_time" = "legacy_end_sentinel" WHERE "legacy_end_sentinel" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ALTER COLUMN "cost" TYPE numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ALTER COLUMN "quantity" TYPE numeric(10,2)`,
    );
    for (const column of [
      'tenant_uuid',
      'legacy_end_sentinel',
      'legacy_duration_unit_assumed',
      'legacy_duration',
      'canonical_id',
      'quantity_uom',
      'impact_fraction',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "production_events" DROP COLUMN "${column}"`,
      );
    }
    for (const [column, type] of [...ENUMS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "production_events" DROP COLUMN "${column}"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
    }
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'GENERATED_COLUMN' AND "name" = 'duration_seconds' ` +
        `AND "database" = current_database() AND "schema" = 'public' AND "table" = 'production_events'`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "duration_seconds"`,
    );
  }

  private async addColumns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "duration_seconds" numeric(18,3) ` +
        `GENERATED ALWAYS AS (${DURATION_SECONDS_EXPRESSION}) STORED`,
    );
    // TypeORM keeps generated-column expressions here; the schema diff reads them back
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "typeorm_metadata" ("type" character varying NOT NULL, "database" character varying, ` +
        `"schema" character varying, "table" character varying, "name" character varying, "value" text)`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") ` +
        `VALUES (current_database(), 'public', 'production_events', 'GENERATED_COLUMN', 'duration_seconds', $1)`,
      [DURATION_SECONDS_EXPRESSION],
    );
    for (const [column, type, labels, fallback] of ENUMS) {
      const values = labels.map((label) => `'${label}'`).join(', ');
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${values})`,
      );
      await queryRunner.query(
        `ALTER TABLE "production_events" ADD "${column}" "public"."${type}" NOT NULL DEFAULT '${fallback}'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "impact_fraction" numeric(9,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "quantity_uom" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "canonical_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "legacy_duration" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "legacy_duration_unit_assumed" character varying(8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "legacy_end_sentinel" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "tenant_uuid" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ALTER COLUMN "quantity" TYPE numeric(24,8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ALTER COLUMN "cost" TYPE numeric(24,8)`,
    );
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    // B6: open PI frames become open intervals; the raw value is kept
    await queryRunner.query(
      `UPDATE "production_events" SET "legacy_end_sentinel" = "end_time", "end_time" = NULL WHERE "end_time" >= $1`,
      [OPEN_FRAME_SENTINEL],
    );
    // MIG §18.2: only the PI mappings documented minutes; every other legacy duration is left for review
    await queryRunner.query(
      `UPDATE "production_events" SET "legacy_duration" = "duration", ` +
        `"legacy_duration_unit_assumed" = CASE WHEN "source" IN ('PI', 'Simulated PI') THEN 'min' ELSE NULL END ` +
        `WHERE "duration" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "production_events" SET ` +
        `"physical_type" = CASE "event_type" WHEN 'ProductionLoss' THEN 'downtime' WHEN 'ProductionOutput' THEN 'production_output' ELSE 'advisory' END::"production_event_physical_type", ` +
        `"oee_component" = CASE "event_type" WHEN 'ProductionLoss' THEN 'availability' ELSE 'none' END::"production_event_oee_component", ` +
        `"impact_mode" = CASE "event_type" WHEN 'ProductionLoss' THEN 'full_stop' ELSE 'none' END::"production_event_impact_mode", ` +
        `"source_kind" = CASE WHEN "source" IS NULL OR "source" = 'Manual' THEN 'manual' ELSE 'source' END::"production_event_source_kind", ` +
        `"physical_state" = CASE WHEN "status" = 'Cancelled' THEN 'retracted' WHEN "end_time" IS NOT NULL THEN 'closed' ELSE 'open' END::"production_event_physical_state", ` +
        `"coding_state" = CASE WHEN "status" IN ('Closed', 'Completed') THEN 'reviewed' ` +
        `WHEN "status" = 'Coded' OR "reason_code_id" IS NOT NULL THEN 'coded' ELSE 'uncoded' END::"production_event_coding_state", ` +
        `"rca_state" = CASE WHEN "status" = 'RCA Required' THEN 'required' ` +
        `WHEN "status" IN ('Investigating', 'In Progress') THEN 'linked' ` +
        `WHEN "status" IN ('Completed', 'Closed') THEN CASE WHEN "rca_id" IS NOT NULL THEN 'completed' ELSE 'none' END ` +
        `WHEN "rca_id" IS NOT NULL THEN 'linked' ELSE 'none' END::"production_event_rca_state", ` +
        `"canonical_id" = "id"`,
    );
  }

  private async addTenantUuidSync(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE FUNCTION "production_events_sync_tenant_uuid"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
        `BEGIN NEW."tenant_uuid" := CASE WHEN NEW."tenant_id" ~ '${UUID_PATTERN}' THEN NEW."tenant_id"::uuid ELSE NULL END; ` +
        `RETURN NEW; END $fn$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_production_events_tenant_uuid" BEFORE INSERT OR UPDATE OF "tenant_id" ` +
        `ON "production_events" FOR EACH ROW EXECUTE FUNCTION "production_events_sync_tenant_uuid"()`,
    );
    await queryRunner.query(
      `UPDATE "production_events" SET "tenant_uuid" = "tenant_id"::uuid WHERE "tenant_id" ~ '${UUID_PATTERN}'`,
    );
  }

  private async addConstraintsAndIndexes(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_impact_fraction" ` +
        `CHECK ("impact_fraction" IS NULL OR ("impact_fraction" >= 0 AND "impact_fraction" <= 1))`,
    );
    await queryRunner.query(
      `ALTER TABLE "production_events" ADD CONSTRAINT "CHK_production_events_interval" ` +
        `CHECK ("end_time" IS NULL OR "end_time" > "start_time") NOT VALID`,
    );
    await queryRunner.query(
      `DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM "production_events" WHERE "end_time" <= "start_time") THEN ` +
        `ALTER TABLE "production_events" VALIDATE CONSTRAINT "CHK_production_events_interval"; END IF; END $do$`,
    );
    for (const [name, definition] of INDEXES) {
      await queryRunner.query(
        `CREATE INDEX "${name}" ON "production_events" ${definition}`,
      );
    }
  }
}
