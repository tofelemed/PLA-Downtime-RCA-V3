import { parseScope, presetWindowOf, type AnalyticsScope } from './analytics-scope';
import type { TrendGroup } from '@/api/v2/types/pla-analytics';

export const DASHBOARD_PRESETS = [
  { key: '24h', label: '24 h', hours: 24 },
  { key: '7d', label: '7 days', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
  { key: '3m', label: '3 months', hours: 2184 },
  { key: '6m', label: '6 months', hours: 4368 },
  { key: '1y', label: '1 year', hours: 8760 },
] as const;
export type DashboardPresetKey = (typeof DASHBOARD_PRESETS)[number]['key'];
const DEFAULT_KEY: DashboardPresetKey = '30d';

/** The hierarchy node the dashboard is scoped to: a unit, an asset, or neither (the whole plant). */
export interface DashboardNode {
  unitId?: string;
  assetId?: string;
}

export const presetKeyOf = (value: string | null): DashboardPresetKey =>
  DASHBOARD_PRESETS.find((preset) => preset.key === value)?.key ?? DEFAULT_KEY;

/** The preset whose label the scope carries (links resolve the rolling key from it). */
export const presetOfLabel = (windowLabel: string) => DASHBOARD_PRESETS.find((preset) => preset.label === windowLabel);

const STEPS: Readonly<Record<DashboardPresetKey, TrendGroup>> = { '24h': 'shift', '7d': 'day', '30d': 'day', '3m': 'week', '6m': 'month', '1y': 'month' };

/** The chart step of a period: shifts for a day, days up to a month, weeks for a quarter, months beyond. */
export const stepOf = (key: DashboardPresetKey): TrendGroup => STEPS[key];

/**
 * The dashboard scope: the units under the selected hierarchy node (all units in the caller's scope when none)
 * over a rolling preset (`?window=`, default 30 days) that ends now, with minute-stable bounds so the tiles
 * share one cached snapshot. It shows approved revisions only (owner, 24 Oct 2026), so no figure is a draft.
 */
export function dashboardScope(key: DashboardPresetKey, node: DashboardNode, now: number = Date.now()): AnalyticsScope {
  const preset = DASHBOARD_PRESETS.find((entry) => entry.key === key) ?? DASHBOARD_PRESETS[1];
  return {
    ...parseScope(new URLSearchParams(), now),
    ...presetWindowOf(preset.hours, now),
    windowLabel: preset.label,
    approvedOnly: true,
    unitIds: node.unitId ? [node.unitId] : [],
    trendBy: stepOf(preset.key),
  };
}
