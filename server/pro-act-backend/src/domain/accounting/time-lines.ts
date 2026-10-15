import { Dec } from '../actuals/decimal';
import { ratePerSecond } from '../profiles/rate-math';
import {
  Ledger,
  LossBasis,
  LossEvent,
  LossKind,
  LossLineDraft,
  RateVersion,
  Segment,
} from './accounting.types';
import { autoKey } from './auto-key';

/** Which rate re-bases time into quantity: sustained (capacity ledger) or planning (plan ledger). */
export type RateBasis = 'sustained' | 'planning';

export interface LineContext {
  ledger: Ledger;
  sliceId: string;
  uom: string | null;
  basis: RateBasis;
}

interface RawEntry {
  kind: LossKind;
  start: Date;
  end: Date;
  quantity: Dec;
  rate: RateVersion;
  cause: LossEvent | null;
  share: Dec | null;
  label: string | null;
}

/**
 * Quantity of a segment at the ledger's rate, times the stream's capacity share when the unit has streams
 * (SME E6); null when no rate of that kind is in force.
 */
export function segmentCapacity(
  segment: Segment,
  basis: RateBasis,
): Dec | null {
  const rate = basis === 'sustained' ? segment.sustained : segment.planning;
  if (!rate) return null;
  const capacity = ratePerSecond(rate).mul(segment.seconds);
  return segment.capacityShare ? capacity.mul(segment.capacityShare) : capacity;
}

export function rateOf(segment: Segment, basis: RateBasis): RateVersion | null {
  return basis === 'sustained' ? segment.sustained : segment.planning;
}

function rawEntries(
  segments: readonly Segment[],
  basis: RateBasis,
): RawEntry[] {
  return segments.flatMap((segment): RawEntry[] => {
    const rate = rateOf(segment, basis);
    const capacity = segmentCapacity(segment, basis);
    if (!rate || !capacity) return [];
    const base = { start: segment.start, end: segment.end, rate };
    if (segment.excluded) {
      return [
        {
          ...base,
          kind: 'schedule_exclusion',
          quantity: capacity,
          cause: null,
          share: null,
          label: segment.exclusionKind,
        },
      ];
    }
    return segment.stops.map((cause) => ({
      ...base,
      kind: 'availability',
      quantity: capacity.mul(cause.share),
      cause: cause.event,
      share: cause.share,
      label: null,
    }));
  });
}

function sameGroup(a: RawEntry, b: RawEntry): boolean {
  return (
    a.end.getTime() === b.start.getTime() &&
    a.kind === b.kind &&
    a.rate.id === b.rate.id &&
    a.label === b.label &&
    (a.cause?.eventId ?? null) === (b.cause?.eventId ?? null) &&
    (a.share?.eq(b.share ?? -1) ?? b.share === null)
  );
}

/** Contiguous entries of one kind, cause, share and rate version become one line (T30: two rates → two lines). */
function merge(entries: RawEntry[]): RawEntry[] {
  const merged: RawEntry[] = [];
  for (const entry of entries) {
    const index = merged.findIndex((m) => sameGroup(m, entry));
    if (index < 0) {
      merged.push({ ...entry });
      continue;
    }
    const group = merged[index];
    merged[index] = {
      ...group,
      end: entry.end,
      quantity: group.quantity.plus(entry.quantity),
    };
  }
  return merged;
}

function toLine(entry: RawEntry, context: LineContext): LossLineDraft {
  const basis: LossBasis =
    context.basis === 'sustained' ? 'sustained_rate' : 'planning_rate';
  const cause = entry.cause;
  return {
    ledger: context.ledger,
    kind: entry.kind,
    sliceId: context.sliceId,
    segmentStart: entry.start,
    segmentEnd: entry.end,
    quantity: entry.quantity,
    uom: context.uom,
    basis,
    rateVersionId: entry.rate.id,
    cause,
    scheduleClass: cause?.scheduleClass ?? null,
    oeeComponent: entry.kind === 'availability' ? 'availability' : null,
    flags: [
      ...(entry.label ? [`exclusion:${entry.label}`] : []),
      // SME E2: starvation propagated from an upstream stop (the cause), named by its unit
      ...(cause?.starvedFrom
        ? ['upstream_starvation', `origin_unit:${cause.starvedFrom}`]
        : []),
    ],
    evidence: cause
      ? [
          {
            eventId: cause.eventId,
            eventRevisionId: cause.revisionId,
            occurrenceId: cause.occurrenceId,
            share: (entry.share ?? new Dec(1)).toFixed(8),
            clippedStart: entry.start,
            clippedEnd: entry.end,
          },
        ]
      : [],
    autoKey: autoKey(
      { ledger: context.ledger, kind: entry.kind, sliceId: context.sliceId },
      entry.start,
      cause,
    ),
  };
}

/**
 * Schedule-exclusion and availability lines of a slice (ACC02 full stops: rate × non-overlapping stopped
 * time, shared between the occurrences active in each segment), at the ledger's rate.
 */
export function timeLines(
  segments: readonly Segment[],
  context: LineContext,
): LossLineDraft[] {
  return merge(rawEntries(segments, context.basis)).map((entry) =>
    toLine(entry, context),
  );
}
