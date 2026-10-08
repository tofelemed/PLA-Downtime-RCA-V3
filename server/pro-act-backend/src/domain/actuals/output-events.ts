import { EngineException, TimeWindow } from './actuals.types';
import { windowProblem } from './coverage';
import { formatDec, toDec, ZERO } from './decimal';

/**
 * One incremental output record: a PI Production Output event frame (D05 primary source) or an
 * `output_increment` sample. `identity` is the source identity; several versions of one identity are
 * counted once (the highest `revision`, else the last given).
 */
export interface OutputEventInput {
  identity: string;
  revision?: string | number | null;
  /** the instant the quantity is booked at (event end, or sample time) */
  at: Date;
  /** event start, when the record spans an interval */
  start?: Date | null;
  quantity: string | number | null;
  rejects?: string | number | null;
  retracted?: boolean;
}

export interface OutputResult {
  /** gross = Σ quantities; null when nothing was booked in the window */
  quantity: string | null;
  rejects: string;
  /** D05: good = gross − rejects */
  good: string | null;
  counted: number;
  /** versions of an identity that were not counted (superseded) */
  superseded: number;
  exceptions: EngineException[];
}

/**
 * Σ incremental quantities booked in `[from, to)` (PI09: an output event frame counts once per source
 * identity). Retracted and negative records are not counted (negative ones are reported). A record
 * that started before the window is counted by its booking time and reported as `spanning_event`: its
 * distribution over periods belongs to the period engine (2.4).
 */
export function outputEvents(
  events: OutputEventInput[],
  window: TimeWindow,
): OutputResult {
  const problem = windowProblem(window);
  if (problem) return emptyOutput([problem], 0);
  const latest = latestVersions(events);
  const from = window.from.getTime();
  const to = window.to.getTime();
  const exceptions: EngineException[] = [];
  let gross = ZERO;
  let rejects = ZERO;
  let counted = 0;
  for (const event of latest.values()) {
    const at = event.at.getTime();
    if (event.retracted || at < from || at >= to) continue;
    const quantity = toDec(event.quantity);
    if (!quantity || quantity.isNegative()) {
      exceptions.push(negative(event));
      continue;
    }
    if (event.start && event.start.getTime() < from) {
      exceptions.push(spanning(event));
    }
    gross = gross.plus(quantity);
    rejects = rejects.plus(toDec(event.rejects) ?? ZERO);
    counted += 1;
  }
  if (counted === 0)
    return emptyOutput(exceptions, events.length - latest.size);
  return {
    quantity: formatDec(gross),
    rejects: formatDec(rejects),
    good: formatDec(gross.minus(rejects)),
    counted,
    superseded: events.length - latest.size,
    exceptions,
  };
}

/** The version of each identity with the highest numeric revision (else the last one given). */
function latestVersions(
  events: OutputEventInput[],
): Map<string, OutputEventInput> {
  const latest = new Map<string, OutputEventInput>();
  for (const event of events) {
    const held = latest.get(event.identity);
    if (!held || !olderThan(event, held)) latest.set(event.identity, event);
  }
  return latest;
}

function olderThan(
  candidate: OutputEventInput,
  held: OutputEventInput,
): boolean {
  const a = toDec(candidate.revision ?? null);
  const b = toDec(held.revision ?? null);
  return a !== null && b !== null && a.lt(b);
}

function emptyOutput(
  exceptions: EngineException[],
  superseded: number,
): OutputResult {
  return {
    quantity: null,
    rejects: '0',
    good: null,
    counted: 0,
    superseded,
    exceptions,
  };
}

function negative(event: OutputEventInput): EngineException {
  return {
    code: 'negative_output',
    from: event.at.toISOString(),
    detail: { identity: event.identity, quantity: event.quantity },
  };
}

function spanning(event: OutputEventInput): EngineException {
  return {
    code: 'spanning_event',
    from: event.start?.toISOString(),
    to: event.at.toISOString(),
    detail: { identity: event.identity },
  };
}
