import { MigrationInterface, QueryRunner } from 'typeorm';

/** D06 legacy role → scope role (SuperAdmin / OrgAdmin stay global and get no mirror). */
const MAPPED_ROLE = `CASE u."role"
  WHEN 'TenantAdmin' THEN 'manager_approver'
  WHEN 'Manager' THEN 'manager_approver'
  WHEN 'Analyst' THEN 'production_engineer'
  WHEN 'Engineer' THEN 'production_engineer'
  WHEN 'Operator' THEN 'operator' END`;

/** Deterministic id, so `down` removes exactly the rows this migration inserted. */
const MIRROR_ID = `md5('legacy-role-mirror-backfill:' || u."id"::text)::uuid`;

/**
 * QA audit 2026-10-19 (guide roles only): the D06 legacy mapping now applies in a plant only while the
 * user holds no own grant there (`legacyRolesApplying`). Users who hold another grant in their home plant
 * but never got the home-role mirror row would silently lose the mapped role; this inserts that mirror for
 * them, so every effective role stays exactly as before the rule change. Removing a mirror afterwards (the
 * Users page, or `scripts/marun-train/apply-guide-roles.ts`) is what really removes the role. Idempotent.
 */
export class LegacyRoleMirrorBackfill1794222800000
  implements MigrationInterface
{
  name = 'LegacyRoleMirrorBackfill1794222800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "user_scopes" ("id", "tenant_id", "user_id", "scope_kind", "scope_id", "role", "row_version")
       SELECT ${MIRROR_ID}, u."tenant_id", u."id", 'tenant', u."tenant_id", ${MAPPED_ROLE}, 1
         FROM "users" u
        WHERE u."tenant_id" IS NOT NULL
          AND u."role" IN ('TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator')
          AND EXISTS (SELECT 1 FROM "user_scopes" s
                       WHERE s."user_id" = u."id" AND s."tenant_id" = u."tenant_id")
          AND NOT EXISTS (SELECT 1 FROM "user_scopes" m
                           WHERE m."user_id" = u."id" AND m."tenant_id" = u."tenant_id"
                             AND m."scope_kind" = 'tenant' AND m."scope_id" = u."tenant_id"
                             AND m."role" = ${MAPPED_ROLE})
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "user_scopes" s USING "users" u
        WHERE s."user_id" = u."id" AND s."id" = ${MIRROR_ID}`,
    );
  }
}
