import type { KpiAggregateView } from '@/api/v2/types/reports';
import { reasonText } from '@/features/downtime-analysis/model/kpi-display';

/**
 * Why a KPI tile has no value, as a short sentence ("No scheduled time"), or null when it has one. A tile
 * shows "—" in its value slot and this as a one-line caption, never the reason at headline size.
 */
export function unavailableReason(view: KpiAggregateView | undefined): string | null {
  if (!view) return 'No calculated periods';
  if (view.value !== null) return null;
  const text = reasonText(view.reason) ?? 'no data';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The one reason every tile of a group shares (said once for the group), or null when they differ or any has a value. */
export function sharedUnavailableReason(views: ReadonlyArray<KpiAggregateView | undefined>): string | null {
  if (views.length < 2) return null;
  const reasons = views.map(unavailableReason);
  const first = reasons[0];
  return first !== null && reasons.every((reason) => reason === first) ? first : null;
}
