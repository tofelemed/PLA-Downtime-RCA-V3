import { BoundedInterval, clip, unionSeconds } from '../time/interval-algebra';

/** One downtime event as the calculation needs it. */
export interface DowntimeEventInput {
  id: string;
  /** physical stop occurrence; split children share it (plan 1.4); defaults to `id` */
  occurrenceId?: string | null;
  assetId: string | null;
  start: Date;
  end: Date | null;
}

export interface DowntimeOccurrence {
  eventId: string;
  occurrenceId: string;
  assetId: string | null;
  /** clipped to the window (and to `asOf` while running) */
  start: Date;
  end: Date;
  seconds: number;
  /** started before the window */
  carriedIn: boolean;
  /** still running at the end of the window, or not yet ended */
  carriedOut: boolean;
}

export interface UnitDowntime {
  window: BoundedInterval;
  /** union of all occurrences: a unit is down once however many assets stop (DT05, T03) */
  downtimeSeconds: number;
  /** union per asset; not additive across assets */
  assetSeconds: Record<string, number>;
  /** one per physical stop occurrence, however many boundaries or split fragments it has (T29, KPI06) */
  occurrenceCount: number;
  occurrences: DowntimeOccurrence[];
}

const UNASSIGNED_ASSET = 'unassigned';

/**
 * Unit downtime inside `window` (DT05): each event clipped to the window — a running one also to
 * `asOf` — then united. Callers pass only eligible events (downtime, not superseded or retracted).
 */
export function computeUnitDowntime(
  events: readonly DowntimeEventInput[],
  window: BoundedInterval,
  asOf: Date,
): UnitDowntime {
  const horizon: BoundedInterval = {
    start: window.start,
    end: new Date(Math.min(window.end.getTime(), asOf.getTime())),
  };
  const occurrences = events.flatMap((event) =>
    occurrenceOf(event, window, horizon),
  );
  return {
    window,
    downtimeSeconds: unionSeconds(occurrences),
    assetSeconds: perAsset(occurrences),
    occurrenceCount: new Set(occurrences.map((o) => o.occurrenceId)).size,
    occurrences,
  };
}

function occurrenceOf(
  event: DowntimeEventInput,
  window: BoundedInterval,
  horizon: BoundedInterval,
): DowntimeOccurrence[] {
  const clipped = clip({ start: event.start, end: event.end }, horizon);
  if (!clipped) {
    return [];
  }
  return [
    {
      eventId: event.id,
      occurrenceId: event.occurrenceId ?? event.id,
      assetId: event.assetId,
      start: clipped.start,
      end: clipped.end,
      seconds: (clipped.end.getTime() - clipped.start.getTime()) / 1000,
      carriedIn: event.start.getTime() < window.start.getTime(),
      carriedOut:
        event.end === null || event.end.getTime() > window.end.getTime(),
    },
  ];
}

function perAsset(
  occurrences: readonly DowntimeOccurrence[],
): Record<string, number> {
  const byAsset = new Map<string, BoundedInterval[]>();
  for (const occurrence of occurrences) {
    const key = occurrence.assetId ?? UNASSIGNED_ASSET;
    byAsset.set(key, [...(byAsset.get(key) ?? []), occurrence]);
  }
  return Object.fromEntries(
    [...byAsset].map(([asset, intervals]) => [asset, unionSeconds(intervals)]),
  );
}
