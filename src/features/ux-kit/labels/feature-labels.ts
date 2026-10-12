import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { labelOf } from './humanize';

/** Names of the plant feature switches (`GET /api/v2/feature-flags`); never show the flag key. */
export const FEATURE_LABELS: Readonly<Record<FeatureFlagKey, string>> = {
  'v2.eventHub': 'Event Hub',
  'v2.downtimeAnalysis': 'Downtime analysis',
  'v2.plansProfilesCalendars': 'Plans, profiles & calendars',
  'v2.planDashboard': 'Plan dashboard',
  'v2.plaAnalytics': 'Production loss analytics',
  'v2.integrationConsole': 'Integration console',
  'v2.codesAdmin': 'Codes & rules',
  'v2.rca': 'Root cause analysis',
};

/** "Codes & rules" for `v2.codesAdmin`; an unknown key is humanized without its `v2.` prefix. */
export function featureLabel(flag: string): string {
  if (Object.prototype.hasOwnProperty.call(FEATURE_LABELS, flag)) return FEATURE_LABELS[flag as FeatureFlagKey];
  return labelOf(FEATURE_LABELS, flag.replace(/^v\d+\./, ''), 'This feature');
}

/** "Codes & rules is not turned on for this plant. Ask a plant administrator to turn it on." */
export function featureOffMessage(flag: string): string {
  return `${featureLabel(flag)} is not turned on for this plant. Ask a plant administrator to turn it on.`;
}
