import { Dec, formatDec, toDec, ZERO } from '../decimal';
import {
  PeriodFinding,
  SourceCandidate,
  SourceSegment,
  Window,
} from './period-actuals.types';

/** A production output event as the period engine reads it (PI Production Output frame or manual). */
export interface PeriodOutputEvent {
  identity: string;
  revision: number | null;
  start: Date;
  /** booking instant; null while the event is open (not booked yet) */
  end: Date | null;
  /** gross quantity (D05: good = gross − rejects) */
  quantity: string | number | null;
  rejects: string | number | null;
  uom: string | null;
  /** measured split delivered by the source (ACT02); pieces are booked like events */
  distribution?: Array<{
    from: Date;
    to: Date;
    quantity: string;
    rejects?: string | null;
  }> | null;
}

interface Share {
  quantity: Dec;
  rejects: Dec;
  rejectsKnown?: boolean;
  basis: 'measured' | 'estimated';
  observed: { start: Date; end: Date } | null;
  finding?: PeriodFinding;
}

const SCALE = 8;

/** A stop of the unit (production halted), used to split spanning output by running time. */
export interface StoppedSpan {
  start: Date;
  end: Date;
}

interface SplitOptions {
  allowProportional: boolean;
  stopped: readonly StoppedSpan[];
}

/**
 * Σ output booked in `[from, to)` (ACT02, PI09): every source identity counts once (latest revision); an
 * event inside the window counts whole and measured; an event spanning a boundary is split by its
 * measured distribution when the source delivered one, else — when the coverage policy allows it — in
 * proportion to time and marked estimated (cumulative rounding, so the shares of adjacent windows add
 * up to the event exactly); otherwise it is booked whole in the window holding its end and every window
 * it touches gets a `spanning_event` problem. Open events are not booked. Coverage = the union of the
 * booked event intervals inside the window.
 */
export function distributeOutputEvents(
  events: readonly PeriodOutputEvent[],
  window: Window,
  allowProportionalEstimate: boolean,
  stopped: readonly StoppedSpan[] = [],
): SourceCandidate {
  const split: SplitOptions = {
    allowProportional: allowProportionalEstimate,
    stopped,
  };
  const acc = emptyAccumulator();
  const latest = [...latestVersions(events).values()].filter((event) =>
    touches(event, window),
  );
  for (const event of latest) {
    for (const share of sharesOf(event, window, split)) {
      add(acc, event, share);
    }
  }
  const uom = commonUom(latest, acc.findings);
  const known = acc.counted > 0 && uom !== undefined;
  return {
    source: 'pi_output_ef',
    method: 'output_events',
    label: 'production_output_events',
    basis: 'gross',
    quantity: known ? acc.gross : null,
    reject: known && acc.rejectsKnown ? acc.rejects : null,
    measured: acc.measured,
    estimated: acc.estimated,
    uom: uom ?? null,
    available: latest.length > 0,
    observed: acc.observed,
    segments: acc.segments,
    findings: acc.findings,
  };
}

interface Accumulator {
  gross: Dec;
  rejects: Dec;
  measured: Dec;
  estimated: Dec;
  counted: number;
  rejectsKnown: boolean;
  observed: Array<{ start: Date; end: Date }>;
  segments: SourceSegment[];
  findings: PeriodFinding[];
}

function emptyAccumulator(): Accumulator {
  return {
    gross: ZERO,
    rejects: ZERO,
    measured: ZERO,
    estimated: ZERO,
    counted: 0,
    rejectsKnown: false,
    observed: [],
    segments: [],
    findings: [],
  };
}

function add(acc: Accumulator, event: PeriodOutputEvent, share: Share): void {
  if (share.finding) acc.findings.push(share.finding);
  if (!share.observed) return;
  acc.counted += 1;
  acc.rejectsKnown ||= share.rejectsKnown === true;
  acc.gross = acc.gross.plus(share.quantity);
  acc.rejects = acc.rejects.plus(share.rejects);
  if (share.basis === 'measured')
    acc.measured = acc.measured.plus(share.quantity);
  else acc.estimated = acc.estimated.plus(share.quantity);
  acc.observed.push(share.observed);
  acc.segments.push(segmentOf(event, share));
}

function sharesOf(
  event: PeriodOutputEvent,
  window: Window,
  split: SplitOptions,
): Share[] {
  if (!event.end) return [openShare(event)];
  const quantity = toDec(event.quantity);
  if (!quantity || quantity.isNegative()) return [negativeShare(event)];
  const rejectsValue = toDec(event.rejects);
  const rejects = rejectsValue ?? ZERO;
  const rejectsKnown = rejectsValue !== null;
  if (event.distribution && event.distribution.length > 0) {
    return event.distribution
      .map((piece, index) => pieceEvent(event, piece, index, quantity.isZero()))
      .filter((piece) => touches(piece, window))
      .flatMap((piece) => sharesOf(piece, window, split));
  }
  const bounded = { start: event.start, end: event.end };
  if (inside(bounded, window)) {
    return [
      { quantity, rejects, rejectsKnown, basis: 'measured', observed: bounded },
    ];
  }
  const share = split.allowProportional
    ? proportionalShare(bounded, window, { quantity, rejects }, split.stopped)
    : bookedWhole(event, bounded, window, { quantity, rejects });
  return [{ ...share, rejectsKnown }];
}

/** Milliseconds of `[from, to)` the unit was not stopped (stops may overlap each other). */
function runningMs(
  from: number,
  to: number,
  stopped: readonly StoppedSpan[],
): number {
  const cuts = stopped
    .map((s) => [
      Math.max(from, s.start.getTime()),
      Math.min(to, s.end.getTime()),
    ])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let idle = 0;
  let reached = from;
  for (const [a, b] of cuts) {
    const start = Math.max(a, reached);
    if (b > start) idle += b - start;
    reached = Math.max(reached, b);
  }
  return to - from - idle;
}

/**
 * Estimate of a spanning event's share of a window (SME Q8: an estimate only — counters and measured
 * splits come first): by running time when the unit's stops are known and some running time remains,
 * else by elapsed time; cumulative rounding R(q × a) − R(q × b), so adjacent windows add up exactly.
 */
function proportionalShare(
  event: { start: Date; end: Date },
  window: Window,
  amounts: { quantity: Dec; rejects: Dec },
  stopped: readonly StoppedSpan[],
): Share {
  const start = event.start.getTime();
  const end = event.end.getTime();
  const byRunning = stopped.length > 0 && runningMs(start, end, stopped) > 0;
  const elapsed = (at: number) =>
    byRunning ? runningMs(start, at, stopped) : at - start;
  const duration = new Dec(elapsed(end));
  const from = Math.max(window.from.getTime(), start);
  const to = Math.min(window.to.getTime(), end);
  const part = (total: Dec) =>
    cumulative(total, elapsed(to), duration).minus(
      cumulative(total, elapsed(from), duration),
    );
  return {
    quantity: part(amounts.quantity),
    rejects: part(amounts.rejects),
    basis: 'estimated',
    observed: { start: new Date(from), end: new Date(to) },
    finding: {
      code: 'proportional_estimate',
      severity: 'info',
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      detail: { method: byRunning ? 'running_time' : 'elapsed_time' },
    },
  };
}

function cumulative(total: Dec, elapsedMs: number, duration: Dec): Dec {
  return total
    .times(elapsedMs)
    .div(duration)
    .toDecimalPlaces(SCALE, Dec.ROUND_HALF_EVEN);
}

/** Policy forbids estimates: the whole event goes to the window holding its end; all windows flag it. */
function bookedWhole(
  event: PeriodOutputEvent,
  bounded: { start: Date; end: Date },
  window: Window,
  amounts: { quantity: Dec; rejects: Dec },
): Share {
  const { quantity, rejects } = amounts;
  const end = bounded.end.getTime();
  const booksHere = end > window.from.getTime() && end <= window.to.getTime();
  const finding: PeriodFinding = {
    code: 'spanning_event',
    severity: 'problem',
    from: bounded.start.toISOString(),
    to: bounded.end.toISOString(),
    detail: {
      identity: event.identity,
      bookedInThisPeriod: booksHere,
      reason: 'no measured distribution; proportional estimate not allowed',
    },
  };
  if (!booksHere)
    return { quantity, rejects, basis: 'measured', observed: null, finding };
  const observed = {
    start: new Date(Math.max(bounded.start.getTime(), window.from.getTime())),
    end: bounded.end,
  };
  return { quantity, rejects, basis: 'measured', observed, finding };
}

function openShare(event: PeriodOutputEvent): Share {
  return {
    quantity: ZERO,
    rejects: ZERO,
    basis: 'measured',
    observed: null,
    finding: {
      code: 'open_output_event',
      severity: 'info',
      from: event.start.toISOString(),
      detail: { identity: event.identity },
    },
  };
}

function negativeShare(event: PeriodOutputEvent): Share {
  return {
    quantity: ZERO,
    rejects: ZERO,
    basis: 'measured',
    observed: null,
    finding: {
      code: 'negative_output',
      severity: 'problem',
      from: event.start.toISOString(),
      detail: { identity: event.identity, quantity: event.quantity },
    },
  };
}

function pieceEvent(
  event: PeriodOutputEvent,
  piece: NonNullable<PeriodOutputEvent['distribution']>[number],
  index: number,
  zero: boolean,
): PeriodOutputEvent {
  return {
    identity: `${event.identity}#${index}`,
    revision: event.revision,
    start: piece.from,
    end: piece.to,
    quantity: zero ? '0' : piece.quantity,
    rejects: piece.rejects ?? null,
    uom: event.uom,
  };
}

function segmentOf(event: PeriodOutputEvent, share: Share): SourceSegment {
  return {
    source: `production_event:${event.identity}`,
    from: share.observed?.start.toISOString() ?? event.start.toISOString(),
    to: share.observed?.end.toISOString() ?? event.start.toISOString(),
    quantity: formatDec(share.quantity),
    method: 'output_events',
    quality: share.basis,
  };
}

/** The one quantity unit of the counted events; undefined (and a problem) when they differ. */
function commonUom(
  events: readonly PeriodOutputEvent[],
  findings: PeriodFinding[],
): string | null | undefined {
  const units = new Set(
    events.map((event) => event.uom?.trim().toLowerCase() ?? ''),
  );
  units.delete('');
  if (units.size <= 1) return [...units][0] ?? null;
  findings.push({
    code: 'mixed_uom',
    severity: 'problem',
    detail: { units: [...units] },
  });
  return undefined;
}

function latestVersions(
  events: readonly PeriodOutputEvent[],
): Map<string, PeriodOutputEvent> {
  const latest = new Map<string, PeriodOutputEvent>();
  for (const event of events) {
    const held = latest.get(event.identity);
    if (!held || (event.revision ?? 0) >= (held.revision ?? 0)) {
      latest.set(event.identity, event);
    }
  }
  return latest;
}

function touches(event: PeriodOutputEvent, window: Window): boolean {
  const end = event.end?.getTime() ?? Number.POSITIVE_INFINITY;
  return (
    event.start.getTime() < window.to.getTime() && end > window.from.getTime()
  );
}

function inside(event: { start: Date; end: Date }, window: Window): boolean {
  return (
    event.start.getTime() >= window.from.getTime() &&
    event.end.getTime() <= window.to.getTime()
  );
}
