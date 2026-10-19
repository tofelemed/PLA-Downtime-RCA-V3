import { LEGACY_ROLE_LABELS, roleLabel, SCOPE_ROLE_LABELS } from '@/features/ux-kit/labels/role-labels';

const GLOBAL_ROLES: readonly string[] = ['SuperAdmin', 'OrgAdmin'];

export interface PlantRoleSummary {
  /** the badge text: "Finance approver", "Finance approver +1" */
  short: string;
  /** every role, for the tooltip / accessible description */
  full: string;
}

/**
 * QA audit 2026-10-19: the header shows the roles that decide what the user sees in the selected plant
 * (the plant grants, or a global administrator role), not the legacy `users.role` ("Analyst"). The legacy
 * role is shown only when the user holds nothing else in the plant.
 */
export function plantRoleSummary(effectiveRoles: readonly string[], legacyRole: string | null | undefined): PlantRoleSummary {
  const global = effectiveRoles.filter((role) => GLOBAL_ROLES.includes(role));
  const plant = effectiveRoles.filter((role) => role in SCOPE_ROLE_LABELS);
  const shown = [...new Set([...global, ...plant])];
  if (shown.length === 0) {
    const fallback = roleLabel(legacyRole && legacyRole in LEGACY_ROLE_LABELS ? legacyRole : null);
    return { short: fallback, full: fallback };
  }
  const labels = [...new Set(shown.map((role) => roleLabel(role)))];
  const short = labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0];
  return { short, full: labels.join(', ') };
}
