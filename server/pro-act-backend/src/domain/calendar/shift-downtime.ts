import { DowntimeOccurrence } from '../events/unit-downtime';
import {
  BoundedInterval,
  splitAt,
  unionSeconds,
} from '../time/interval-algebra';
import { GeneratedShift } from './calendar.types';
import { shiftBoundaries } from './schedule-metrics';

/** A shift instance as downtime attribution needs it. */
export type DowntimeShift = Pick<
  GeneratedShift,
  'localDate' | 'shiftName' | 'utcStart' | 'utcEnd' | 'isExcluded'
> & { id: string };

export interface ShiftDowntime {
  shiftInstanceId: string;
  localDate: string;
  shiftName: string;
  start: Date;
  end: Date;
  isExcluded: boolean;
  /** union of the fragments inside this shift */
  downtimeSeconds: number;
  /** physical stops with a fragment in this shift (a stop across a boundary counts in both shifts) */
  occurrenceCount: number;
}

export interface DowntimeBySchedule {
  shifts: ShiftDowntime[];
  /** downtime inside non-excluded shift time (clipped to the schedule) */
  scheduledDowntimeSeconds: number;
  /** downtime inside no shift or inside excluded time */
  outsideScheduleSeconds: number;
  /** distinct physical stops over the whole window (T29: one, however many boundaries it crosses) */
  occurrenceCount: number;
}

interface Fragment extends BoundedInterval {
  occurrenceId: string;
}

/**
 * Attributes unit downtime to shift instances (DT05, plan 2.1 step 3): every occurrence is cut with
 * `splitAt` at the shift boundaries inside the window, each fragment goes to the shift containing it,
 * and per-shift seconds are unions (overlapping assets count once). T29: a stop 05:50–06:20 around a
 * 06:00 boundary gives 600 s to the earlier shift and 1200 s to the later one, one occurrence.
 */
export function downtimeBySchedule(
  occurrences: readonly DowntimeOccurrence[],
  shifts: readonly DowntimeShift[],
  window: BoundedInterval,
): DowntimeBySchedule {
  const cuts = shiftBoundaries(shifts, window);
  const fragments: Fragment[] = occurrences.flatMap((o) =>
    splitAt({ start: o.start, end: o.end }, cuts).map((part) => ({
      ...part,
      occurrenceId: o.occurrenceId,
    })),
  );
  const perShift = shifts.map((shift) => shiftDowntime(shift, fragments));
  const scheduledFragments = fragments.filter((f) =>
    shifts.some((s) => !s.isExcluded && contains(s, f)),
  );
  const scheduled = unionSeconds(scheduledFragments);
  return {
    shifts: perShift,
    scheduledDowntimeSeconds: scheduled,
    outsideScheduleSeconds: unionSeconds(fragments) - scheduled,
    occurrenceCount: new Set(occurrences.map((o) => o.occurrenceId)).size,
  };
}

function shiftDowntime(
  shift: DowntimeShift,
  fragments: Fragment[],
): ShiftDowntime {
  const inside = fragments.filter((f) => contains(shift, f));
  return {
    shiftInstanceId: shift.id,
    localDate: shift.localDate,
    shiftName: shift.shiftName,
    start: shift.utcStart,
    end: shift.utcEnd,
    isExcluded: shift.isExcluded,
    downtimeSeconds: unionSeconds(inside),
    occurrenceCount: new Set(inside.map((f) => f.occurrenceId)).size,
  };
}

function contains(shift: DowntimeShift, fragment: BoundedInterval): boolean {
  return fragment.start >= shift.utcStart && fragment.end <= shift.utcEnd;
}
