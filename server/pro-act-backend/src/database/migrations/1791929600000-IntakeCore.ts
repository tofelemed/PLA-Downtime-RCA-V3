import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columns of `TenantScopedEntity` (id, tenant, audit, row_version). */
const TENANT_SCOPED_COLUMNS =
  `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, ` +
  `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, ` +
  `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "row_version" integer NOT NULL`;

const FK = {
  jobConnection: 'FK_b9486287fd1fec7742fb17f4398',
  replayConnection: 'FK_8f4650b77f7041e2dbe388f351d',
  transitionJob: 'FK_4e9c180aa00c390fcad5e197a02',
};

/** Tables in creation order; `down()` drops them in reverse (indexes and FKs go with them). */
const TABLES = [
  'secrets',
  'integration_connections',
  'ingestion_jobs',
  'ingestion_job_transitions',
  'raw_observations',
  'raw_identities',
  'source_objects',
  'ingestion_exceptions',
  'replay_runs',
  'outbox',
  'inbox',
];

const TYPES = [
  'integration_source_type',
  'ingestion_job_state',
  'raw_observation_outcome',
  'source_object_state',
  'ingestion_error_code',
  'ingestion_exception_state',
  'replay_run_state',
  'outbox_state',
];

/**
 * Plan 1.5 (spec FND01–FND04, ING02, ING05, ING07, §14.2): durable intake core — connections and
 * secrets, leased ingestion jobs with an audit trail, the immutable raw store (range-partitioned by
 * `received_at`, monthly, with a global identity registry), source objects, the quarantine, replay
 * runs, and the transactional outbox/inbox. Also leases for `bulk_jobs` (plan 1.4 follow-up).
 *
 * Expand-only; nothing existing is changed apart from three nullable/defaulted `bulk_jobs` columns.
 */
export class IntakeCore1791929600000 implements MigrationInterface {
  name = 'IntakeCore1791929600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createEnums(queryRunner);
    await this.createConnections(queryRunner);
    await this.createJobs(queryRunner);
    await this.createJobTransitions(queryRunner);
    await this.createRawStore(queryRunner);
    await this.createPartitionFunctions(queryRunner);
    await this.createSourceObjects(queryRunner);
    await this.createQuarantine(queryRunner);
    await this.createReplayRuns(queryRunner);
    await this.createOutboxAndInbox(queryRunner);
    await this.addBulkJobLeases(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bulk_jobs" DROP COLUMN "attempts"`);
    await queryRunner.query(
      `ALTER TABLE "bulk_jobs" DROP COLUMN "lease_expiry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_jobs" DROP COLUMN "lease_owner"`,
    );
    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`DROP TABLE "${table}"`);
    }
    await queryRunner.query(
      `DROP FUNCTION "raw_observations_ensure_partition"(timestamptz)`,
    );
    await queryRunner.query(`DROP FUNCTION "raw_observations_immutable"()`);
    for (const type of [...TYPES].reverse()) {
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
    }
  }

  private async createEnums(queryRunner: QueryRunner): Promise<void> {
    const enums: Record<string, string> = {
      integration_source_type: `'pi_web_api', 'mqtt', 'kafka', 'opc_ua', 'rest_import', 'file_import', 'db_import', 'manual'`,
      ingestion_job_state: `'created', 'running', 'paused', 'draining', 'stopped', 'failed'`,
      raw_observation_outcome: `'accepted', 'revision', 'duplicate_content', 'stale', 'conflict', 'invalid', 'replayed'`,
      source_object_state: `'active', 'retracted', 'deleted_confirmed'`,
      ingestion_error_code:
        `'unknown_template', 'unknown_code', 'unknown_unit', 'mapping_ambiguous', 'mapping_invalid_target', ` +
        `'schema_invalid', 'unit_conflict', 'duration_conflict', 'order_conflict', 'no_handler', 'processing_failed'`,
      ingestion_exception_state: `'open', 'resolved', 'irrecoverable'`,
      replay_run_state: `'queued', 'running', 'completed', 'failed'`,
      outbox_state: `'pending', 'published', 'failed'`,
    };
    for (const type of TYPES) {
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${enums[type]})`,
      );
    }
  }

  private async createConnections(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "secrets" (${TENANT_SCOPED_COLUMNS}, "kind" character varying(32) NOT NULL, ` +
        `"ciphertext" text NOT NULL, CONSTRAINT "PK_d4ff48ddba1883d4dc142b9c697" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31dcd684e1d819c50c9aa5f827" ON "secrets" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "integration_connections" (${TENANT_SCOPED_COLUMNS}, ` +
        `"source_type" "public"."integration_source_type" NOT NULL, "display_name" character varying(255) NOT NULL, ` +
        `"endpoint_config" jsonb NOT NULL DEFAULT '{}', "secret_ref" text, "capabilities" jsonb NOT NULL DEFAULT '{}', ` +
        `"config_version" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, ` +
        `CONSTRAINT "PK_b1ec518bfa5fa7404045412de2e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69a0ace0ec077a4dd7f55ccda3" ON "integration_connections" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_integration_connections_tenant_source" ON "integration_connections" ("tenant_id", "source_type") `,
    );
  }

  private async createJobs(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ingestion_jobs" (${TENANT_SCOPED_COLUMNS}, "connection_id" uuid NOT NULL, ` +
        `"scope" jsonb NOT NULL DEFAULT '{}', "scope_hash" character varying(64) NOT NULL, ` +
        `"state" "public"."ingestion_job_state" NOT NULL DEFAULT 'created', "lease_owner" text, ` +
        `"lease_expiry" TIMESTAMP WITH TIME ZONE, "heartbeat_at" TIMESTAMP WITH TIME ZONE, "committed_cursor" jsonb, ` +
        `"last_observation_at" TIMESTAMP WITH TIME ZONE, "last_success_at" TIMESTAMP WITH TIME ZONE, ` +
        `"retry_count" integer NOT NULL DEFAULT '0', "last_error" text, ` +
        `"cadence" jsonb NOT NULL DEFAULT '{"intervalSeconds": 60}', "recovery" jsonb, ` +
        `"next_run_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "health" jsonb NOT NULL DEFAULT '{}', ` +
        `CONSTRAINT "PK_78a3cba789582043cfc8ba82edd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7911d18fe4de2373c4d79ced0" ON "ingestion_jobs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingestion_jobs_tenant_connection" ON "ingestion_jobs" ("tenant_id", "connection_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingestion_jobs_state_next_run" ON "ingestion_jobs" ("state", "next_run_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingestion_jobs_connection_scope_active" ON "ingestion_jobs" ("connection_id", "scope_hash") WHERE "state" <> 'stopped'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "${FK.jobConnection}" FOREIGN KEY ("connection_id") ` +
        `REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  private async createJobTransitions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ingestion_job_transitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"tenant_id" uuid NOT NULL, "job_id" uuid NOT NULL, "action" character varying(32) NOT NULL, ` +
        `"from_state" character varying(16) NOT NULL, "to_state" character varying(16) NOT NULL, ` +
        `"actor_id" uuid, "runner" text, "detail" jsonb, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_43d71cca3c167b9ad1440c30c3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingestion_job_transitions_job_at" ON "ingestion_job_transitions" ("job_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ingestion_job_transitions" ADD CONSTRAINT "${FK.transitionJob}" FOREIGN KEY ("job_id") ` +
        `REFERENCES "ingestion_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  /** Partitioned by receive time; the primary key must contain the partition key. */
  private async createRawStore(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "raw_observations" ("id" uuid NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"tenant_id" uuid NOT NULL, "connection_id" uuid NOT NULL, "message_id" text NOT NULL, ` +
        `"source_object_id" text NOT NULL, "source_revision" text, "content_hash" text NOT NULL, ` +
        `"kind" character varying(32), "operation" character varying(16), "event_time" TIMESTAMP WITH TIME ZONE, ` +
        `"payload" jsonb, "payload_ref" text, "payload_size" integer NOT NULL, "quality" jsonb, ` +
        `"source_cursor" jsonb, "mapping_version" integer NOT NULL DEFAULT '0', "correlation_id" text, ` +
        `"replay_run_id" uuid, "original_raw_id" uuid, "outcome" "public"."raw_observation_outcome" NOT NULL, ` +
        `CONSTRAINT "PK_a75cc6d8710913a02fefb609f97" PRIMARY KEY ("id", "received_at")) ` +
        `PARTITION BY RANGE ("received_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_observations_replay_run" ON "raw_observations" ("replay_run_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_observations_tenant_connection_received" ON "raw_observations" ("tenant_id", "connection_id", "received_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_observations_tenant_object_received" ON "raw_observations" ("tenant_id", "source_object_id", "received_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "raw_identities" ("tenant_id" uuid NOT NULL, "connection_id" uuid NOT NULL, ` +
        `"message_id" text NOT NULL, "raw_id" uuid NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"duplicate_count" integer NOT NULL DEFAULT '0', "last_duplicate_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "PK_bdce205305a10fd75b145869f6e" PRIMARY KEY ("tenant_id", "connection_id", "message_id"))`,
    );
  }

  /**
   * `raw_observations_ensure_partition(t)` creates the UTC month partition holding `t` if missing
   * (used here and by RawPartitionMaintenanceJob); a trigger makes raw rows immutable (FND01).
   */
  private async createPartitionFunctions(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      `CREATE FUNCTION "raw_observations_ensure_partition"(p_at timestamptz) RETURNS text LANGUAGE plpgsql AS $fn$ ` +
        `DECLARE v_start timestamp := date_trunc('month', p_at AT TIME ZONE 'UTC'); ` +
        `v_name text := 'raw_observations_y' || to_char(v_start, 'YYYY') || 'm' || to_char(v_start, 'MM'); ` +
        `BEGIN IF to_regclass('public.' || v_name) IS NULL THEN ` +
        `EXECUTE format('CREATE TABLE %I PARTITION OF "raw_observations" FOR VALUES FROM (%L) TO (%L)', ` +
        `v_name, (v_start AT TIME ZONE 'UTC'), ((v_start + interval '1 month') AT TIME ZONE 'UTC')); ` +
        `END IF; RETURN v_name; END $fn$`,
    );
    await queryRunner.query(
      `SELECT "raw_observations_ensure_partition"(now() + make_interval(months => m)) FROM generate_series(-1, 2) AS m`,
    );
    await queryRunner.query(
      `CREATE FUNCTION "raw_observations_immutable"() RETURNS trigger LANGUAGE plpgsql AS $fn$ ` +
        `BEGIN RAISE EXCEPTION 'raw_observations rows are immutable (FND01)'; END $fn$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "trg_raw_observations_immutable" BEFORE UPDATE OR DELETE ON "raw_observations" ` +
        `FOR EACH ROW EXECUTE FUNCTION "raw_observations_immutable"()`,
    );
  }

  private async createSourceObjects(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "source_objects" (${TENANT_SCOPED_COLUMNS}, "connection_id" uuid NOT NULL, ` +
        `"source_object_id" text NOT NULL, "kind" character varying(32) NOT NULL, "canonical_event_id" uuid, ` +
        `"signal_id" uuid, "latest_raw_id" uuid NOT NULL, "latest_received_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"latest_revision" text, "latest_hash" text NOT NULL, "latest_observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"normalized_raw_id" uuid, "first_seen" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"last_seen" TIMESTAMP WITH TIME ZONE NOT NULL, "state" "public"."source_object_state" NOT NULL DEFAULT 'active', ` +
        `CONSTRAINT "UQ_source_objects_identity" UNIQUE ("tenant_id", "connection_id", "source_object_id"), ` +
        `CONSTRAINT "PK_f8dc86db30494bfcb13b63469b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e75c7fdfd17fc23147ee6c18e4" ON "source_objects" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_objects_canonical_event" ON "source_objects" ("canonical_event_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_objects_tenant_connection_observed" ON "source_objects" ("tenant_id", "connection_id", "latest_observed_at") `,
    );
  }

  private async createQuarantine(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ingestion_exceptions" (${TENANT_SCOPED_COLUMNS}, "connection_id" uuid NOT NULL, ` +
        `"source_object_id" text NOT NULL, "raw_id" uuid NOT NULL, "raw_received_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"error_code" "public"."ingestion_error_code" NOT NULL, "detail" jsonb NOT NULL DEFAULT '{}', ` +
        `"state" "public"."ingestion_exception_state" NOT NULL DEFAULT 'open', "owner_id" uuid, ` +
        `"first_seen" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"occurrences" integer NOT NULL DEFAULT '1', "resolution" jsonb, "replay_run_id" uuid, ` +
        `CONSTRAINT "PK_211ed48b041aa386662207192f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d7e8e30b31a645b5ce4b323f0" ON "ingestion_exceptions" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ingestion_exceptions_tenant_state_last_seen" ON "ingestion_exceptions" ("tenant_id", "state", "last_seen") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ingestion_exceptions_open_object_code" ON "ingestion_exceptions" ` +
        `("tenant_id", "connection_id", "source_object_id", "error_code") WHERE "state" = 'open'`,
    );
  }

  private async createReplayRuns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "replay_runs" (${TENANT_SCOPED_COLUMNS}, "connection_id" uuid NOT NULL, ` +
        `"from_time" TIMESTAMP WITH TIME ZONE, "to_time" TIMESTAMP WITH TIME ZONE, "scopes" jsonb NOT NULL DEFAULT '{}', ` +
        `"reason" text NOT NULL, "dry_run" boolean NOT NULL DEFAULT false, ` +
        `"state" "public"."replay_run_state" NOT NULL DEFAULT 'queued', "counts" jsonb NOT NULL DEFAULT '{}', ` +
        `"requested_by" uuid, "lease_owner" text, "lease_expiry" TIMESTAMP WITH TIME ZONE, "cursor" text, ` +
        `"last_error" text, "finished_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "PK_5bc70c62a4cf238fd561292fa2e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ce0e9b621d1ae4c01c4fb937e" ON "replay_runs" ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_replay_runs_tenant_connection" ON "replay_runs" ("tenant_id", "connection_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_replay_runs_state_created" ON "replay_runs" ("state", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "replay_runs" ADD CONSTRAINT "${FK.replayConnection}" FOREIGN KEY ("connection_id") ` +
        `REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  private async createOutboxAndInbox(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbox" ("id" BIGSERIAL NOT NULL, "tenant_id" uuid NOT NULL, ` +
        `"aggregate_type" character varying(64) NOT NULL, "aggregate_id" character varying(128) NOT NULL, ` +
        `"type" character varying(64) NOT NULL, "version" integer NOT NULL DEFAULT '0', "payload" jsonb NOT NULL, ` +
        `"scope" character varying(128), "state" "public"."outbox_state" NOT NULL DEFAULT 'pending', ` +
        `"attempts" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_340ab539f309f03bdaa14aa7649" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_tenant_aggregate" ON "outbox" ("tenant_id", "aggregate_type", "aggregate_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_state_next_attempt" ON "outbox" ("state", "next_attempt_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inbox" ("delivery_key" text NOT NULL, "tenant_id" uuid NOT NULL, ` +
        `"scope" character varying(64) NOT NULL, "type" character varying(64) NOT NULL, ` +
        `"received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "PK_99eaf0d82ae7cfa0844a03e2272" PRIMARY KEY ("delivery_key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbox_tenant_scope_received" ON "inbox" ("tenant_id", "scope", "received_at") `,
    );
  }

  private async addBulkJobLeases(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bulk_jobs" ADD "lease_owner" text`);
    await queryRunner.query(
      `ALTER TABLE "bulk_jobs" ADD "lease_expiry" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_jobs" ADD "attempts" integer NOT NULL DEFAULT '0'`,
    );
  }
}
