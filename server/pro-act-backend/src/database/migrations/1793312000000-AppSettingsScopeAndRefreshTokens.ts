import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 3.11 (NFR01, D15 JWT hardening):
 *
 * - `auth_refresh_tokens`: one row per issued refresh token (`jti`), grouped in sign-in families for
 *   rotation and reuse detection. Holds no token material.
 * - `app_settings` gains an owner: `tenant_id` / `user_id` (both null = application-wide). Existing
 *   per-user tab visibility rows (`tabVisibility.<tenant>.<user>`) are attributed from their key, and the
 *   retired global `plantSelection` row from the tenant stored in its value, so only that tenant's
 *   members can still read it. No value is changed; `down()` drops the two columns and the table.
 */
const UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const UUID_ONLY = new RegExp(`^${UUID}$`);

const UP: readonly string[] = [
  `CREATE TABLE "auth_refresh_tokens" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoke_reason" character varying(32), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df6893d2063a4ea7bbf1eda31e5" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_auth_refresh_tokens_expires" ON "auth_refresh_tokens" ("expires_at") `,
  `CREATE INDEX "IDX_auth_refresh_tokens_user" ON "auth_refresh_tokens" ("user_id") `,
  `CREATE INDEX "IDX_auth_refresh_tokens_family" ON "auth_refresh_tokens" ("family_id") `,
  `ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "FK_f795ad14f31838e3ddc663ee150" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "app_settings" ADD "tenant_id" uuid`,
  `ALTER TABLE "app_settings" ADD "user_id" uuid`,
  `CREATE INDEX "IDX_app_settings_tenant_user" ON "app_settings" ("tenant_id", "user_id") `,
  `UPDATE "app_settings"
      SET "tenant_id" = lower(split_part("key", '.', 2))::uuid,
          "user_id" = lower(split_part("key", '.', 3))::uuid
    WHERE "key" ~ '^tabVisibility\\.${UUID}\\.${UUID}$'`,
];

const DOWN: readonly string[] = [
  `DROP INDEX "public"."IDX_app_settings_tenant_user"`,
  `ALTER TABLE "app_settings" DROP COLUMN "user_id"`,
  `ALTER TABLE "app_settings" DROP COLUMN "tenant_id"`,
  `ALTER TABLE "auth_refresh_tokens" DROP CONSTRAINT "FK_f795ad14f31838e3ddc663ee150"`,
  `DROP TABLE "auth_refresh_tokens"`,
];

/** Tenant id stored in a `plantSelection` value, or null when the value is not that shape. */
function plantSelectionTenant(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const tenant = (parsed as { tenant?: { id?: unknown } } | null)?.tenant;
    const id = typeof tenant?.id === 'string' ? tenant.id.toLowerCase() : '';
    return UUID_ONLY.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function attributePlantSelection(
  queryRunner: QueryRunner,
): Promise<void> {
  const rows = (await queryRunner.query(
    `SELECT "value" FROM "app_settings" WHERE "key" = 'plantSelection'`,
  )) as Array<{ value: string }>;
  const tenantId = rows.length > 0 ? plantSelectionTenant(rows[0].value) : null;
  if (!tenantId) return;
  await queryRunner.query(
    `UPDATE "app_settings" SET "tenant_id" = $1 WHERE "key" = 'plantSelection'`,
    [tenantId],
  );
}

export class AppSettingsScopeAndRefreshTokens1793312000000
  implements MigrationInterface
{
  name = 'AppSettingsScopeAndRefreshTokens1793312000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
    await attributePlantSelection(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
