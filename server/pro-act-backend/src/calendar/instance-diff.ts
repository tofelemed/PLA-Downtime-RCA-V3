import { GeneratedShift } from '../domain/calendar/calendar.types';

type InstanceRow = GeneratedShift;

export interface InstanceChange {
  utcStart: string;
  current: InstanceRow;
  candidate: InstanceRow;
}

/** Candidate vs stored instances keyed by UTC start (preview "diff vs current"). */
export interface InstanceDiff {
  added: InstanceRow[];
  removed: InstanceRow[];
  changed: InstanceChange[];
  unchangedCount: number;
}

/** Fields that make two instances with the same start different (the version id does not). */
const COMPARED: ReadonlyArray<keyof InstanceRow> = [
  'localDate',
  'shiftName',
  'utcOffsetStart',
  'utcOffsetEnd',
  'isExcluded',
  'exclusionKind',
  'exclusionReason',
  'crewId',
];

export function diffInstances(
  current: readonly InstanceRow[],
  candidate: readonly InstanceRow[],
): InstanceDiff {
  const key = (row: InstanceRow): string => row.utcStart.toISOString();
  const currentByStart = new Map(current.map((row) => [key(row), row]));
  const candidateStarts = new Set(candidate.map(key));
  const diff: InstanceDiff = {
    added: [],
    removed: [],
    changed: [],
    unchangedCount: 0,
  };
  for (const row of candidate) {
    const stored = currentByStart.get(key(row));
    if (!stored) diff.added.push(row);
    else if (differs(stored, row)) {
      diff.changed.push({
        utcStart: key(row),
        current: stored,
        candidate: row,
      });
    } else diff.unchangedCount += 1;
  }
  diff.removed = current.filter((row) => !candidateStarts.has(key(row)));
  return diff;
}

function differs(a: InstanceRow, b: InstanceRow): boolean {
  if (a.utcEnd.getTime() !== b.utcEnd.getTime()) return true;
  return COMPARED.some((field) => a[field] !== b[field]);
}
