import type { ProductionEventView } from '@/api/v2/types/events';

/** One bar of the state timeline, positioned as a share of the window width (drawing only). */
export interface TimelineSegment {
  event: ProductionEventView;
  /** 0..100 */
  left: number;
  /** 0..100, at least a hairline so short stops stay clickable */
  width: number;
  unknown: boolean;
  open: boolean;
}

export interface TimelineRow {
  unitId: string;
  segments: TimelineSegment[];
}

const MIN_WIDTH = 0.4;

/** Where an event ends on the chart: its end, or the server's `asOf` while it is still ongoing. */
function endOf(event: ProductionEventView): number {
  return Date.parse(event.endTime ?? event.asOf);
}

/**
 * Rows of the timeline: one per unit, the downtime events of the window clipped to it and placed as a
 * share of the window. This is layout of server intervals, not a duration figure (those come from the
 * reports); unknown schedule class is drawn hatched.
 */
export function timelineRows(events: readonly ProductionEventView[], window: { from: string; to: string }): TimelineRow[] {
  const from = Date.parse(window.from);
  const span = Date.parse(window.to) - from;
  if (!(span > 0)) return [];
  const rows = new Map<string, TimelineSegment[]>();
  for (const event of events) {
    const start = Math.max(Date.parse(event.startTime), from);
    const end = Math.min(endOf(event), from + span);
    if (end <= start) continue;
    const segment: TimelineSegment = {
      event,
      left: ((start - from) / span) * 100,
      width: Math.max(((end - start) / span) * 100, MIN_WIDTH),
      unknown: event.classification.scheduleClass === 'unknown',
      open: event.isOpen,
    };
    rows.set(event.unitId, [...(rows.get(event.unitId) ?? []), segment]);
  }
  return [...rows.entries()]
    .map(([unitId, segments]) => ({ unitId, segments: segments.sort((a, b) => a.left - b.left) }))
    .sort((a, b) => a.unitId.localeCompare(b.unitId));
}
