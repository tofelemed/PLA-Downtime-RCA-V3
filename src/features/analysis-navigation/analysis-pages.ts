import { EntityIcon } from '@/lib/icons';

export const DOWNTIME_PAGES = [
  { key: 'overview', path: '/downtime', label: 'Overview', name: 'Downtime Analysis', icon: EntityIcon.downtime, description: 'Current stops and the key figures of the selected period' },
  { key: 'stops', path: '/downtime/stops', label: 'Stops & Timeline', name: 'Stops & Timeline', icon: EntityIcon.stop, description: 'Inspect stop records and the physical state timeline' },
  { key: 'causes', path: '/downtime/causes', label: 'Causes & Pareto', name: 'Causes & Pareto', icon: EntityIcon.code, description: 'Rank reasons and assets by lost production, duration or frequency' },
  { key: 'trends', path: '/downtime/trends', label: 'Trends & Comparisons', name: 'Trends & Comparisons', icon: EntityIcon.downtimeTrends, description: 'Compare downtime over time, by crew or with the previous period' },
  { key: 'reliability', path: '/downtime/reliability', label: 'Reliability', name: 'Downtime Reliability', icon: EntityIcon.maintenance, description: 'Failures, exposure, MTBF and repair or restoration evidence' },
] as const;

export const PLA_PAGES = [
  { key: 'overview', path: '/pla-analytics', label: 'Overview', name: 'Production Loss Analysis', icon: EntityIcon.lossAnalysis, description: 'Trace plan or capacity through losses to actual output' },
  { key: 'losses', path: '/pla-analytics/losses', label: 'Loss Breakdown', name: 'Loss Breakdown', icon: EntityIcon.lossBreakdown, description: 'Loss tree, opportunities, recurring causes and contributing events' },
  { key: 'trends', path: '/pla-analytics/trends', label: 'Trends', name: 'PLA Trends', icon: EntityIcon.lossTrends, description: 'OEE and reconciliation trends across production periods' },
  { key: 'oee', path: '/pla-analytics/oee', label: 'OEE', name: 'OEE', icon: EntityIcon.oee, description: 'Operational and reconciled availability, performance, quality and OEE' },
  { key: 'reconciliation', path: '/pla-analytics/reconciliation', label: 'Reconciliation & Data Quality', name: 'Reconciliation & Data Quality', icon: EntityIcon.reconciliation, description: 'Period workflow, unexplained quantities and actuals coverage' },
  { key: 'valuation', path: '/pla-analytics/valuation', label: 'Loss Valuation', name: 'Loss Valuation', icon: EntityIcon.cost, description: 'Financial losses, economic components and missing valuation inputs' },
] as const;

export type DowntimeView = (typeof DOWNTIME_PAGES)[number]['key'];
export type PlaView = (typeof PLA_PAGES)[number]['key'];

const areaOf = (path: string) => path === '/downtime' || path.startsWith('/downtime/') ? 'downtime'
  : path === '/pla-analytics' || path.startsWith('/pla-analytics/') ? 'pla' : null;
const COMMON = ['from', 'to', 'window', 'units', 'approved'];

/** Same analysis: keep its filters. Across analyses: carry only the supported common scope. */
export function analysisHref(target: string, current: { pathname: string; search: string }): string {
  const source = areaOf(current.pathname);
  const destination = areaOf(target);
  if (!source || !destination) return target;
  const params = new URLSearchParams(current.search);
  const next = source === destination ? params : new URLSearchParams();
  if (source !== destination) for (const key of COMMON) {
    const value = params.get(key);
    if (value !== null) next.set(key, value);
  }
  next.delete('tab');
  return `${target}${next.size ? `?${next}` : ''}`;
}

/** Bookmarked PLA tabs become routed pages; legacy anchors are retained by the caller. */
export function legacyPlaPath(tab: string | null): string | null {
  if (!tab) return null;
  const aliases: Record<string, PlaView> = { waterfall: 'overview', 'loss-tree': 'losses', opportunities: 'losses', 'repeat-causes': 'losses', quality: 'reconciliation' };
  const key = aliases[tab] ?? tab;
  return PLA_PAGES.find((page) => page.key === key)?.path ?? '/pla-analytics';
}
