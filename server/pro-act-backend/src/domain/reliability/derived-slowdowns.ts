import { Dec } from '../actuals/decimal';
import { analogValue } from './analog-state';
import { StopDerivationConfig } from './derived-stops';
import { StateSample, StateSegment } from './unit-state';

/** A reduced-rate span the state engine turns into a slowdown (performance) event. */
export interface DerivedSlowdown {
  /** stable identity within the unit: `reduced_rate@<start ms>` */
  key: string;
  /** a slowdown is its own occurrence */
  occurrenceKey: string;
  start: Date;
  /** null = still at a reduced rate at the live edge */
  end: Date | null;
  /** time-weighted mean of the signal over the span; null without numeric samples */
  meanValue: number | null;
  /** share of the rate lost, 1 − mean / rated (8 places); null = no rated value or no loss measured */
  fraction: string | null;
}

interface Span {
  start: number;
  end: number;
}

/**
 * Reduced-rate spans after restart confirmation: running shorter than the confirmation between two
 * reduced-rate pieces does not end the slowdown (as a short restart does not end a stop, DT02).
 */
function reducedSpans(
  segments: readonly StateSegment[],
  confirmMs: number,
): Span[] {
  const spans: Span[] = [];
  let pendingRunning: Span | null = null;
  for (const s of segments) {
    const piece = { start: s.start.getTime(), end: s.end.getTime() };
    const last = spans[spans.length - 1];
    if (s.state === 'reduced_rate') {
      const joins =
        last !== undefined &&
        (last.end === piece.start ||
          (pendingRunning !== null &&
            pendingRunning.start === last.end &&
            pendingRunning.end === piece.start &&
            pendingRunning.end - pendingRunning.start < confirmMs));
      if (joins) last.end = piece.end;
      else spans.push(piece);
      pendingRunning = null;
      continue;
    }
    pendingRunning = s.state === 'running' ? piece : null;
  }
  return spans;
}

/** Time-weighted mean of the numeric samples over the span (each sample holds until the next). */
function meanOver(samples: readonly StateSample[], span: Span): number | null {
  let weighted = 0;
  let total = 0;
  samples.forEach((sample, i) => {
    const value = analogValue(sample.value);
    if (value === null) return;
    const from = Math.max(sample.at.getTime(), span.start);
    const to = Math.min(samples[i + 1]?.at.getTime() ?? span.end, span.end);
    if (to <= from) return;
    weighted += value * (to - from);
    total += to - from;
  });
  return total > 0 ? weighted / total : null;
}

const shortNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

/** Event description of a derived slowdown: the mean signal value and, when rated, the share lost. */
export function describeSlowdown(slowdown: DerivedSlowdown): string {
  const label = 'State engine: reduced rate';
  if (slowdown.meanValue === null) return label;
  const mean = `mean signal ${shortNumber(slowdown.meanValue)}`;
  if (slowdown.fraction === null) return `${label} (${mean})`;
  const lost = new Dec(slowdown.fraction)
    .mul(100)
    .toDecimalPlaces(1)
    .toString();
  return `${label} (${mean}, ${lost} % of the rate lost)`;
}

function fractionOf(mean: number | null, rated: number | null): string | null {
  if (mean === null || rated === null || rated <= 0) return null;
  const lost = new Dec(1).minus(new Dec(mean).div(rated));
  if (lost.lte(0)) return null;
  return (lost.gt(1) ? new Dec(1) : lost).toDecimalPlaces(8).toString();
}

/**
 * Plan 1.10 reduced-rate segments (DT01 / DT03): every reduced-rate span of the state timeline lasting at
 * least the debounce becomes a slowdown event — performance, never a stop; running shorter than the
 * restart confirmation inside it does not end it. With the signal's rated value the slowdown carries the
 * share of the rate lost (1 − time-weighted mean / rated), the derate the ledgers value at the sustained
 * rate; without one it records the slowdown unquantified. A span reaching `liveEdge` is open. Deterministic.
 */
export function deriveSlowdowns(
  segments: readonly StateSegment[],
  samples: readonly StateSample[],
  input: {
    config: StopDerivationConfig;
    ratedValue: number | null;
    liveEdge: Date | null;
  },
): DerivedSlowdown[] {
  const sorted = [...samples].sort((a, b) => a.at.getTime() - b.at.getTime());
  const edge = input.liveEdge?.getTime() ?? null;
  return reducedSpans(segments, input.config.restartConfirmSeconds * 1000)
    .filter(
      (span) => span.end - span.start >= input.config.debounceSeconds * 1000,
    )
    .map((span) => {
      const key = `reduced_rate@${span.start}`;
      const meanValue = meanOver(sorted, span);
      return {
        key,
        occurrenceKey: key,
        start: new Date(span.start),
        end: edge !== null && span.end >= edge ? null : new Date(span.end),
        meanValue,
        fraction: fractionOf(meanValue, input.ratedValue),
      };
    });
}
