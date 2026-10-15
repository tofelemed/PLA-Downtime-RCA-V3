import { EntityManager } from 'typeorm';
import { LEGACY_ROLES, mapLegacyRole } from '../auth/roles/role-model';

/** Legacy `users.role` values that stand for a scope role in the user's home plant (TenantAdmin → manager_approver). */
export function legacyRolesFor(role: string): string[] {
  return LEGACY_ROLES.filter(
    (legacy) => legacy !== role && mapLegacyRole(legacy) === role,
  );
}

/**
 * Active users who hold `role` for a unit of the plant: a scope grant of the role on the plant, the unit's
 * site or the unit, or a legacy home-plant role that maps to it. Global roles (SuperAdmin / OrgAdmin)
 * satisfy every role for access but are not addressees of a role's work (they would get every
 * notification of every plant).
 */
export async function roleHoldersOf(
  manager: EntityManager,
  input: { tenantId: string; role: string; unitId: string },
): Promise<string[]> {
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT u."id"::text AS "id" FROM "users" u
      WHERE u."is_active" IS DISTINCT FROM false
        AND (EXISTS (SELECT 1 FROM "user_scopes" s
                      WHERE s."user_id" = u."id" AND s."tenant_id" = $1 AND s."role" = $2
                        AND (s."scope_kind" = 'tenant'
                             OR (s."scope_kind" = 'unit' AND s."scope_id" = $3::uuid)
                             OR (s."scope_kind" = 'site'
                                 AND s."scope_id" = (SELECT n."site_id" FROM "units" n WHERE n."id" = $3::uuid))))
             OR (u."tenant_id" = $1 AND u."role" = ANY($4::text[])))
      ORDER BY u."id"`,
    [input.tenantId, input.role, input.unitId, legacyRolesFor(input.role)],
  );
  return rows.map((r) => r.id);
}
