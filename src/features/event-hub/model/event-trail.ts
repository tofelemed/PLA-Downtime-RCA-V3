import type { ProductionEventView } from '@/api/v2/types/events';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';

export interface TrailStep {
  label: string;
  to?: string;
}

/** The event page's h1: "Downtime · HDPE Extruder 1"; the edit page's breadcrumb names the event the same way (L16). */
export function eventPageTitle(event: Pick<ProductionEventView, 'unitId' | 'classification'>, unitName: (id: string) => string): string {
  return `${labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)} · ${unitName(event.unitId)}`;
}

const pathOf = (to: string) => to.split(/[?#]/, 1)[0];

/**
 * QA audit L15: an event opened from an analysis page (Causes & Pareto, Stops & timeline, PLA, a period, an
 * investigation) keeps that origin, with its filters, in the breadcrumb instead of a separate back link next
 * to an unfiltered "Event Hub" crumb. Opened from the Event Hub, the automatic trail already keeps the list's
 * filters (undefined = use it).
 */
export function eventTrail(back: { to: string; label: string }, title: string): TrailStep[] | undefined {
  const path = pathOf(back.to);
  if (path === '/events' || path.startsWith('/events/')) return undefined;
  return [{ label: back.label, to: back.to }, { label: title }];
}
