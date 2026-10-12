import type { LegacyRole } from '@/api/v2/types/administration';

/** The screens a legacy role reaches, as the permissions screen displays them. */
export interface ModulePermissions {
  dashboard: boolean;
  events: boolean;
  rca: boolean;
  masterData: boolean;
  users: boolean;
  connectivity: boolean;
  audit: boolean;
  settings: boolean;
}

export const MODULE_LABELS: Record<keyof ModulePermissions, string> = {
  dashboard: 'Dashboard',
  events: 'Events',
  rca: 'RCA Analysis',
  masterData: 'Master Data',
  users: 'Users',
  connectivity: 'Connectivity',
  audit: 'Audit',
  settings: 'Settings',
};

const ALL: ModulePermissions = {
  dashboard: true,
  events: true,
  rca: true,
  masterData: true,
  users: true,
  connectivity: true,
  audit: true,
  settings: true,
};

const NONE: ModulePermissions = {
  dashboard: false,
  events: false,
  rca: false,
  masterData: false,
  users: false,
  connectivity: false,
  audit: false,
  settings: false,
};

/**
 * What each legacy role reaches by default (display only: the server decides from the effective roles,
 * see `features/auth/capabilities.ts`). Manager has no entry: it starts from an empty set.
 */
const DEFAULT_ROLE_PERMISSIONS: Partial<Record<LegacyRole, ModulePermissions>> = {
  SuperAdmin: ALL,
  OrgAdmin: ALL,
  TenantAdmin: { ...ALL, audit: false },
  Analyst: { ...NONE, dashboard: true, events: true, rca: true },
  Engineer: { ...NONE, dashboard: true, events: true, rca: true },
  Operator: { ...NONE, dashboard: true, events: true },
};

export function defaultPermissionsFor(role: string): ModulePermissions {
  return { ...(DEFAULT_ROLE_PERMISSIONS[role as LegacyRole] ?? NONE) };
}
