import { labelOf } from './humanize';

/**
 * Display names of every role token (backend `auth/roles/role-model.ts`: legacy `users.role` and D06 scope
 * roles). Screens show `roleLabel(role)`, never `TenantAdmin` or `manager_approver`.
 */
export const LEGACY_ROLE_LABELS = {
  SuperAdmin: 'Super administrator',
  OrgAdmin: 'Organization administrator',
  TenantAdmin: 'Plant administrator',
  Manager: 'Manager',
  Analyst: 'Analyst',
  Engineer: 'Engineer',
  Operator: 'Operator',
} as const satisfies Record<string, string>;

export const SCOPE_ROLE_LABELS = {
  manager_approver: 'Manager (approver)',
  production_accountant: 'Production accountant',
  quality_approver: 'Quality / Lab approver',
  finance_approver: 'Finance approver',
  finance_maintainer: 'Finance (rates)',
  production_engineer: 'Production engineer',
  reliability_engineer: 'Reliability engineer',
  integration_admin: 'Integration administrator',
  master_data_admin: 'Master data administrator',
  operator: 'Operator',
  viewer: 'Viewer',
} as const satisfies Record<string, string>;

export type RoleToken = keyof typeof LEGACY_ROLE_LABELS | keyof typeof SCOPE_ROLE_LABELS;

export const ROLE_LABELS: Readonly<Record<RoleToken, string>> = { ...LEGACY_ROLE_LABELS, ...SCOPE_ROLE_LABELS };

/** "Plant administrator" for `TenantAdmin`; an unknown role is humanized, null → "—". */
export function roleLabel(role: string | null | undefined): string {
  return labelOf(ROLE_LABELS, role);
}

/** "Manager (approver), Viewer": distinct labels of several roles in the given order. */
export function roleListLabel(roles: readonly string[]): string {
  const labels = roles.map((role) => roleLabel(role));
  return [...new Set(labels)].join(', ') || '—';
}
