import type { ReportGroupView } from '@/api/v2/types/reports';
import type { DigitSystem } from '@/lib/dates';
import { findKpi, kpiText } from './display';

/** What a report row says once instead of per figure (QA re-test N4). */
export type OeeRowNote = { kind: 'no-plan' } | { kind: 'unavailable'; text: string } | null;

/**
 * A row whose periods no approved plan covers says so once (owner decision 2026-10-19); a row with no
 * figure at all and one shared "Not available" reason says that reason once. Rows with figures: null
 * (the no-plan note still shows next to its figures, which are never hidden).
 */
export function oeeRowNote(group: ReportGroupView, metrics: readonly string[], digits?: DigitSystem): OeeRowNote {
  if (group.noApprovedPlan) return { kind: 'no-plan' };
  if (metrics.some((metric) => (findKpi(group.metrics, metric)?.value ?? null) !== null)) return null;
  const texts = new Set(metrics.map((metric) => kpiText(findKpi(group.metrics, metric), digits)));
  const [only] = [...texts];
  return texts.size === 1 && only !== undefined ? { kind: 'unavailable', text: only } : null;
}

/** Every figure of the row is missing, so its cells show "—" and the row note carries the reason. */
export const rowHasNoFigures = (group: ReportGroupView, metrics: readonly string[]) =>
  metrics.every((metric) => (findKpi(group.metrics, metric)?.value ?? null) === null);
