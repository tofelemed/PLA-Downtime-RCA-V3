import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 0.4 part 2 (spec WF05, API02):
 * - user_scopes: membership of a user in a tenant/site/unit with a role; one tenant-wide row is
 *   backfilled per existing user from users.tenant_id / users.role (D06 role mapping)
 * - idempotency_keys: stored outcomes of @Idempotent() commands (24 h)
 * - production_events.row_version: optimistic concurrency for ETag / If-Match on the v2 resource
 *
 * Expand-only; constraint names follow TypeORM's DefaultNamingStrategy so the entity-parity check
 * (migrations.int-spec.ts) stays clean.
 */
export class UserScopesAndIdempotency1791497600000
  implements MigrationInterface
{
  name = 'UserScopesAndIdempotency1791497600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_scope_kind" AS ENUM('tenant', 'site', 'unit')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_scopes" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"tenant_id" uuid NOT NULL, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"created_by" uuid, ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_by" uuid, ` +
        `"row_version" integer NOT NULL, ` +
        `"user_id" uuid NOT NULL, ` +
        `"scope_kind" "public"."user_scope_kind" NOT NULL, ` +
        `"scope_id" uuid NOT NULL, ` +
        `"role" character varying(50) NOT NULL, ` +
        `CONSTRAINT "UQ_user_scopes_user_scope_role" UNIQUE ("user_id", "scope_kind", "scope_id", "role"), ` +
        `CONSTRAINT "PK_e8dc0040d99fcf1b9fc8dcc3d30" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29fd3a7a95156f68d757b2aa36" ON "user_scopes" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_scopes_tenant_user" ON "user_scopes" ("tenant_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_scopes" ADD CONSTRAINT "FK_e23369bd4a15d31af02810a2690" ` +
        `FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" (` +
        `"tenant_id" uuid NOT NULL, ` +
        `"key" character varying(255) NOT NULL, ` +
        `"request_hash" character varying(64) NOT NULL, ` +
        `"response_status" integer NOT NULL, ` +
        `"response_body" jsonb, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `CONSTRAINT "PK_b5c6db50392003e35d51ef7aba7" PRIMARY KEY ("tenant_id", "key"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_idempotency_keys_expires_at" ON "idempotency_keys" ("expires_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "production_events" ADD "row_version" integer NOT NULL DEFAULT '1'`,
    );

    // Backfill: every existing user becomes a tenant-wide member of their tenant with the D06 role
    await queryRunner.query(
      `INSERT INTO "user_scopes" ("id", "tenant_id", "user_id", "scope_kind", "scope_id", "role", "row_version") ` +
        `SELECT uuid_generate_v4(), u."tenant_id", u."id", 'tenant', u."tenant_id", ` +
        `CASE u."role" ` +
        `WHEN 'TenantAdmin' THEN 'manager_approver' ` +
        `WHEN 'Manager' THEN 'manager_approver' ` +
        `WHEN 'Analyst' THEN 'production_engineer' ` +
        `WHEN 'Engineer' THEN 'production_engineer' ` +
        `WHEN 'Operator' THEN 'operator' ` +
        `ELSE u."role" END, 1 ` +
        `FROM "users" u WHERE u."tenant_id" IS NOT NULL ` +
        `ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "production_events" DROP COLUMN "row_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_idempotency_keys_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(
      `ALTER TABLE "user_scopes" DROP CONSTRAINT "FK_e23369bd4a15d31af02810a2690"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_scopes_tenant_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29fd3a7a95156f68d757b2aa36"`,
    );
    await queryRunner.query(`DROP TABLE "user_scopes"`);
    await queryRunner.query(`DROP TYPE "public"."user_scope_kind"`);
  }
}
