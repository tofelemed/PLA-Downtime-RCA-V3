import { formatDecimal } from '@/features/ux-kit/format/decimal';
import type { RcaPolicyVersion, RcaRepeatMatch } from './rca-policy-api';

export const REPEAT_MATCH_LABELS: Readonly<Record<RcaRepeatMatch, string>> = {
  asset: 'the same asset (any failure mode)',
  asset_and_mode: 'the same asset and failure mode',
  asset_mode_and_mechanism: 'the same asset, failure mode and mechanism',
};

const percent = (share: number) => `${formatDecimal(String(share * 100), 1)} %`;
const number = (value: number, digits = 0) => formatDecimal(String(value), digits);

/** The any-of triggers of a version in plain words (SME D17 / CA8). */
export function triggerText(policy: RcaPolicyVersion, duration: (seconds: number) => string): string {
  const parts = [
    policy.durationThresholdSeconds > 0
      ? `unplanned stops from ${duration(policy.durationThresholdSeconds)}`
      : 'no duration trigger',
    policy.lostQuantityShareOfDailyPlan === null
      ? 'no lost-quantity trigger'
      : `approved lost quantity from ${percent(policy.lostQuantityShareOfDailyPlan)} of the daily plan`,
    `${policy.repeatCount} incidents of ${REPEAT_MATCH_LABELS[policy.repeatMatch]} in ${policy.repeatWindowDays} days`,
    policy.cumulative
      ? `${duration(policy.cumulative.downtimeSeconds)} same-mode downtime in ${policy.cumulative.windowDays} days`
      : 'no cumulative trigger',
    policy.costThreshold === null || !policy.costCurrency
      ? 'no money limit'
      : `approved value from ${number(policy.costThreshold)} ${policy.costCurrency}`,
  ];
  return parts.join(' · ');
}

/** Critical assets and the safety override in plain words. */
export function overrideText(policy: RcaPolicyVersion): string {
  const { criticalities, thresholdFactor } = policy.criticalAssets;
  const critical = criticalities.length
    ? `assets with criticality ${criticalities.join(', ')}: production thresholds × ${number(thresholdFactor, 2)}`
    : 'no critical-asset rule';
  const markers = [...policy.consequence.solTypes, ...policy.consequence.severities];
  const safety = markers.length ? `always triggers on ${markers.join(', ')}` : 'no consequence override';
  return `${critical} · ${safety}`;
}

/** The workflow rules of the version (read-only on this page; SME CA2–CA7). */
export function ruleFacts(policy: RcaPolicyVersion): Array<{ label: string; value: string }> {
  const { effectiveness, fmea, fiveWhy, investigation } = policy;
  const tiers = Object.entries(investigation)
    .map(([name, tier]) => `${name}: ${tier.methodGroups.map((group) => group.join(' or ')).join(' + ')} (team ≥ ${tier.minTeamMembers})`)
    .join('; ');
  return [
    {
      label: 'Effectiveness',
      value: `baseline ${effectiveness.baselineLookbackDays} days before the action; at least ${number(effectiveness.minExposureHours)} run hours after; ${percent(effectiveness.requiredReduction)} fewer same-mode incidents per run hour; review after ${effectiveness.reviewDays} days`,
    },
    {
      label: 'FMEA',
      value: `${fmea.method === 'rpn' ? 'RPN' : 'action priority'}; action from RPN ${fmea.rpnThreshold} or severity ${fmea.severityReview}+; ${fmea.priorityRules.length} priority rules`,
    },
    {
      label: '5-Why',
      value: `${fiveWhy.guidelineLevels} levels as guidance; evidence for every answer${fiveWhy.evidencePerLevel ? ' required' : ''}; not accepted alone: ${fiveWhy.unsupportedRootCauses.join(', ')}`,
    },
    { label: 'Methods by consequence', value: tiers },
  ];
}
