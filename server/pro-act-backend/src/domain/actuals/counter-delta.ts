import {
  EngineException,
  EngineSample,
  EngineSignal,
  QuantityMethod,
  QuantityResult,
  QuantitySegment,
  TimeWindow,
} from './actuals.types';
import { iso, refusedResult, resultOf, windowProblem } from './coverage';
import { CounterPoint, counterPoints, usableReadings } from './counter-points';
import { Dec, formatDec, timebaseSeconds, toDec, ZERO } from './decimal';

/** Known instants at which the counter was reset (meter change, campaign start; `known_instant`). */
export interface CounterOptions {
  resets?: Date[];
}

type Step = { segment: QuantitySegment; exception?: EngineException };

/**
 * Counter / totaliser delta over `[from, to)` (ACT02, ACT03, PI09, T26, T27). The path runs from the
 * boundary value at `from` through every usable reading to the boundary value at `to`; each step adds
 * its non-negative delta. A drop is never production: with `known_instant` and a reset between two
 * readings within `maxGapSeconds` the step adds nothing; with `detect_drop` and a rollover modulus M it
 * adds `M − a + b` when the implied rate is credible (≤ `expectedMax` per `rateTimebase`); otherwise the
 * window is unresolved (`quantity = null`, `reset_unresolved` / `rate_implausible`). A step longer than
 * `maxGapSeconds` is a gap: missing coverage, its delta reported but not counted.
 */
export function counterDelta(
  samples: EngineSample[],
  signal: EngineSignal,
  window: TimeWindow,
  options: CounterOptions = {},
): QuantityResult {
  const method = counterMethod(signal);
  const refused = counterRefusal(signal, window);
  if (refused) return refusedResult(window, method, refused);
  const points = counterPoints(usableReadings(samples, signal), signal, window);
  const steps = points
    .slice(1)
    .map((point, index) => counterStep(points[index], point, signal, options));
  const segments = withMissingEdges(window, points, steps);
  const exceptions = steps.flatMap((step) =>
    step.exception ? [step.exception] : [],
  );
  if (points.length < 2) exceptions.push({ code: 'no_data' });
  const unresolved = steps.some((step) => step.segment.kind === 'unresolved');
  return resultOf({
    window,
    quantity: unresolved || points.length < 2 ? null : sumSteps(steps),
    method,
    segments,
    exceptions,
  });
}

function counterMethod(signal: EngineSignal): QuantityMethod {
  return {
    name: `counter_delta/${signal.interpolation}`,
    interpolation: signal.interpolation,
    timebase: signal.rateTimebase ?? null,
    uom: signal.canonicalUom ?? null,
  };
}

function counterRefusal(
  signal: EngineSignal,
  window: TimeWindow,
): EngineException | null {
  const problem = windowProblem(window);
  if (problem) return problem;
  if (signal.semanticType === 'counter') return null;
  return {
    code: 'wrong_semantic_type',
    detail: { expected: 'counter', actual: signal.semanticType },
  };
}

/** One step between consecutive points. */
function counterStep(
  a: CounterPoint,
  b: CounterPoint,
  signal: EngineSignal,
  options: CounterOptions,
): Step {
  const delta = b.value.minus(a.value);
  const basis: QuantitySegment['basis'] =
    a.estimated || b.estimated ? 'estimated' : 'measured';
  const gap = b.firstReading - a.lastReading > signal.maxGapSeconds * 1000;
  const piece = (
    kind: QuantitySegment['kind'],
    quantity: Dec | null,
  ): QuantitySegment => ({
    from: iso(a.at),
    to: iso(b.at),
    kind,
    quantity: quantity === null ? null : formatDec(quantity),
    basis: quantity === null ? null : basis,
  });
  if (delta.gte(0) && !gap) return { segment: piece('delta', delta) };
  if (delta.gte(0)) {
    return {
      segment: piece('gap', null),
      exception: gapException(a, b, delta),
    };
  }
  return dropStep(a, b, { signal, options, gap, piece });
}

/** A drop between two points: reset, rollover or unresolved. */
function dropStep(
  a: CounterPoint,
  b: CounterPoint,
  context: {
    signal: EngineSignal;
    options: CounterOptions;
    gap: boolean;
    piece: (kind: QuantitySegment['kind'], q: Dec | null) => QuantitySegment;
  },
): Step {
  const { signal, gap, piece } = context;
  const policy = signal.resetPolicy ?? 'none';
  if (policy === 'known_instant' && !gap) {
    const reset = (context.options.resets ?? []).find(
      (instant) => instant.getTime() > a.at && instant.getTime() <= b.at,
    );
    if (reset) return { segment: piece('reset', ZERO) };
  }
  const modulus = toDec(signal.rolloverModulus);
  if (policy === 'detect_drop' && modulus && !gap) {
    return rolloverStep(a, b, { signal, modulus, piece });
  }
  return {
    segment: piece('unresolved', null),
    exception: {
      code: 'reset_unresolved',
      from: iso(a.at),
      to: iso(b.at),
      detail: {
        before: formatDec(a.value),
        after: formatDec(b.value),
        resetPolicy: policy,
        reason: unresolvedReason(policy, Boolean(modulus), gap),
      },
    },
  };
}

/** `M − a + b` when both readings are below the modulus and the implied rate is credible (T26). */
function rolloverStep(
  a: CounterPoint,
  b: CounterPoint,
  context: {
    signal: EngineSignal;
    modulus: Dec;
    piece: (kind: QuantitySegment['kind'], q: Dec | null) => QuantitySegment;
  },
): Step {
  const { signal, modulus, piece } = context;
  const quantity = modulus.minus(a.value).plus(b.value);
  const rate = impliedRate(quantity, b.at - a.at, signal);
  const limit = toDec(signal.expectedMax);
  const outside = a.value.gte(modulus) || b.value.gte(modulus);
  if (!outside && (limit === null || rate.lte(limit))) {
    return { segment: piece('rollover', quantity) };
  }
  return {
    segment: piece('unresolved', null),
    exception: {
      code: outside ? 'reset_unresolved' : 'rate_implausible',
      from: iso(a.at),
      to: iso(b.at),
      detail: {
        before: formatDec(a.value),
        after: formatDec(b.value),
        modulus: formatDec(modulus),
        impliedRate: formatDec(rate),
        perTimebase: signal.rateTimebase ?? 's',
        expectedMax: limit === null ? null : formatDec(limit),
      },
    },
  };
}

/** Increase per `rateTimebase` (seconds when none is configured). */
export function impliedRate(
  quantity: Dec,
  spanMs: number,
  signal: EngineSignal,
): Dec {
  const seconds = timebaseSeconds(signal.rateTimebase ?? 's');
  return spanMs > 0 ? quantity.mul(seconds).mul(1000).div(spanMs) : quantity;
}

function unresolvedReason(
  policy: string,
  hasModulus: boolean,
  gap: boolean,
): string {
  if (gap) return 'drop across a gap longer than maxGapSeconds';
  if (policy === 'known_instant')
    return 'no known reset instant between the readings';
  if (policy === 'detect_drop' && !hasModulus) return 'no rollover modulus';
  return 'counter dropped and the reset policy does not allow resets';
}

function gapException(
  a: CounterPoint,
  b: CounterPoint,
  delta: Dec,
): EngineException {
  return {
    code: 'gap',
    from: iso(a.at),
    to: iso(b.at),
    detail: { uncountedDelta: formatDec(delta) },
  };
}

/** Steps plus missing pieces before the first and after the last point. */
function withMissingEdges(
  window: TimeWindow,
  points: CounterPoint[],
  steps: Step[],
): QuantitySegment[] {
  const segments = steps.map((step) => step.segment);
  const from = window.from.getTime();
  const to = window.to.getTime();
  if (points.length < 2) return [gapPiece(from, to)];
  const first = points[0].at;
  const last = points[points.length - 1].at;
  return [
    ...(first > from ? [gapPiece(from, first)] : []),
    ...segments,
    ...(last < to ? [gapPiece(last, to)] : []),
  ];
}

function gapPiece(from: number, to: number): QuantitySegment {
  return {
    from: iso(from),
    to: iso(to),
    kind: 'gap',
    quantity: null,
    basis: null,
  };
}

function sumSteps(steps: Step[]): Dec {
  return steps.reduce((sum, step) => {
    const quantity = step.segment.quantity;
    return quantity === null ? sum : sum.plus(quantity);
  }, ZERO);
}
