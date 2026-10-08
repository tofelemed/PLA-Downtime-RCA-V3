import { Interval } from '../time/interval-algebra';

/**
 * Pure rules of the event operations (plan 1.4, spec DT09/DT10): split, merge, close. They decide
 * intervals and amounts only; persistence, revisions and lineage live in `src/event-operations/`.
 */
export type OperationViolationCode =
  | 'SPLIT_OUTSIDE_INTERVAL'
  | 'MERGE_TOO_FEW_EVENTS'
  | 'MERGE_DIFFERENT_UNITS'
  | 'MERGE_INCOMPATIBLE_CLASSIFICATION'
  | 'MERGE_GAP_EXCEEDED'
  | 'MERGE_CODING_CONFLICT'
  | 'CLOSE_END_BEFORE_START'
  | 'CLOSE_END_IN_FUTURE';

/** A rule violation; the API answers 422 with this code (and `details` when present). */
export class OperationViolation extends Error {
  constructor(
    readonly code: OperationViolationCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * DT09: the split instant must lie strictly inside the event: `start < splitAt < end`, and before
 * `now` while the event is still open. Returns the two children `[start, splitAt)` and `[splitAt, end)`.
 */
export function splitInterval(
  interval: Interval,
  splitAt: Date,
  now: Date,
): [Interval, Interval] {
  const at = splitAt.getTime();
  const limit = (interval.end ?? now).getTime();
  if (Number.isNaN(at) || at <= interval.start.getTime() || at >= limit) {
    throw new OperationViolation(
      'SPLIT_OUTSIDE_INTERVAL',
      interval.end
        ? 'splitAt must lie strictly between the start and the end of the event'
        : 'splitAt must lie after the start of the open event and before now',
    );
  }
  return [
    { start: interval.start, end: new Date(at) },
    { start: new Date(at), end: interval.end },
  ];
}

/** Share of an additive amount (quantity, cost) given to each split child; the sum is conserved. */
export function splitAmount(
  total: number | null | undefined,
  parts: [Interval, Interval],
): [number | null, number | null] {
  if (total === null || total === undefined) return [null, null];
  const [first, second] = parts;
  if (!second.end) return [0, total];
  const firstMs = first.end!.getTime() - first.start.getTime();
  const allMs = second.end.getTime() - first.start.getTime();
  const share = roundAmount((total * firstMs) / allMs);
  return [share, roundAmount(total - share)];
}

/** Sum of additive amounts; null when no part carries a value. */
export function sumAmounts(
  values: ReadonlyArray<number | null | undefined>,
): number | null {
  const present = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );
  if (present.length === 0) return null;
  return roundAmount(present.reduce((sum, value) => sum + Number(value), 0));
}

/** One event offered to a merge. */
export interface MergeCandidate {
  id: string;
  unitId: string;
  interval: Interval;
  /** physical type and schedule class must agree unless the caller overrides */
  classification: { physicalType: string; scheduleClass: string };
  /** user layer compared for conflicts: two different non-null values of a field conflict */
  coding: Readonly<Record<string, string | number | null>>;
}

export interface MergePolicy {
  /** largest gap between consecutive intervals that still merges (0 = strict adjacency/overlap) */
  maxGapSeconds: number;
  /** accept different physical types / schedule classes (the earliest event's values are kept) */
  overrideClassification: boolean;
}

export interface MergePlan {
  /** candidates sorted by start, then id */
  ordered: MergeCandidate[];
  interval: Interval;
  /** first non-null value per coding field, in start order */
  coding: Record<string, string | number | null>;
}

/**
 * DT09 merge: two or more events of one unit with compatible classifications whose intervals are
 * adjacent or overlapping within `maxGapSeconds`; the result spans the union (gaps within the policy
 * included). Conflicting coding is a violation listing every conflicting field.
 */
export function planMerge(
  candidates: readonly MergeCandidate[],
  policy: MergePolicy,
): MergePlan {
  if (new Set(candidates.map((candidate) => candidate.id)).size < 2) {
    throw new OperationViolation(
      'MERGE_TOO_FEW_EVENTS',
      'A merge needs at least two different events',
    );
  }
  const ordered = [...candidates].sort(
    (a, b) =>
      a.interval.start.getTime() - b.interval.start.getTime() ||
      a.id.localeCompare(b.id),
  );
  assertSameUnit(ordered);
  if (!policy.overrideClassification) assertSameClassification(ordered);
  const interval = mergedInterval(ordered, policy.maxGapSeconds);
  return { ordered, interval, coding: mergedCoding(ordered) };
}

/** DT10 close: `end > start` and not in the future. */
export function validateCloseEnd(start: Date, end: Date, now: Date): void {
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    throw new OperationViolation(
      'CLOSE_END_BEFORE_START',
      'endTime must be after the start of the event',
    );
  }
  if (end.getTime() > now.getTime()) {
    throw new OperationViolation(
      'CLOSE_END_IN_FUTURE',
      'endTime must not be in the future',
    );
  }
}

function assertSameUnit(ordered: readonly MergeCandidate[]): void {
  const units = new Set(ordered.map((candidate) => candidate.unitId));
  if (units.size > 1) {
    throw new OperationViolation(
      'MERGE_DIFFERENT_UNITS',
      'Only events of one unit can be merged',
      { unitIds: [...units] },
    );
  }
}

function assertSameClassification(ordered: readonly MergeCandidate[]): void {
  const keys = new Set(
    ordered.map(
      ({ classification }) =>
        `${classification.physicalType}/${classification.scheduleClass}`,
    ),
  );
  if (keys.size > 1) {
    throw new OperationViolation(
      'MERGE_INCOMPATIBLE_CLASSIFICATION',
      'Events with different physical types or schedule classes need overrideClassification',
      { classifications: [...keys] },
    );
  }
}

/** Union span; a gap above the policy between consecutive intervals is a violation. */
function mergedInterval(
  ordered: readonly MergeCandidate[],
  maxGapSeconds: number,
): Interval {
  let coveredTo: number | null = endMs(ordered[0].interval);
  for (const candidate of ordered.slice(1)) {
    if (coveredTo === null) continue;
    const gapSeconds = (candidate.interval.start.getTime() - coveredTo) / 1000;
    if (gapSeconds > maxGapSeconds) {
      throw new OperationViolation(
        'MERGE_GAP_EXCEEDED',
        `Events are ${gapSeconds} s apart; the gap policy allows ${maxGapSeconds} s`,
        { gapSeconds, maxGapSeconds, eventId: candidate.id },
      );
    }
    const end = endMs(candidate.interval);
    coveredTo = end === null ? null : Math.max(coveredTo, end);
  }
  return {
    start: ordered[0].interval.start,
    end: coveredTo === null ? null : new Date(coveredTo),
  };
}

function mergedCoding(
  ordered: readonly MergeCandidate[],
): Record<string, string | number | null> {
  const fields = new Set(ordered.flatMap(({ coding }) => Object.keys(coding)));
  const coding: Record<string, string | number | null> = {};
  const conflicts: Array<{ field: string; values: Array<string | number> }> =
    [];
  for (const field of fields) {
    const values = distinctValues(ordered, field);
    if (values.length > 1) conflicts.push({ field, values });
    coding[field] = values[0] ?? null;
  }
  if (conflicts.length > 0) {
    throw new OperationViolation(
      'MERGE_CODING_CONFLICT',
      `Conflicting coding: ${conflicts.map(({ field }) => field).join(', ')}`,
      { conflicts },
    );
  }
  return coding;
}

function distinctValues(
  ordered: readonly MergeCandidate[],
  field: string,
): Array<string | number> {
  const values: Array<string | number> = [];
  for (const { coding } of ordered) {
    const value = coding[field];
    if (value === null || value === undefined) continue;
    if (!values.some((seen) => String(seen) === String(value))) {
      values.push(value);
    }
  }
  return values;
}

function endMs(interval: Interval): number | null {
  return interval.end ? interval.end.getTime() : null;
}

/** Amounts are stored with 8 decimals (`numeric(24,8)`). */
function roundAmount(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
