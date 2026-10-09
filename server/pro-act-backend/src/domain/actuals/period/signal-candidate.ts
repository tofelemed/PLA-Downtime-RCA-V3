import {
  EngineException,
  QuantityResult,
  QuantitySegment,
} from '../actuals.types';
import { Dec, toDec, ZERO } from '../decimal';
import {
  ActualsSource,
  PeriodFinding,
  SourceCandidate,
  SourceSegment,
} from './period-actuals.types';

const OBSERVED: ReadonlySet<QuantitySegment['kind']> = new Set([
  'delta',
  'reset',
  'rollover',
  'integral',
]);

/** Engine exceptions that are informational for the period (they do not lower the quality state). */
const INFO_CODES: ReadonlySet<string> = new Set(['spanning_event']);

/**
 * A counter or rate signal's engine result (plan 1.7: `counterDelta` / `integrateRate`) as a period
 * source: the quantity is gross, rejects are unknown (a totaliser or rate measures throughput only),
 * measured / estimated quantities come from the segment bases (an estimated end was interpolated at the
 * period boundary), coverage from the observed segments; every engine exception is a problem finding.
 */
export function signalCandidate(
  source: ActualsSource,
  signalId: string,
  result: QuantityResult,
): SourceCandidate {
  const observedSegments = result.segments.filter((s) => OBSERVED.has(s.kind));
  const sum = (basis: 'measured' | 'estimated'): Dec =>
    observedSegments
      .filter((segment) => (segment.basis ?? 'measured') === basis)
      .reduce(
        (total, segment) => total.plus(toDec(segment.quantity) ?? ZERO),
        ZERO,
      );
  return {
    source,
    method: result.method.name.startsWith('counter_delta')
      ? 'counter_delta'
      : 'rate_integration',
    label: `signal:${signalId}`,
    basis: 'gross',
    quantity: toDec(result.quantity),
    reject: null,
    measured: sum('measured'),
    estimated: sum('estimated'),
    uom: result.method.uom,
    // readings exist in the window (counted, excluded or unresolved); gaps alone mean no data
    available: result.segments.some((s) => s.kind !== 'gap'),
    observed: observedSegments.map((segment) => ({
      start: new Date(segment.from),
      end: new Date(segment.to),
    })),
    segments: result.segments.map((segment) =>
      segmentOf(signalId, result.method.name, segment),
    ),
    findings: result.exceptions.map(findingOf),
  };
}

function segmentOf(
  signalId: string,
  method: string,
  segment: QuantitySegment,
): SourceSegment {
  return {
    source: `signal:${signalId}`,
    from: segment.from,
    to: segment.to,
    quantity: segment.quantity,
    method: `${method}:${segment.kind}`,
    quality: qualityOf(segment),
  };
}

function qualityOf(segment: QuantitySegment): SourceSegment['quality'] {
  if (OBSERVED.has(segment.kind)) return segment.basis ?? 'measured';
  if (segment.kind === 'gap') return 'missing';
  return 'excluded';
}

function findingOf(exception: EngineException): PeriodFinding {
  return {
    code: exception.code,
    severity: INFO_CODES.has(exception.code) ? 'info' : 'problem',
    from: exception.from,
    to: exception.to,
    detail: exception.detail,
  };
}
