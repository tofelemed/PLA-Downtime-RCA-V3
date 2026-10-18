import { EntityManager } from 'typeorm';

/**
 * Which of `userIds` may be told about work of the plant (item 6): active users whose home plant it is, or
 * who hold a scope grant or a delegation in force in it. Global roles without a home or grant there are left
 * out, like `roleHoldersOf`. Ids that are not users (legacy free-text assignees) drop out too.
 */
export async function plantMembersOf(
  manager: EntityManager,
  tenantId: string,
  userIds: readonly string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT u."id"::text AS "id" FROM "users" u
      WHERE u."id"::text = ANY($2::text[]) AND u."is_active" IS DISTINCT FROM false
        AND (u."tenant_id" = $1
             OR EXISTS (SELECT 1 FROM "user_scopes" s WHERE s."user_id" = u."id" AND s."tenant_id" = $1)
             OR EXISTS (SELECT 1 FROM "role_delegations" d
                         WHERE d."delegate_id" = u."id" AND d."tenant_id" = $1 AND d."revoked_at" IS NULL
                           AND d."valid_from" <= now() AND d."valid_until" > now()))`,
    [tenantId, [...new Set(userIds)]],
  );
  return new Set(rows.map((r) => r.id));
}
