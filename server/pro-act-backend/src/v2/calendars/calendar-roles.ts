/**
 * Writers of calendars, crews and rotations (spec §13.2; engineering default, DECISIONS.md §D 2026-10-09):
 * master data, so a master-data admin or a manager approver (TenantAdmin/Manager). Reads and previews:
 * any tenant member.
 */
export const CALENDAR_WRITERS = [
  'master_data_admin',
  'manager_approver',
] as const;
