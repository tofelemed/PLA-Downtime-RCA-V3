import type { DashboardSettings } from '@/api/v2/types/administration';

export type DashboardGroup = keyof DashboardSettings;

export type FieldSpec =
  | { key: string; label: string; kind: 'number'; unit?: string; step?: number }
  | { key: string; label: string; kind: 'boolean' }
  | { key: string; label: string; kind: 'text' }
  | { key: string; label: string; kind: 'list'; hint: string }
  | { key: string; label: string; kind: 'choice'; options: ReadonlyArray<readonly [string, string]> };

export interface GroupSpec {
  label: string;
  description: string;
  fields: readonly FieldSpec[];
}

const pct = (key: string, label: string): FieldSpec => ({ key, label, kind: 'number', unit: '%', step: 0.1 });
const share = (key: string, label: string): FieldSpec => ({ key, label, kind: 'number', unit: '0–1', step: 0.05 });

/** Every setting of the plan dashboard, grouped (one group shown at a time instead of eight tabs). */
export const DASHBOARD_GROUPS: Readonly<Record<DashboardGroup, GroupSpec>> = {
  oee: {
    label: 'OEE',
    description: 'Targets and component weights.',
    fields: [
      pct('targetOEE', 'OEE target'), pct('targetAvailability', 'Availability target'), pct('targetPerformance', 'Performance target'),
      pct('targetQuality', 'Quality target'),
      { key: 'availabilityWeight', label: 'Availability weight', kind: 'number', step: 0.1 },
      { key: 'performanceWeight', label: 'Performance weight', kind: 'number', step: 0.1 },
      { key: 'qualityWeight', label: 'Quality weight', kind: 'number', step: 0.1 },
    ],
  },
  losses: {
    label: 'Losses',
    description: 'Loss value and thresholds.',
    fields: [
      { key: 'lossValuePerUnit', label: 'Loss value per unit', kind: 'number' },
      pct('highLossThreshold', 'High loss threshold'), pct('criticalLossThreshold', 'Critical loss threshold'),
      pct('defaultUnaccountedLossPercentage', 'Default unaccounted loss'),
      { key: 'defaultLossCategories', label: 'Loss categories', kind: 'list', hint: 'One category per line.' },
    ],
  },
  costs: {
    label: 'Costs',
    description: 'How cost is calculated and when it is high.',
    fields: [
      { key: 'costCalculationMethod', label: 'Calculation', kind: 'choice', options: [['perUnit', 'Per unit'], ['perHour', 'Per hour'], ['fixed', 'Fixed']] },
      { key: 'defaultCostPerUnit', label: 'Cost per unit', kind: 'number' },
      { key: 'defaultCostPerHour', label: 'Cost per hour', kind: 'number' },
      { key: 'highCostThreshold', label: 'High cost threshold', kind: 'number' },
      { key: 'criticalCostThreshold', label: 'Critical cost threshold', kind: 'number' },
    ],
  },
  bottleneckRisk: {
    label: 'Bottleneck risk',
    description: 'Weights and thresholds of the risk score.',
    fields: [
      share('lossWeight', 'Loss weight'), share('costWeight', 'Cost weight'), share('oeeWeight', 'OEE weight'),
      share('lowRiskThreshold', 'Low risk from'), share('mediumRiskThreshold', 'Medium risk from'), share('highRiskThreshold', 'High risk from'),
    ],
  },
  display: {
    label: 'Display',
    description: 'What the dashboard shows and how numbers look.',
    fields: [
      { key: 'showOEE', label: 'Show OEE', kind: 'boolean' },
      { key: 'showLosses', label: 'Show losses', kind: 'boolean' },
      { key: 'showCosts', label: 'Show costs', kind: 'boolean' },
      { key: 'showCapacity', label: 'Show capacity', kind: 'boolean' },
      { key: 'showActions', label: 'Show actions', kind: 'boolean' },
      { key: 'decimalPlaces', label: 'Decimal places', kind: 'number', step: 1 },
      { key: 'currencySymbol', label: 'Currency symbol', kind: 'text' },
      { key: 'numberFormat', label: 'Number format', kind: 'choice', options: [['en-US', '1,234.5'], ['en-GB', '1,234.5 (UK)'], ['de-DE', '1.234,5'], ['custom', 'Custom']] },
      { key: 'theme', label: 'Colours', kind: 'choice', options: [['default', 'Default'], ['high-contrast', 'High contrast'], ['colorblind-friendly', 'Colour-blind friendly']] },
    ],
  },
  performance: {
    label: 'Performance',
    description: 'Ideal cycle time and thresholds.',
    fields: [
      { key: 'defaultIdealCycleTime', label: 'Ideal cycle time', kind: 'number', unit: 's' },
      { key: 'performanceCalculationMethod', label: 'Calculation', kind: 'choice', options: [['cycleTime', 'Cycle time'], ['outputRate', 'Output rate'], ['efficiency', 'Efficiency']] },
      pct('lowPerformanceThreshold', 'Low performance below'), pct('highPerformanceThreshold', 'High performance from'),
    ],
  },
  quality: {
    label: 'Quality',
    description: 'How quality is counted and its thresholds.',
    fields: [
      { key: 'qualityCalculationMethod', label: 'Calculation', kind: 'choice', options: [['defects', 'Defects'], ['rework', 'Rework'], ['scrap', 'Scrap']] },
      pct('lowQualityThreshold', 'Low quality below'), pct('highQualityThreshold', 'High quality from'),
    ],
  },
  availability: {
    label: 'Availability',
    description: 'How availability is counted and its thresholds.',
    fields: [
      { key: 'availabilityCalculationMethod', label: 'Calculation', kind: 'choice', options: [['uptime', 'Uptime'], ['downtime', 'Downtime'], ['scheduled', 'Scheduled time']] },
      pct('lowAvailabilityThreshold', 'Low availability below'), pct('highAvailabilityThreshold', 'High availability from'),
    ],
  },
};

export const DASHBOARD_GROUP_KEYS = Object.keys(DASHBOARD_GROUPS) as DashboardGroup[];
