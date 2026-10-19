import { type DigitSystem, localizeNumber } from '@/lib/dates';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_CONSEQUENCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import type { RcaPolicyVersion, RcaRepeatMatch } from './rca-policy-api';
import { ANALYSIS_METHOD_LABELS } from './rca-policy-rules-draft';

/** The server's coverage default for versions written before the rule existed. */
const DEFAULT_MINIMUM_COVERAGE = 0.95;

export const REPEAT_MATCH_LABELS: Readonly<Record<RcaRepeatMatch, string>> = {
  asset: 'the same asset (any failure mode)',
  asset_and_mode: 'the same asset and failure mode',
  asset_mode_and_mechanism: 'the same asset, failure mode and mechanism',
};

/** Numbers of the policy text in the plant's digits (`system`); identifiers (criticalities, codes) stay as they are. */
const percent = (share: number, system?: DigitSystem) => localizeNumber(`${formatDecimal(String(share * 100), 1)} %`, system);
const number = (value: number, system?: DigitSystem, fractionDigits = 0) => formatDecimal(String(value), fractionDigits, system);

/** The any-of triggers of a version in plain words (SME D17 / CA8). */
export function triggerText(policy: RcaPolicyVersion, duration: (seconds: number) => string, digits?: DigitSystem): string {
  const parts = [
    policy.durationThresholdSeconds > 0
      ? `unplanned stops from ${duration(policy.durationThresholdSeconds)}`
      : 'no duration trigger',
    policy.lostQuantityShareOfDailyPlan === null
      ? 'no lost-quantity trigger'
      : `approved lost quantity from ${percent(policy.lostQuantityShareOfDailyPlan, digits)} of the daily plan`,
    `${number(policy.repeatCount, digits)} incidents of ${REPEAT_MATCH_LABELS[policy.repeatMatch]} in ${number(policy.repeatWindowDays, digits)} days`,
    policy.cumulative
      ? `${duration(policy.cumulative.downtimeSeconds)} same-mode downtime in ${number(policy.cumulative.windowDays, digits)} days`
      : 'no cumulative trigger',
    policy.costThreshold === null || !policy.costCurrency
      ? 'no money limit'
      : `approved value from ${number(policy.costThreshold, digits)} ${policy.costCurrency}`,
  ];
  return parts.join(' · ');
}

/** Critical assets and the safety override in plain words. */
export function overrideText(policy: RcaPolicyVersion, digits?: DigitSystem): string {
  const { criticalities, thresholdFactor } = policy.criticalAssets;
  const critical = criticalities.length
    ? `assets with criticality ${criticalities.join(', ')}: production thresholds × ${number(thresholdFactor, digits, 2)}`
    : 'no critical-asset rule';
  const markers = [...policy.consequence.solTypes, ...policy.consequence.severities];
  const safety = markers.length ? `always triggers on ${markers.join(', ')}` : 'no consequence override';
  return `${critical} · ${safety}`;
}

/** The workflow rules of the version (read-only on this page; SME CA2–CA7). */
export function ruleFacts(policy: RcaPolicyVersion, digits?: DigitSystem): Array<{ label: string; value: string }> {
  const { effectiveness, fmea, fiveWhy, investigation } = policy;
  const method = (key: string) => labelOf(ANALYSIS_METHOD_LABELS, key);
  const tiers = Object.entries(investigation)
    .map(([name, tier]) => `${labelOf(RCA_CONSEQUENCE_LABELS, name)}: ${tier.methodGroups.map((group) => group.map(method).join(' or ')).join(' + ')} (team ≥ ${number(tier.minTeamMembers, digits)})`)
    .join('; ');
  const coverage = effectiveness.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE;
  return [
    {
      label: 'Effectiveness',
      value: `baseline ${number(effectiveness.baselineLookbackDays, digits)} days before the action; at least ${number(effectiveness.minExposureHours, digits)} run hours after; ${percent(effectiveness.requiredReduction, digits)} fewer same-mode incidents per run hour; a verdict needs at least ${percent(coverage, digits)} state-data coverage; review after ${number(effectiveness.reviewDays, digits)} days`,
    },
    {
      label: 'FMEA',
      value: `${fmea.method === 'rpn' ? 'RPN' : 'action priority'}; action from RPN ${number(fmea.rpnThreshold, digits)} or severity ${number(fmea.severityReview, digits)}+; ${number(fmea.priorityRules.length, digits)} priority rules`,
    },
    {
      label: '5-Why',
      value: `${number(fiveWhy.guidelineLevels, digits)} levels as guidance; evidence for every answer${fiveWhy.evidencePerLevel ? ' required' : ''}; not accepted alone: ${fiveWhy.unsupportedRootCauses.join(', ')}`,
    },
    { label: 'Methods by consequence', value: tiers },
  ];
}
