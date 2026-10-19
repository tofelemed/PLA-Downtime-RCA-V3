import { isLegacyRole, mapLegacyRole } from '../../../auth/roles/role-model';

/** One own grant of a user in the acting plant (any scope kind). */
export interface PlantGrantRow {
  userId: string;
  role: string;
}

/**
 * The plant roles a user list shows (QA audit 2026-10-19): the distinct roles of the user's grants in the
 * acting plant; with none, the D06 fallback of the legacy role in its home plant (the same rule the request
 * context applies, `legacyRolesApplying`), without the legacy role name itself.
 */
export function plantRolesOf(
  user: { id: string; role: string; tenantId?: string | null },
  grants: readonly PlantGrantRow[],
  tenantId: string,
): string[] {
  const held = [
    ...new Set(
      grants.filter((grant) => grant.userId === user.id).map((g) => g.role),
    ),
  ];
  if (held.length > 0 || user.tenantId !== tenantId) return held;
  return isLegacyRole(user.role) ? [mapLegacyRole(user.role)] : [];
}
