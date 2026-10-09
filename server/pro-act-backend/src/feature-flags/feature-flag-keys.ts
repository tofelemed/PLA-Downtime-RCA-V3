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
  'v2.rca': false,
} as const satisfies Record<string, boolean>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_DEFAULTS;

export const FEATURE_FLAG_KEYS = Object.keys(
  FEATURE_FLAG_DEFAULTS,
) as FeatureFlagKey[];

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as string[]).includes(value);
}
