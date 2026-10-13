import { PhysicalType } from './event-classification';

/** Tolerance when both `end` and `durationSeconds` are given (DT08). */
const DURATION_TOLERANCE_SECONDS = 1;

/** Clock difference between the browser and the server tolerated before a time counts as future (DT-09). */
const FUTURE_ALLOWANCE_SECONDS = 120;

export interface IntervalInput {
  start: Date;
  end?: Date | null;
  durationSeconds?: number | null;
  physicalType: PhysicalType;
}

export type IntervalViolationCode =
  | 'INVALID_START'
  | 'END_BEFORE_START'
  | 'DURATION_CONFLICT'
  | 'ZERO_DURATION_DOWNTIME'
  | 'NEGATIVE_DURATION'
  | 'IN_FUTURE';

/** A create/update that breaks the interval rules; the API maps it to 422 with this code. */
export class IntervalViolation extends Error {
  constructor(
    readonly code: IntervalViolationCode,
    message: string,
    readonly field: string,
  ) {
    super(message);
  }
}

/**
 * DT08 manual-create rules. Returns the effective `[start, end)`: a duration-only entry computes the
 * end; end and duration together must agree within 1 s; `end > start`; a stop cannot last zero
 * seconds. No end and no duration leaves the event open.
 */
export function resolveInterval(input: IntervalInput): {
  start: Date;
  end: Date | null;
} {
  const startMs = input.start.getTime();
  if (Number.isNaN(startMs)) {
    throw new IntervalViolation(
      'INVALID_START',
      'startTime must be a valid timestamp',
      'startTime',
    );
  }
  const end = effectiveEnd(input, startMs);
  if (end && end.getTime() <= startMs) {
    if (end.getTime() === startMs && input.physicalType === 'downtime') {
      throw new IntervalViolation(
        'ZERO_DURATION_DOWNTIME',
        'A downtime event must last longer than zero seconds',
        'endTime',
      );
    }
    throw new IntervalViolation(
      'END_BEFORE_START',
      'endTime must be after startTime',
      'endTime',
    );
  }
  return { start: input.start, end };
}

function effectiveEnd(input: IntervalInput, startMs: number): Date | null {
  const duration = input.durationSeconds ?? null;
  if (duration !== null && duration < 0) {
    throw new IntervalViolation(
      'NEGATIVE_DURATION',
      'durationSeconds must not be negative',
      'durationSeconds',
    );
  }
  const fromDuration =
    duration === null ? null : new Date(startMs + duration * 1000);
  const end = input.end ?? null;
  if (end && fromDuration) {
    const gapSeconds = Math.abs(end.getTime() - fromDuration.getTime()) / 1000;
    if (gapSeconds > DURATION_TOLERANCE_SECONDS) {
      throw new IntervalViolation(
        'DURATION_CONFLICT',
        'endTime and durationSeconds disagree by more than 1 second',
        'durationSeconds',
      );
    }
    return end;
  }
  return end ?? fromDuration;
}

/**
 * DT-09: a manual start or end may not lie in the future beyond the clock allowance; an event that has
 * not happened yet would count as stopped or running time that nobody measured.
 */
export function assertNotInFuture(
  interval: { start: Date; end: Date | null },
  now: Date,
): void {
  const latest = now.getTime() + FUTURE_ALLOWANCE_SECONDS * 1000;
  if (interval.start.getTime() > latest) {
    throw new IntervalViolation(
      'IN_FUTURE',
      'startTime must not be in the future',
      'startTime',
    );
  }
  if (interval.end && interval.end.getTime() > latest) {
    throw new IntervalViolation(
      'IN_FUTURE',
      'endTime must not be in the future',
      'endTime',
    );
  }
}
