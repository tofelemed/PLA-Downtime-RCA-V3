/**
 * Known feature flags and their defaults (plan 3.1 step 5). One flag per screen migrated in 3.2–3.9;
 * every v2 screen starts off so v1 keeps working until the pilot accepts it (decision C4).
 */
export const FEATURE_FLAG_DEFAULTS = {
  'v2.eventHub': false,
  'v2.downtimeAnalysis': false,
  'v2.plansProfilesCalendars': false,
  'v2.planDashboard': false,
  'v2.plaAnalytics': false,
  'v2.integrationConsole': false,
  'v2.codesAdmin': false,
  /**
   * RCA is v2 for every plant (owner, 2026-10-18): the server no longer reads this flag (RCA triggers and
   * the open-event sweep always run; the v1 trigger-config auto-create is retired). Kept in the registry
   * so cutover tooling and existing tenant rows stay valid.
   */
  'v2.rca': true,
} as const satisfies Record<string, boolean>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_DEFAULTS;

export const FEATURE_FLAG_KEYS = Object.keys(
  FEATURE_FLAG_DEFAULTS,
) as FeatureFlagKey[];

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as string[]).includes(value);
}
