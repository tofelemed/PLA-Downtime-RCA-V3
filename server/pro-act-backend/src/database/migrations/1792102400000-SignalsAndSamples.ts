import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const ENUMS: Record<string, string> = {
  signal_semantic_type: `'rate', 'counter', 'state', 'quality', 'level', 'output_increment', 'other'`,
  signal_rate_timebase: `'s', 'min', 'h', 'd'`,
  signal_interpolation: `'step', 'linear'`,
  signal_reset_policy: `'none', 'known_instant', 'detect_drop'`,
  measurement_sample_quality: `'good', 'uncertain', 'bad', 'missing'`,
  signal_backfill_state: `'queued', 'running', 'completed', 'failed'`,
};

const ERROR_CODES_1_5 =
  `'unknown_template', 'unknown_code', 'unknown_unit', 'mapping_ambiguous', 'mapping_invalid_target', ` +
  `'schema_invalid', 'unit_conflict', 'duration_conflict', 'order_conflict', 'no_handler', 'processing_failed'`;

const FK = {
  signalConnection: 'FK_948d720721b85d24a5809ed9fd1',
  signalUnit: 'FK_a409efa7123360cad893c419fe4',
  sampleSignal: 'FK_2192b407182f3eb16cf7c1be47f',
  summarySignal: 'FK_ca02434414b6d317b7554719e0a',
  backfillSignal: 'FK_186de18d2f68699b94f11d202e8',
};

/** `\` and `/` are one separator, runs collapse, ends trimmed, lower case (= `normalizePath`, plan 1.3). */
const ELEMENT_PATH =
  `lower(regexp_replace(regexp_replace(translate(trim(split_part(h."tag_path", '|', 1)), chr(92), '/'), ` +
  `'/+', '/', 'g'), '^/|/$', '', 'g'))`;

/**
 * Plan 1.7 (PI07–PI09, §14.2, §5.1): typed signals, versioned measurement samples (range-partitioned
 * monthly by `observed_at`, immutable), validated PI `Total` summaries of rate signals, signal backfill
 * runs, and the quarantine code `unknown_signal`. Signals are seeded from `historian_tags` that are bound
 * to a unit (crosswalk below). Expand-only; `down()` drops everything it created.
 */
export class SignalsAndSamples1792102400000 implements MigrationInterface {
  name = 'SignalsAndSamples1792102400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of Object.entries(ENUMS)) {
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${values})`,
      );
    }
    await this.createSignals(queryRunner);
    await this.createSamples(queryRunner);
    await this.createSummariesAndRuns(queryRunner);
    await this.addErrorCode(queryRunner);
    await this.addForeignKeys(queryRunner);
    await this.seedFromHistorianTags(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, fk] of [
      ['signal_backfill_runs', FK.backfillSignal],
      ['signal_summaries', FK.summarySignal],
      ['measurement_samples', FK.sampleSignal],
      ['signals', FK.signalUnit],
      ['signals', FK.signalConnection],
    ]) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
    }
    await this.removeErrorCode(queryRunner);
    for (const table of [
      'signal_backfill_runs',
      'signal_summaries',
      'measurement_samples',
      'signals',
    ]) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
    await queryRunner.query(
      `DROP FUNCTION "measurement_samples_ensure_partition"(timestamptz)`,
    );
    await queryRunner.query(`DROP FUNCTION "measurement_samples_immutable"()`);
    for (const type of Object.keys(ENUMS).reverse()) {
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
    }
  }

  private async createSignals(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "signals" (${TENANT_SCOPED_COLUMNS}, "connection_id" uuid NOT NULL, ` +
        `"name" character varying(255) NOT NULL, "source_key" text NOT NULL, "source_binding" jsonb NOT NULL DEFAULT '{}', ` +
        `"unit_id" uuid NOT NULL, "asset_id" uuid, "product_id" uuid, "semantic_type" "public"."signal_semantic_type" NOT NULL, ` +
        `"canonical_uom" character varying(32), "rate_timebase" "public"."signal_rate_timebase", ` +
        `"interpolation" "public"."signal_interpolation" NOT NULL DEFAULT 'step', "max_gap_seconds" integer NOT NULL DEFAULT '900', ` +
        `"reset_policy" "public"."signal_reset_policy" NOT NULL DEFAULT 'none', "rollover_modulus" numeric(24,8), ` +
        `"expected_min" numeric(24,8), "expected_max" numeric(24,8), "cadence_seconds" integer, ` +
        `"quality_policy" jsonb NOT NULL DEFAULT '{}', "is_authority" boolean NOT NULL DEFAULT false, ` +
        `"effective_from" TIMESTAMP WITH TIME ZONE NOT NULL, "effective_to" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', ` +
        `CONSTRAINT "CHK_signals_max_gap_positive" CHECK ("max_gap_seconds" > 0), ` +
        `CONSTRAINT "CHK_signals_effective_interval" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"), ` +
        `CONSTRAINT "PK_04eeac09c09b65bc55c628c101d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7b1b2bc0fa110afda818239468" ON "signals" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_signals_current_source" ON "signals" ("tenant_id", "connection_id", "source_key") WHERE "effective_to" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signals_tenant_unit" ON "signals" ("tenant_id", "unit_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signals_tenant_connection_source" ON "signals" ("tenant_id", "connection_id", "source_key", "effective_from") `,
    );
  }

  /** Partitioned by sample time (the primary key carries it); rows are immutable like raw observations. */
  private async createSamples(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "measurement_samples" ("id" uuid NOT NULL, "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"tenant_id" uuid NOT NULL, "signal_id" uuid NOT NULL, "value" numeric(24,8), "state_name" text, "state_value" integer, ` +
        `"quality" "public"."measurement_sample_quality" NOT NULL, "quality_flags" jsonb, "raw_id" uuid NOT NULL, ` +
        `"raw_received_at" TIMESTAMP WITH TIME ZONE NOT NULL, "source_revision" text NOT NULL, ` +
        `"inserted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "UQ_measurement_samples_identity" UNIQUE ("signal_id", "observed_at", "source_revision"), ` +
        `CONSTRAINT "PK_4d03c08dea906212173c500a637" PRIMARY KEY ("id", "observed_at")) ` +
        `PARTITION BY RANGE ("observed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_measurement_samples_tenant_signal_observed" ON "measurement_samples" ("tenant_id", "signal_id", "observed_at") `,
    );
    await queryRunner.query(
      `CREATE FUNCTION "measurement_samples_ensure_partition"(p_at timestamptz) RETURNS text LANGUAGE plpgsql AS $fn$ ` +
        `DECLARE v_start timestamp := date_trunc('month', p_at AT TIME ZONE 'UTC'); ` +
        `v_name text := 'measurement_samples_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM'); ` +
        `BEGIN IF to_regclass('public.' || v_name) IS NULL THEN ` +
        `EXECUTE format('CREATE TABLE %I PARTITION OF "measurement_samples" FOR VALUES FROM (%L) TO (%L)', ` +
        `v_name, (v_start AT TIME ZONE 'UTC'), ((v_start + interval '1 month') AT TIME ZONE 'UTC')); ` +
        `END IF; RETURN v_name; END $fn$`,
    );
    await queryRunner.query(
      `CREATE FUNCTION "measurement_samples_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
        `BEGIN RAISE EXCEPTION 'measurement_samples rows are immutable (a correction is a new revision)'; END $fn$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_measurement_samples_immutable" BEFORE UPDATE OR DELETE ON "measurement_samples" ` +
        `FOR EACH ROW EXECUTE FUNCTION "measurement_samples_immutable"()`,
    );
  }

  private async createSummariesAndRuns(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "signal_summaries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
        `"signal_id" uuid NOT NULL, "period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "period_end" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"total" numeric(24,8), "summary_type" character varying(32) NOT NULL, "calculation_basis" character varying(32) NOT NULL, ` +
        `"timebase" character varying(8) NOT NULL, "quality" "public"."measurement_sample_quality" NOT NULL, "raw_id" uuid NOT NULL, ` +
        `"raw_received_at" TIMESTAMP WITH TIME ZONE NOT NULL, "source_revision" text NOT NULL, ` +
        `"inserted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "UQ_signal_summaries_identity" UNIQUE ("signal_id", "period_start", "period_end", "source_revision"), ` +
        `CONSTRAINT "CHK_signal_summaries_period" CHECK ("period_end" > "period_start"), ` +
        `CONSTRAINT "PK_4cfd39df2e89e2727e2574cdd53" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signal_summaries_tenant_signal_period" ON "signal_summaries" ("tenant_id", "signal_id", "period_start") `,
    );
    await queryRunner.query(
      `CREATE TABLE "signal_backfill_runs" (${TENANT_SCOPED_COLUMNS}, "signal_id" uuid NOT NULL, ` +
        `"from_time" TIMESTAMP WITH TIME ZONE NOT NULL, "to_time" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"state" "public"."signal_backfill_state" NOT NULL DEFAULT 'queued', "reason" character varying(32) NOT NULL, ` +
        `"ingestion_job_id" uuid, "detail" jsonb, ` +
        `CONSTRAINT "CHK_signal_backfill_runs_interval" CHECK ("to_time" > "from_time"), ` +
        `CONSTRAINT "PK_08c7c642764f982d330ad3345c1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7dd5b7d5b3d980501f6e7f106e" ON "signal_backfill_runs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signal_backfill_runs_job" ON "signal_backfill_runs" ("ingestion_job_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signal_backfill_runs_tenant_signal_created" ON "signal_backfill_runs" ("tenant_id", "signal_id", "created_at") `,
    );
  }

  /** `unknown_signal` (a measurement for a stream no signal is bound to); the enum is rebuilt to stay revertible. */
  private async addErrorCode(queryRunner: QueryRunner): Promise<void> {
    await this.rebuildErrorCodes(
      queryRunner,
      `${ERROR_CODES_1_5}, 'unknown_signal'`,
    );
  }

  private async removeErrorCode(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "ingestion_exceptions" WHERE "error_code" = 'unknown_signal'`,
    );
    await this.rebuildErrorCodes(queryRunner, ERROR_CODES_1_5);
  }

  private async rebuildErrorCodes(
    queryRunner: QueryRunner,
    values: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_ingestion_exceptions_open_object_code"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ingestion_error_code" RENAME TO "ingestion_error_code_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ingestion_error_code" AS ENUM(${values})`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_exceptions" ALTER COLUMN "error_code" TYPE "public"."ingestion_error_code" ` +
        `USING "error_code"::"text"::"public"."ingestion_error_code"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ingestion_error_code_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingestion_exceptions_open_object_code" ON "ingestion_exceptions" ` +
        `("tenant_id", "connection_id", "source_object_id", "error_code") WHERE "state" = 'open'`,
    );
  }

  private async addForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const keys: Array<[string, string, string, string, string]> = [
      [
        'signals',
        FK.signalConnection,
        'connection_id',
        'integration_connections',
        'RESTRICT',
      ],
      ['signals', FK.signalUnit, 'unit_id', 'units', 'RESTRICT'],
      [
        'measurement_samples',
        FK.sampleSignal,
        'signal_id',
        'signals',
        'RESTRICT',
      ],
      [
        'signal_summaries',
        FK.summarySignal,
        'signal_id',
        'signals',
        'RESTRICT',
      ],
      [
        'signal_backfill_runs',
        FK.backfillSignal,
        'signal_id',
        'signals',
        'CASCADE',
      ],
    ];
    for (const [table, name, column, target, onDelete] of keys) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${target}"("id") ` +
          `ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }
  }

  /**
   * Crosswalk (plan 1.7 step 1): an enabled historian tag with a WebId becomes a signal when its tenant has
   * exactly one active PI connection and the AF element of its path (`\\srv\db\unit100|Rate` → element
   * `srv/db/unit100`) is mapped to exactly one unit by an active `exact_path` source mapping. The semantic
   * type is not guessed: seeded signals are `other` (no quantity) until an engineer sets type, timebase and
   * reset policy (a next version). Idempotent (`ON CONFLICT DO NOTHING`).
   */
  private async seedFromHistorianTags(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `WITH "tags" AS (
         SELECT h."id", h."tenant_id"::uuid AS "tenant_id", h."web_id", h."tag_name", h."tag_path", h."unit_of_measure",
                h."update_interval", ${ELEMENT_PATH} AS "element_path"
           FROM "historian_tags" h
          WHERE h."tenant_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND h."enabled" AND coalesce(h."web_id", '') <> '' AND coalesce(h."tag_path", '') <> ''),
       "pi" AS (
         SELECT "tenant_id", min("id"::text)::uuid AS "connection_id" FROM "integration_connections"
          WHERE "source_type" = 'pi_web_api' AND "is_active" GROUP BY "tenant_id" HAVING count(*) = 1),
       "targets" AS (
         SELECT t."id" AS "tag_id", min(sm."target_id"::text)::uuid AS "unit_id"
           FROM "tags" t JOIN "pi" ON "pi"."tenant_id" = t."tenant_id"
           JOIN "source_mappings" sm ON sm."tenant_id" = t."tenant_id" AND sm."is_active"
            AND sm."match_kind" = 'exact_path' AND sm."target_type" = 'unit' AND sm."source_system" IN ('PI', '*')
            AND (sm."connection_id" IS NULL OR sm."connection_id" = "pi"."connection_id")
            AND sm."normalized_value" = t."element_path"
          GROUP BY t."id" HAVING count(DISTINCT sm."target_id") = 1)
       INSERT INTO "signals" ("tenant_id", "connection_id", "name", "source_key", "source_binding", "unit_id",
              "semantic_type", "canonical_uom", "cadence_seconds", "effective_from", "row_version")
       SELECT t."tenant_id", "pi"."connection_id", left(t."tag_name", 255), t."web_id",
              jsonb_build_object('webId', t."web_id", 'path', t."tag_path", 'historianTagId', t."id"),
              g."unit_id", 'other', left(t."unit_of_measure", 32),
              CASE WHEN t."update_interval" > 0 THEN t."update_interval" END, to_timestamp(0), 1
         FROM "tags" t JOIN "pi" ON "pi"."tenant_id" = t."tenant_id"
         JOIN "targets" g ON g."tag_id" = t."id"
         JOIN "units" u ON u."id" = g."unit_id" AND u."tenant_id" = t."tenant_id"
       ON CONFLICT DO NOTHING`,
    );
  }
}
