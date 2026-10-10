import {
  FEATURE_FLAG_KEYS,
  FeatureFlagKey,
  isFeatureFlagKey,
} from '../../feature-flags/feature-flag-keys';

/**
 * Flag switch-over order for a pilot scope (plan 3.10, MIG02 / MIG05, decision C4): master data and
 * integration first (later screens read their codes, rules and connections), then plans, then the
 * event writes, then the accounting / reporting screens that read events and plans, RCA last. Rollback
 * switches in the reverse order. Every key is one row of `FEATURE_FLAG_DEFAULTS`.
 */
export const CUTOVER_SCREEN_ORDER: readonly FeatureFlagKey[] = [
  'v2.codesAdmin',
  'v2.integrationConsole',
  'v2.plansProfilesCalendars',
  'v2.eventHub',
  'v2.downtimeAnalysis',
  'v2.planDashboard',
  'v2.plaAnalytics',
  'v2.rca',
];

/** `all` or a comma list → keys in cutover order (enable) or reverse order (disable); unknown keys throw. */
export function resolveScreenKeys(
  selection: string,
  enabling: boolean,
): FeatureFlagKey[] {
  const wanted =
    selection.trim() === 'all'
      ? [...FEATURE_FLAG_KEYS]
      : selection
          .split(',')
          .map((key) => key.trim())
          .filter((key) => key.length > 0);
  const unknown = wanted.filter((key) => !isFeatureFlagKey(key));
  if (unknown.length > 0 || wanted.length === 0) {
    throw new Error(
      `Unknown or missing flag key(s): ${unknown.join(', ') || '(none)'}; known: ${FEATURE_FLAG_KEYS.join(', ')}`,
    );
  }
  const ordered = CUTOVER_SCREEN_ORDER.filter((key) => wanted.includes(key));
  return enabling ? ordered : [...ordered].reverse();
}
