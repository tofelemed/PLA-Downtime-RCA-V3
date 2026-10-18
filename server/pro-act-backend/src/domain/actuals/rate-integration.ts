import { rateQuantityUnit } from './rate-quantity-unit';
import {
  EngineException,
  EngineSample,
  EngineSignal,
  QuantityMethod,
  QuantityResult,
  QuantitySegment,
  RateTimebase,
  TimeWindow,
} from './actuals.types';
import { iso, refusedResult, resultOf, windowProblem } from './coverage';
import { Dec, formatDec, timebaseSeconds, toDec, ZERO } from './decimal';

/** A sample as the integrator sees it: value null when unusable (quality or range). */
interface RatePoint {
  at: number;
  value: Dec | null;
  reason: 'bad_quality' | 'out_of_range' | null;
}

interface Piece {
  segment: QuantitySegment;
  amount: Dec;
  reason: RatePoint['reason'];
}

/**
 * Rate integration over `[from, to)` (ACT04, PI09, T25): `Σ value × Δt / timebaseSeconds`, step (a value
 * holds until the next sample) or linear (trapezoids between consecutive samples) by the signal's
 * interpolation. A piece between samples further apart than `maxGapSeconds` is missing; a piece whose
 * sample is bad (or, by the quality policy, uncertain) or outside the expected range — negative rates by
 * default — is excluded and reported. The method and the timebase conversion are part of the result.
 */
export function integrateRate(
  samples: EngineSample[],
  signal: EngineSignal,
  window: TimeWindow,
): QuantityResult {
  const method = rateMethod(signal);
  const refused = rateRefusal(signal, window);
  if (refused) return refusedResult(window, method, refused);
  const points = ratePoints(samples, signal);
  const timebase = timebaseSeconds(signal.rateTimebase as RateTimebase);
  const pieces = points
    .map((point, index) =>
      ratePiece(point, points[index + 1] ?? null, {
        signal,
        window,
        timebase,
      }),
    )
    .filter((piece): piece is Piece => piece !== null);
  const observed = pieces.filter((piece) => piece.segment.kind === 'integral');
  const exceptions = rateExceptions(pieces);
  if (observed.length === 0) exceptions.push({ code: 'no_data' });
  return resultOf({
    window,
    quantity:
      observed.length === 0
        ? null
        : observed.reduce((sum, piece) => sum.plus(piece.amount), ZERO),
    method,
    segments: pieces.map((piece) => piece.segment),
    exceptions,
  });
}

function rateMethod(signal: EngineSignal): QuantityMethod {
  const timebase = signal.rateTimebase ?? null;
  return {
    name: `rate_integration/${signal.interpolation}`,
    interpolation: signal.interpolation,
    timebase,
    timebaseSeconds: timebase ? timebaseSeconds(timebase) : null,
    uom: rateQuantityUnit(signal.canonicalUom, signal.rateTimebase).uom,
  };
}

function rateRefusal(
  signal: EngineSignal,
  window: TimeWindow,
): EngineException | null {
  const problem = windowProblem(window);
  if (problem) return problem;
  if (signal.semanticType !== 'rate') {
    return {
      code: 'wrong_semantic_type',
      detail: { expected: 'rate', actual: signal.semanticType },
    };
  }
  if (!rateQuantityUnit(signal.canonicalUom, signal.rateTimebase).matches)
    return {
      code: 'rate_uom_timebase_mismatch',
      detail: { uom: signal.canonicalUom, timebase: signal.rateTimebase },
    };
  if (signal.rateTimebase) return null;
  return {
    code: 'missing_timebase',
    detail: { reason: 'rate signals need rateTimebase (s, min, h, d)' },
  };
}

/** Every sample in time order with its usable value (quality policy and expected range applied). */
function ratePoints(
  samples: EngineSample[],
  signal: EngineSignal,
): RatePoint[] {
  const min = toDec(signal.expectedMin) ?? ZERO;
  const max = toDec(signal.expectedMax);
  return samples
    .map((sample): RatePoint => {
      const usable =
        sample.quality === 'good' ||
        (sample.quality === 'uncertain' && signal.acceptUncertain === true);
      const value = usable ? toDec(sample.value) : null;
      if (!value)
        return { at: sample.at.getTime(), value: null, reason: 'bad_quality' };
      const inRange = value.gte(min) && (max === null || value.lte(max));
      return inRange
        ? { at: sample.at.getTime(), value, reason: null }
        : { at: sample.at.getTime(), value: null, reason: 'out_of_range' };
    })
    .sort((a, b) => a.at - b.at);
}

/**
 * The piece from `point` to the next sample (or open-ended for the last one) clipped to the window;
 * null when it lies outside. Step uses the point's value; linear needs both ends usable.
 */
function ratePiece(
  point: RatePoint,
  next: RatePoint | null,
  context: { signal: EngineSignal; window: TimeWindow; timebase: number },
): Piece | null {
  const { signal, window } = context;
  const spanEnd = next ? next.at : Number.POSITIVE_INFINITY;
  const from = Math.max(point.at, window.from.getTime());
  const to = Math.min(spanEnd, window.to.getTime());
  if (from >= to) return null;
  const gap = (next ? next.at : to) - point.at > signal.maxGapSeconds * 1000;
  const linear = signal.interpolation === 'linear';
  const reason = point.reason ?? (linear && next ? next.reason : null);
  if (gap || (linear && !next)) return blank(from, to, 'gap', null);
  if (reason || !point.value) return blank(from, to, 'excluded', reason);
  const amount = linear
    ? trapezoid(point, next as RatePoint, { from, to })
    : point.value.mul(to - from).div(1000);
  return integral(from, to, amount.div(context.timebase));
}

/** Area under the line through two usable samples between `from` and `to` (value × seconds). */
function trapezoid(
  a: RatePoint,
  b: RatePoint,
  clip: { from: number; to: number },
): Dec {
  const at = (t: number): Dec =>
    (a.value as Dec).plus(
      (b.value as Dec)
        .minus(a.value as Dec)
        .mul(t - a.at)
        .div(b.at - a.at),
    );
  return at(clip.from)
    .plus(at(clip.to))
    .div(2)
    .mul(clip.to - clip.from)
    .div(1000);
}

function integral(from: number, to: number, amount: Dec): Piece {
  return {
    segment: {
      from: iso(from),
      to: iso(to),
      kind: 'integral',
      quantity: formatDec(amount),
      basis: 'measured',
    },
    amount,
    reason: null,
  };
}

function blank(
  from: number,
  to: number,
  kind: 'gap' | 'excluded',
  reason: RatePoint['reason'],
): Piece {
  return {
    segment: {
      from: iso(from),
      to: iso(to),
      kind,
      quantity: null,
      basis: null,
    },
    amount: ZERO,
    reason,
  };
}

/** One exception per excluded or missing piece (bad quality, out of range, gap). */
function rateExceptions(pieces: Piece[]): EngineException[] {
  return pieces
    .filter((piece) => piece.segment.kind !== 'integral')
    .map((piece) => ({
      code: piece.reason ?? ('gap' as const),
      from: piece.segment.from,
      to: piece.segment.to,
    }));
}
