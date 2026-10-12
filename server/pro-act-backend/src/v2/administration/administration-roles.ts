/**
 * Role sets of the administration API (`/v2/users`, `/v2/user-scopes`, `/v2/custom-attribute-definitions`,
 * `/v2/dashboard-configuration`). Same sets as the v1 routes they replace (decision 2026-10-11 "v1 admin
 * routes: role matrix"); mirrored in the frontend `src/features/auth/server-role-sets.ts` usage.
 */
export const USER_READERS = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'manager_approver',
] as const;

export const USER_WRITERS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'] as const;

/** Custom attribute definitions are plant master data: plant administrators and master-data admins. */
export const ATTRIBUTE_WRITERS = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'master_data_admin',
] as const;

/** Plant-level configuration (dashboard thresholds): plant administrators. */
export const PLANT_CONFIG_WRITERS = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
] as const;
