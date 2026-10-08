import {
  Coverage,
  EngineException,
  QuantityMethod,
  QuantityResult,
  QuantitySegment,
  TimeWindow,
} from './actuals.types';
import { Dec, formatDec } from './decimal';

const OBSERVED: ReadonlySet<QuantitySegment['kind']> = new Set([
  'delta',
  'reset',
  'rollover',
  'integral',
]);

/**
 * Coverage of a window from its segments (ACT05 inputs): observed = segments that contributed a known
 * quantity, split into measured and estimated by basis; excluded = bad quality, out of range or
 * unresolved; everything else (gaps, before the first and after the last usable reading) is missing.
 */
export function coverageOf(
  window: TimeWindow,
  segments: QuantitySegment[],
): Coverage {
  const windowMs = window.to.getTime() - window.from.getTime();
  let measured = 0;
  let estimated = 0;
  let excluded = 0;
  for (const segment of segments) {
    const span = Date.parse(segment.to) - Date.parse(segment.from);
    if (OBSERVED.has(segment.kind)) {
      if (segment.basis === 'estimated') estimated += span;
      else measured += span;
    } else if (segment.kind === 'excluded' || segment.kind === 'unresolved') {
      excluded += span;
    }
  }
  const observed = measured + estimated;
  return {
    windowSeconds: windowMs / 1000,
    observedSeconds: observed / 1000,
    measuredSeconds: measured / 1000,
    estimatedSeconds: estimated / 1000,
    missingSeconds: Math.max(0, windowMs - observed - excluded) / 1000,
    excludedSeconds: excluded / 1000,
    ratio: windowMs > 0 ? formatDec(new Dec(observed).div(windowMs)) : '0',
  };
}

/** Assembles a result; the quality state is complete only with a quantity, full coverage and no exception. */
export function resultOf(input: {
  window: TimeWindow;
  quantity: Dec | null;
  method: QuantityMethod;
  segments: QuantitySegment[];
  exceptions: EngineException[];
}): QuantityResult {
  const coverage = coverageOf(input.window, input.segments);
  const complete =
    input.quantity !== null &&
    coverage.ratio === '1' &&
    input.exceptions.length === 0;
  return {
    quantity: input.quantity === null ? null : formatDec(input.quantity),
    method: input.method,
    qualityState: complete ? 'complete' : 'incomplete',
    segments: input.segments,
    exceptions: input.exceptions,
    coverage,
  };
}

/** A window the engine refuses before looking at samples (configuration or window error). */
export function refusedResult(
  window: TimeWindow,
  method: QuantityMethod,
  exception: EngineException,
): QuantityResult {
  return resultOf({
    window,
    quantity: null,
    method,
    segments: [],
    exceptions: [exception],
  });
}

/** `invalid_window` when the window is empty, reversed or not a pair of valid instants. */
export function windowProblem(window: TimeWindow): EngineException | null {
  const from = window.from.getTime();
  const to = window.to.getTime();
  if (Number.isFinite(from) && Number.isFinite(to) && from < to) return null;
  return {
    code: 'invalid_window',
    detail: { reason: 'from must be before to' },
  };
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
