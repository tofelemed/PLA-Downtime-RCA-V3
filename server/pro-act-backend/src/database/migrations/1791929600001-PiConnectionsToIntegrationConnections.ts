import { MigrationInterface, QueryRunner } from 'typeorm';

const UUID_PATTERN =
  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

/** What the PI Web API adapter declares (ING07); replay is served from the raw store. */
const PI_CAPABILITIES = JSON.stringify({
  replay: true,
  corrections: true,
  deletions: false,
  quality: false,
  sourceTimestamps: true,
  sequence: false,
});

/**
 * Plan 1.5 step 7 (expand): every `pi_connections` row with a uuid tenant gets an
 * `integration_connections` row with the **same id**, its endpoint settings in `endpoint_config` and its
 * AES-GCM password copied into `secrets` (`secret_ref = secrets:<id>`). `pi_connections` stays the table
 * v1 reads and writes; `IntegrationConnectionService.mirrorPiConnection` refreshes the copy on every
 * pull. Idempotent (rows already mirrored are skipped).
 */
export class PiConnectionsToIntegrationConnections1791929600001
  implements MigrationInterface
{
  name = 'PiConnectionsToIntegrationConnections1791929600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `WITH "src" AS MATERIALIZED (
         SELECT "pc".*, CASE WHEN coalesce("pc"."password_encrypted", '') <> '' THEN uuid_generate_v4() END AS "secret_id"
           FROM "pi_connections" "pc"
          WHERE "pc"."tenant_id" ~* $1
            AND NOT EXISTS (SELECT 1 FROM "integration_connections" "ic" WHERE "ic"."id" = "pc"."id")
       ), "secret_rows" AS (
         INSERT INTO "secrets" ("id", "tenant_id", "kind", "ciphertext", "row_version", "created_at", "updated_at")
         SELECT "secret_id", "tenant_id"::uuid, 'pi_password', "password_encrypted", 1, "created_at", "updated_at"
           FROM "src" WHERE "secret_id" IS NOT NULL
       )
       INSERT INTO "integration_connections" ("id", "tenant_id", "source_type", "display_name", "endpoint_config",
              "secret_ref", "capabilities", "config_version", "is_active", "row_version", "created_at", "updated_at")
       SELECT "id", "tenant_id"::uuid, 'pi_web_api', "connection_name",
              jsonb_strip_nulls(jsonb_build_object('piWebApiUrl', "pi_web_api_url", 'username', "username",
                                                   'afDatabasePath', "af_database_path")),
              CASE WHEN "secret_id" IS NOT NULL THEN 'secrets:' || "secret_id" END,
              $2::jsonb, 1, "is_active", 1, "created_at", "updated_at"
         FROM "src"`,
      [UUID_PATTERN, PI_CAPABILITIES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const mirrored = `SELECT "ic"."id" FROM "integration_connections" "ic"
       JOIN "pi_connections" "pc" ON "pc"."id" = "ic"."id" WHERE "ic"."source_type" = 'pi_web_api'`;
    await queryRunner.query(
      `DELETE FROM "replay_runs" WHERE "connection_id" IN (${mirrored})`,
    );
    await queryRunner.query(
      `DELETE FROM "ingestion_jobs" WHERE "connection_id" IN (${mirrored})`,
    );
    await queryRunner.query(
      `DELETE FROM "secrets" WHERE 'secrets:' || "id"::text IN (
         SELECT "secret_ref" FROM "integration_connections" WHERE "id" IN (${mirrored}))`,
    );
    await queryRunner.query(
      `DELETE FROM "integration_connections" WHERE "id" IN (${mirrored})`,
    );
  }
}
