import { WINDOW_PRESETS } from '@/features/downtime-analysis/model/downtime-filters';
import { parseScope, presetWindowOf, type AnalyticsScope } from './analytics-scope';

export const DASHBOARD_PRESETS = WINDOW_PRESETS.filter((preset) => preset.key !== '90d');
export type DashboardPresetKey = (typeof DASHBOARD_PRESETS)[number]['key'];
const DEFAULT_KEY: DashboardPresetKey = '7d';

export const presetKeyOf = (value: string | null): DashboardPresetKey =>
  DASHBOARD_PRESETS.find((preset) => preset.key === value)?.key ?? DEFAULT_KEY;

/**
 * The dashboard scope: every unit in the caller's scope over a rolling preset (`?window=24h|7d|30d`,
 * default the last 7 days) that ends now — it rolls forward on every visit, with minute-stable bounds so
 * the tiles share one cached snapshot (docs/UI_UX_AUDIT.md §7: the scope was frozen at mount).
 */
export function dashboardScope(key: DashboardPresetKey, now: number = Date.now()): AnalyticsScope {
  const preset = DASHBOARD_PRESETS.find((entry) => entry.key === key) ?? DASHBOARD_PRESETS[1];
  return { ...parseScope(new URLSearchParams(), now), ...presetWindowOf(preset.hours, now), windowLabel: preset.label };
}
