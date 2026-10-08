import { BoundedInterval, splitAt, union } from '../time/interval-algebra';
import { GeneratedShift, ScheduleExclusionKind } from './calendar.types';
import { ZoneTimeline } from './zone-timeline';
import { formatLocal } from './wall-clock';

/** A UTC window taken out of scheduled time (exclusion, non-working time). */
export interface ExclusionWindow extends BoundedInterval {
  kind: ScheduleExclusionKind;
  reason: string;
}

/**
 * Instance for `[start, end)` with offsets and local labels from the zone timeline. The end offset is the
 * one in force just before the end, so a piece that ends at a fall-back transition is labelled in the
 * offset it ran in.
 */
export function shiftPiece(
  timeline: ZoneTimeline,
  base: Pick<GeneratedShift, 'localDate' | 'shiftName' | 'crewId'>,
  interval: BoundedInterval,
  exclusion: { kind: ScheduleExclusionKind; reason: string } | null,
): GeneratedShift {
  const start = interval.start.getTime();
  const end = interval.end.getTime();
  const offsetStart = timeline.offsetAt(start);
  const offsetEnd = timeline.offsetAt(end - 1);
  return {
    localDate: base.localDate,
    shiftName: base.shiftName,
    utcStart: new Date(start),
    utcEnd: new Date(end),
    utcOffsetStart: offsetStart,
    utcOffsetEnd: offsetEnd,
    localStart: formatLocal(start, offsetStart),
    localEnd: formatLocal(end, offsetEnd),
    isExcluded: exclusion !== null,
    exclusionKind: exclusion?.kind ?? null,
    exclusionReason: exclusion?.reason ?? null,
    crewId: base.crewId,
  };
}

/**
 * Splits instances at the bounds of `windows` and marks the pieces inside one as excluded (CAL01: an
 * exclusion inside a shift splits the instance). Pieces already excluded keep their reason, so the
 * first marking wins. Adjacent pieces with the same state are merged back.
 */
export function markWindows(
  shifts: readonly GeneratedShift[],
  windows: readonly ExclusionWindow[],
  timeline: ZoneTimeline,
): GeneratedShift[] {
  return shifts.flatMap((shift) => {
    const interval = { start: shift.utcStart, end: shift.utcEnd };
    const relevant = windows.filter(
      (w) => w.start < shift.utcEnd && w.end > shift.utcStart,
    );
    if (shift.isExcluded || relevant.length === 0) return [shift];
    const cuts = relevant.flatMap((w) => [w.start, w.end]);
    const pieces = splitAt(interval, cuts).map((part) => {
      const hit = relevant.find(
        (w) => w.start <= part.start && w.end >= part.end,
      );
      return shiftPiece(timeline, shift, part, hit ?? null);
    });
    return mergeAdjacent(pieces, timeline);
  });
}

/** Complement of `kept` inside `span`: the windows that are not working time. */
export function complementWindows(
  kept: readonly BoundedInterval[],
  span: BoundedInterval,
): BoundedInterval[] {
  const gaps: BoundedInterval[] = [];
  let cursor = span.start.getTime();
  for (const interval of union(kept)) {
    if (interval.start.getTime() > cursor) {
      gaps.push({ start: new Date(cursor), end: interval.start });
    }
    cursor = Math.max(cursor, interval.end.getTime());
  }
  if (cursor < span.end.getTime()) {
    gaps.push({ start: new Date(cursor), end: span.end });
  }
  return gaps;
}

function mergeAdjacent(
  pieces: GeneratedShift[],
  timeline: ZoneTimeline,
): GeneratedShift[] {
  const merged: GeneratedShift[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    const same =
      last &&
      last.utcEnd.getTime() === piece.utcStart.getTime() &&
      last.exclusionKind === piece.exclusionKind &&
      last.exclusionReason === piece.exclusionReason;
    if (!same) {
      merged.push(piece);
      continue;
    }
    const exclusion = last.exclusionKind
      ? { kind: last.exclusionKind, reason: last.exclusionReason ?? '' }
      : null;
    merged[merged.length - 1] = shiftPiece(
      timeline,
      last,
      { start: last.utcStart, end: piece.utcEnd },
      exclusion,
    );
  }
  return merged;
}
