import type { FeatureFlagKey } from '@/api/v2/types/flags';
import type { UserView } from '@/api/v2/types/administration';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { groupNavigationItems, visibleNavigationItems, type NavGroup } from '@/features/auth/navigation-items';

const GLOBAL_ROLES: readonly string[] = ['SuperAdmin', 'OrgAdmin'];

/**
 * The roles a user holds in the acting plant as the server resolves them (QA audit 2026-10-19): the plant
 * roles the users API reports (grants, else the legacy role's D06 fallback) plus the legacy role name where
 * it applies (its home plant; SuperAdmin / OrgAdmin everywhere). Without `plantRoles` (older server) the
 * legacy role alone, as before.
 */
export function userRolesInPlant(user: Pick<UserView, 'role' | 'tenantId' | 'plantRoles'>, actingTenantId: string | null): string[] {
  const legacyApplies = GLOBAL_ROLES.includes(user.role) || user.tenantId === actingTenantId || !user.plantRoles;
  return [...new Set([...(legacyApplies ? [user.role] : []), ...(user.plantRoles ?? [])])];
}

/**
 * The menu pages a user reaches in the acting plant, section by section: exactly the capability-gated
 * menu (`capabilitiesOf` + `NAVIGATION_ITEMS`) the user would see, never a per-role guess.
 */
export function reachableModules(roles: readonly string[], flagsOn: Partial<Record<FeatureFlagKey, boolean>>): NavGroup[] {
  return groupNavigationItems(visibleNavigationItems(capabilitiesOf(roles), flagsOn));
}
