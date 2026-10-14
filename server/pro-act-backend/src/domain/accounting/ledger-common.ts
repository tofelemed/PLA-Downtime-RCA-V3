import { Dec, toDec, ZERO } from '../actuals/decimal';
import {
  Ledger,
  LedgerTotals,
  LossBasis,
  LossKind,
  LossLineDraft,
  PeriodAccountingInput,
  Segment,
  SliceInput,
  ValidationIssue,
} from './accounting.types';
import { autoKey } from './auto-key';
import { ClaimPool } from './claim-pooling';
import {
  Claim,
  measuredDerateClaims,
  qualityClaims,
  rateClaims,
  sumOf,
} from './claims';
import { ComponentResult, componentLines } from './component-lines';
import { LineContext, RateBasis, rateOf, segmentCapacity } from './time-lines';
import { transitionClaims, TransitionScope } from './transition-claims';

/** Everything a ledger computation of one slice needs. */
export interface SliceContext {
  input: PeriodAccountingInput;
  slice: SliceInput;
  segments: readonly Segment[];
  line: LineContext;
  epsilon: Dec;
  /** product-run claim pooling of the run (absent: own claims) */
  pool?: ClaimPool;
}

export interface AllocationSpec {
  kind: Extract<LossKind, 'performance' | 'quality' | 'availability'>;
  total: Dec;
  claims: Claim[];
  remainderRateId: string | null;
  remainderBasis: LossBasis;
}

export function contextOf(
  input: PeriodAccountingInput,
  slice: SliceInput,
  segments: readonly Segment[],
  line: LineContext,
  pool?: ClaimPool,
): SliceContext {
  return {
    input,
    slice,
    segments,
    line,
    epsilon: new Dec(input.policy.epsilon),
    pool,
  };
}

/** The grade transitions a slice prices (LA-08): the run's events and standards within the slice window. */
export function transitionScope(
  input: PeriodAccountingInput,
  slice: SliceInput,
): TransitionScope {
  return {
    events: input.events,
    window: slice.window,
    standards: input.transitionStandards ?? [],
    asOf: input.asOf,
  };
}

/** Grade-transition claims of the slice at the ledger's rate (LA-08). */
function transitionsOf(ctx: SliceContext): ReturnType<typeof transitionClaims> {
  const { input, slice, segments, line } = ctx;
  return transitionClaims(segments, line.basis, transitionScope(input, slice));
}

/**
 * Rate claims (micro-stops, derates) at the ledger's rate, measured slowdowns and the rate deficit of
 * grade transitions, split per policy (transitions always stay performance).
 */
export function ledgerClaims(ctx: SliceContext): {
  performance: Claim[];
  availability: Claim[];
} {
  const { input, slice, segments, line } = ctx;
  const split = splitDerates(
    [
      ...rateClaims(segments, line.basis),
      ...measuredDerateClaims(input.events, slice.window),
    ],
    input.policy.derateComponent,
  );
  return {
    performance: [...split.performance, ...transitionsOf(ctx).performance],
    availability: split.availability,
  };
}

/** Quality claims of the slice: declared quality events and the off-grade of grade transitions. */
export function ledgerQualityClaims(ctx: SliceContext): Claim[] {
  return [
    ...qualityClaims(ctx.input.events, ctx.slice.window),
    ...transitionsOf(ctx).quality,
  ];
}

/** The claims a component allocates: its own, or its part of the product run's pooled claims. */
function claimsOf(ctx: SliceContext, spec: AllocationSpec): Claim[] {
  if (!ctx.pool || spec.kind === 'availability') return spec.claims;
  const key = {
    ledger: ctx.line.ledger,
    kind: spec.kind,
    sliceId: ctx.slice.sliceId,
  };
  ctx.pool.record?.(key, spec.total, spec.claims);
  return ctx.pool.claimsFor?.(key) ?? spec.claims;
}

/** Component total allocated to its claims within the slice window (see `componentLines`). */
export function allocate(
  ctx: SliceContext,
  spec: AllocationSpec,
): ComponentResult {
  return componentLines(
    {
      ...spec,
      claims: claimsOf(ctx, spec),
      window: ctx.slice.window,
      epsilon: ctx.epsilon,
    },
    ctx.line,
  );
}

/** Derates charged to availability (policy `derateComponent = availability`): their claims as lines. */
export function derateAvailability(
  ctx: SliceContext,
  claims: Claim[],
): LossLineDraft[] {
  return allocate(ctx, {
    kind: 'availability',
    total: sumOf(claims.map((c) => c.quantity)),
    claims,
    remainderRateId: null,
    remainderBasis:
      ctx.line.basis === 'sustained' ? 'sustained_rate' : 'planning_rate',
  }).lines;
}

export function issue(
  code: string,
  message: string,
  slice: SliceInput,
): ValidationIssue {
  return { code, message, sliceId: slice.sliceId };
}

export interface SliceLedgerResult {
  lines: LossLineDraft[];
  totals: LedgerTotals;
  issues: ValidationIssue[];
}

/** Gross and good of the slice in its own unit; a unit mismatch makes both unknown (never converted). */
export interface Production {
  gross: Dec | null;
  good: Dec | null;
  flags: string[];
}

export function productionOf(slice: SliceInput): Production {
  const actuals = slice.actuals;
  if (!actuals) return { gross: null, good: null, flags: ['actuals_missing'] };
  if (actuals.uom && slice.uom && actuals.uom !== slice.uom) {
    return { gross: null, good: null, flags: ['uom_mismatch'] };
  }
  const gross = toDec(actuals.gross);
  const good = toDec(actuals.good);
  const flags =
    good === null
      ? ['actuals_missing']
      : gross === null
        ? ['gross_unknown']
        : [];
  return { gross, good, flags };
}

export function emptyTotals(
  slice: SliceInput,
  ledger: Ledger,
  flags: string[],
): LedgerTotals {
  return {
    sliceId: slice.sliceId,
    ledger,
    uom: slice.uom,
    capacity: null,
    exclusion: null,
    availability: null,
    performance: null,
    quality: null,
    good: null,
    gain: null,
    attributed: null,
    residual: null,
    target: null,
    actual: null,
    gap: null,
    overproduction: null,
    overAccounted: null,
    plannedTransition: null,
    flags,
  };
}

export function totalOf(lines: readonly LossLineDraft[], kind: LossKind): Dec {
  return sumOf(lines.filter((l) => l.kind === kind).map((l) => l.quantity));
}

/** Σ rate × seconds over segments at the basis; null when a segment has no rate of that kind. */
export function capacityOver(
  segments: readonly Segment[],
  basis: RateBasis,
): Dec | null {
  let total = ZERO;
  for (const segment of segments) {
    const capacity = segmentCapacity(segment, basis);
    if (!capacity) return null;
    total = total.plus(capacity);
  }
  return total;
}

/** The only rate version of running time at the basis, else null (several rates). */
export function runningRateId(
  segments: readonly Segment[],
  basis: RateBasis,
): string | null {
  const ids = new Set(
    segments
      .filter((s) => !s.excluded && s.stops.length === 0)
      .map((s) => rateOf(s, basis)?.id ?? null),
  );
  return ids.size === 1 ? [...ids][0] : null;
}

export function splitDerates(
  claims: readonly Claim[],
  derateComponent: 'performance' | 'availability',
): { performance: Claim[]; availability: Claim[] } {
  const isDerate = (c: Claim) => c.event.physicalType === 'slowdown';
  if (derateComponent === 'performance')
    return { performance: [...claims], availability: [] };
  return {
    performance: claims.filter((c) => !isDerate(c)),
    availability: claims.filter(isDerate),
  };
}

/** A signed line without cause: residual or gain of a slice. */
export function sliceLine(
  kind: Extract<LossKind, 'residual' | 'gain'>,
  quantity: Dec,
  slice: SliceInput,
  context: LineContext,
): LossLineDraft {
  return {
    ledger: context.ledger,
    kind,
    sliceId: slice.sliceId,
    segmentStart: slice.window.start,
    segmentEnd: slice.window.end,
    quantity,
    uom: slice.uom,
    basis: 'measured',
    rateVersionId: null,
    cause: null,
    scheduleClass: null,
    oeeComponent: null,
    flags: kind === 'gain' ? ['above_reference'] : [],
    evidence: [],
    autoKey: autoKey(
      { ledger: context.ledger, kind: kind, sliceId: slice.sliceId },
      slice.window.start,
      null,
    ),
  };
}

export function maxZero(value: Dec): Dec {
  return value.gt(ZERO) ? value : ZERO;
}
