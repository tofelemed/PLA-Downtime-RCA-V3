import { EntityIcon } from '@/lib/icons';
import { analysisAreaOf, readAnalysisContext, withAnalysisContext } from './analysis-context';

export const DOWNTIME_PAGES = [
  { key: 'overview', path: '/downtime', label: 'Overview', name: 'Downtime analysis', icon: EntityIcon.downtime, description: 'Current stops and the key figures of the selected period' },
  { key: 'stops', path: '/downtime/stops', label: 'Stops & timeline', name: 'Stops & timeline', icon: EntityIcon.stop, description: 'Inspect stop records and the physical state timeline' },
  { key: 'causes', path: '/downtime/causes', label: 'Causes & Pareto', name: 'Causes & Pareto', icon: EntityIcon.code, description: 'Rank reasons and assets by lost production, duration or frequency' },
  { key: 'trends', path: '/downtime/trends', label: 'Trends & comparisons', name: 'Trends & comparisons', icon: EntityIcon.downtimeTrends, description: 'Compare downtime over time, by crew or with the previous period' },
  { key: 'reliability', path: '/downtime/reliability', label: 'Reliability (MTBF/MTTR)', name: 'Reliability (MTBF/MTTR)', icon: EntityIcon.maintenance, description: 'Failures, exposure, MTBF and repair or restoration evidence' },
] as const;

export const PLA_PAGES = [
  { key: 'overview', path: '/pla-analytics', label: 'Overview', name: 'Production loss analysis', icon: EntityIcon.lossAnalysis, description: 'Trace plan or capacity through losses to actual output' },
  { key: 'statement', path: '/pla-analytics/statement', label: 'Accounting statement', name: 'Accounting statement', icon: EntityIcon.periodAccounting, description: 'Planned, actual and the shortfall explained: losses by kind, verified recovery, net accounted and unaccounted loss' },
  { key: 'losses', path: '/pla-analytics/losses', label: 'Loss breakdown', name: 'Loss breakdown', icon: EntityIcon.lossBreakdown, description: 'Loss tree, opportunities, recurring causes and contributing events' },
  { key: 'trends', path: '/pla-analytics/trends', label: 'Trends', name: 'PLA trends', icon: EntityIcon.lossTrends, description: 'OEE and reconciliation trends across production periods' },
  { key: 'oee', path: '/pla-analytics/oee', label: 'OEE', name: 'OEE', icon: EntityIcon.oee, description: 'Operational and reconciled availability, performance, quality and OEE' },
  { key: 'reconciliation', path: '/pla-analytics/reconciliation', label: 'Reconciliation & data quality', name: 'Reconciliation & data quality', icon: EntityIcon.reconciliation, description: 'Period workflow, unaccounted quantities and actuals coverage' },
  { key: 'valuation', path: '/pla-analytics/valuation', label: 'Loss valuation', name: 'Loss valuation', icon: EntityIcon.cost, description: 'Financial losses, economic components and missing valuation inputs' },
  { key: 'capacity', path: '/pla-analytics/capacity-gap', label: 'Capacity gap', name: 'Capacity gap', icon: EntityIcon.capacityGap, description: 'Approved nameplate, demonstrated, sustained and planning rates side by side, with the gap between each step' },
] as const;

export type DowntimeView = (typeof DOWNTIME_PAGES)[number]['key'];
export type PlaView = (typeof PLA_PAGES)[number]['key'];

/**
 * Same analysis module: keep its filters. Across the analysis modules (Dashboard, Event Hub, Downtime,
 * PLA, Reports): carry only the shared analysis context (B-8, `analysis-context.ts`). Other targets are
 * returned unchanged.
 */
export function analysisHref(target: string, current: { pathname: string; search: string }): string {
  const source = analysisAreaOf(current.pathname);
  const destination = analysisAreaOf(target);
  if (!source || !destination) return target;
  if (source !== destination) return withAnalysisContext(target, readAnalysisContext(current.search));
  const params = new URLSearchParams(current.search);
  params.delete('tab');
  return `${target}${params.size ? `?${params}` : ''}`;
}

/** Bookmarked PLA tabs become routed pages; legacy anchors are retained by the caller. */
export function legacyPlaPath(tab: string | null): string | null {
  if (!tab) return null;
  const aliases: Record<string, PlaView> = { waterfall: 'overview', 'loss-tree': 'losses', opportunities: 'losses', 'repeat-causes': 'losses', quality: 'reconciliation' };
  const key = aliases[tab] ?? tab;
  return PLA_PAGES.find((page) => page.key === key)?.path ?? '/pla-analytics';
}
