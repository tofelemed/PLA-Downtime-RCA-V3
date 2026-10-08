import { createHash } from 'crypto';
import { BoundedInterval, clip } from '../time/interval-algebra';
import { GeneratedShift, ScheduleExclusionKind } from './calendar.types';
import { formatWallDate, msOfTime, MS_PER_MINUTE } from './wall-clock';
import { zoneOffsetAt } from './zone-timeline';

/** What schedule queries need of a stored or generated instance. */
export type ScheduleInstance = Pick<
  GeneratedShift,
  'utcStart' | 'utcEnd' | 'isExcluded' | 'exclusionKind'
>;

/** Capacity-ledger view of a window (ACC01): scheduled time and the schedule-exclusion bucket. */
export interface ScheduleBreakdown {
  window: BoundedInterval;
  /** S for KPI01: non-excluded shift time inside the window */
  scheduledSeconds: number;
  /** `schedule_exclusion` bucket: excluded shift time inside the window */
  scheduleExclusionSeconds: number;
  exclusionSecondsByKind: Partial<Record<ScheduleExclusionKind, number>>;
  /** window time covered by no shift instance at all */
  unscheduledSeconds: number;
}

/** Σ of non-excluded instance time inside the half-open window (KPI01 scheduled time S). */
export function scheduledSeconds(
  instances: readonly ScheduleInstance[],
  window: BoundedInterval,
): number {
  return scheduleBreakdown(instances, window).scheduledSeconds;
}

/** Scheduled, excluded (per kind) and unscheduled seconds of a window; instances never overlap. */
export function scheduleBreakdown(
  instances: readonly ScheduleInstance[],
  window: BoundedInterval,
): ScheduleBreakdown {
  let scheduled = 0;
  let excluded = 0;
  const byKind: Partial<Record<ScheduleExclusionKind, number>> = {};
  for (const instance of instances) {
    const part = clip(
      { start: instance.utcStart, end: instance.utcEnd },
      window,
    );
    if (!part) continue;
    const seconds = (part.end.getTime() - part.start.getTime()) / 1000;
    if (!instance.isExcluded) {
      scheduled += seconds;
      continue;
    }
    excluded += seconds;
    const kind = instance.exclusionKind;
    if (kind) byKind[kind] = (byKind[kind] ?? 0) + seconds;
  }
  const windowSeconds = (window.end.getTime() - window.start.getTime()) / 1000;
  return {
    window,
    scheduledSeconds: scheduled,
    scheduleExclusionSeconds: excluded,
    exclusionSecondsByKind: byKind,
    unscheduledSeconds: Math.max(0, windowSeconds - scheduled - excluded),
  };
}

/**
 * Sorted distinct UTC instants strictly inside the window where a shift (or an exclusion split)
 * starts or ends: the cut points for splitting downtime at shift and day changes (DT05, T29).
 */
export function shiftBoundaries(
  instances: ReadonlyArray<Pick<ScheduleInstance, 'utcStart' | 'utcEnd'>>,
  window: BoundedInterval,
): Date[] {
  const from = window.start.getTime();
  const to = window.end.getTime();
  const times = new Set<number>();
  for (const instance of instances) {
    for (const time of [
      instance.utcStart.getTime(),
      instance.utcEnd.getTime(),
    ]) {
      if (time > from && time < to) times.add(time);
    }
  }
  return [...times].sort((a, b) => a - b).map((time) => new Date(time));
}

/**
 * Production date of an instant (CAL01): the local date of the operational day containing it, i.e. the
 * local date of `instant + offset − operationalDayStart`.
 */
export function productionDate(
  instant: Date,
  offsetMinutes: number,
  operationalDayStart: string,
): string {
  const wall = instant.getTime() + offsetMinutes * MS_PER_MINUTE;
  return formatWallDate(wall - msOfTime(operationalDayStart));
}

/** Operational date in force at `instant` for a zone and day start ("today" for materialization). */
export function operationalDateAt(
  instant: Date,
  zone: string,
  operationalDayStart: string,
): string {
  return productionDate(
    instant,
    zoneOffsetAt(zone, instant),
    operationalDayStart,
  );
}

/** Content hash of instances (idempotent regeneration: equal hash = identical rows). */
export function instancesHash(
  instances: ReadonlyArray<
    Omit<GeneratedShift, 'localStart' | 'localEnd'> & {
      calendarVersionId: string;
    }
  >,
): string {
  const rows = [...instances]
    .sort((a, b) => a.utcStart.getTime() - b.utcStart.getTime())
    .map((i) => [
      i.calendarVersionId,
      i.localDate,
      i.shiftName,
      i.utcStart.toISOString(),
      i.utcEnd.toISOString(),
      i.utcOffsetStart,
      i.utcOffsetEnd,
      i.isExcluded,
      i.exclusionKind,
      i.exclusionReason,
      i.crewId,
    ]);
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
