import { Dec, toDec, ZERO } from '../actuals/decimal';
import {
  LedgerTotals,
  LossLineDraft,
  PeriodAccountingInput,
  Segment,
  SliceInput,
} from './accounting.types';
import { withAppliedRates } from './applied-rate';
import { ClaimPool } from './claim-pooling';
import { sumOf } from './claims';
import {
  allocate,
  capacityOver,
  contextOf,
  derateAvailability,
  emptyTotals,
  ledgerClaims,
  ledgerQualityClaims,
  maxZero,
  productionOf,
  runningRateId,
  SliceContext,
  sliceLine,
  SliceLedgerResult,
  splitDerates,
  totalOf,
  transitionScope,
} from './ledger-common';
import { PlanTotals, planTotals } from './plan-totals';
import { classifiedQualityLines } from './quality-class-lines';
import { LineContext, timeLines } from './time-lines';
import { standardTransitionCapacity } from './transition-claims';
import { componentTotal } from './transition-lines';

interface Candidates {
  lines: LossLineDraft[];
  flags: string[];
}

const BRIDGE = 'bridge_required';
const PLANNED_RATE_SCALED = 'planned_rate_scaled';
/** the plan target already allows for the transitions' standard time (`transitionAllowanceInPlan = planned`) */
export const TRANSITION_ALLOWANCE_PLANNED = 'transition_allowance_planned';

/**
 * Performance against the planned running rate: claimed slowdowns (micro-stops, derates, measured
 * slowdowns) are candidates; the shortfall no claim explains is not attributed — it stays in the residual
 * as unaccounted until someone explains it (SME Q4). Output above the planned running rate is a recovery
 * gain kept as its own signed line (SME Q2: losses stay gross, gains separate, net in totals).
 */
function performanceCandidates(
  ctx: SliceContext,
  running: { capacity: Dec; claims: ReturnType<typeof splitDerates> },
): Candidates {
  const { gross } = productionOf(ctx.slice);
  if (gross === null) return { lines: [], flags: [] };
  const result = allocate(ctx, {
    kind: 'performance',
    total: maxZero(running.capacity.minus(gross)),
    claims: running.claims.performance,
    remainderRateId: runningRateId(ctx.segments, 'planning'),
    remainderBasis: 'planning_rate',
  });
  const claimed = result.lines.filter((line) => line.cause !== null);
  const gain = maxZero(gross.minus(running.capacity));
  const lines = gain.gt(ctx.epsilon)
    ? [...claimed, sliceLine('gain', gain.neg(), ctx.slice, ctx.line)]
    : claimed;
  return {
    lines,
    flags: result.overClaim.gt(ZERO) ? [BRIDGE] : [],
  };
}

/**
 * The planned rate of each segment (SME Q1): the planning rate scaled so that the eligible time of the
 * slice produces exactly its target — target ÷ eligible planned time, keeping the planning rate's time
 * profile. k = 1 when the plan was generated from the approved rates. `deducted` is the standard
 * transition time (at the planning rate) a plan that schedules grade changes left out of its target;
 * that time is not eligible.
 */
function plannedSegments(
  segments: readonly Segment[],
  target: Dec,
  deducted: Dec,
): { segments: Segment[]; scaled: boolean } {
  const capacity = capacityOver(segments, 'planning');
  const eligible = capacity?.minus(deducted);
  if (!eligible || eligible.lte(ZERO))
    return { segments: [...segments], scaled: false };
  const k = target.div(eligible);
  if (k.eq(1)) return { segments: [...segments], scaled: false };
  return {
    scaled: true,
    segments: segments.map((segment) =>
      segment.planning
        ? {
            ...segment,
            planning: {
              ...segment.planning,
              rate: new Dec(segment.planning.rate).mul(k).toFixed(),
            },
          }
        : segment,
    ),
  };
}

/**
 * Quality candidates: declared quantities (quality events) and the measured remainder of gross − good,
 * split by the slice's disposition classes (SME E3).
 */
function qualityCandidates(ctx: SliceContext): Candidates {
  const { gross, good } = productionOf(ctx.slice);
  if (gross === null || good === null || gross.lt(good))
    return { lines: [], flags: [] };
  const result = allocate(ctx, {
    kind: 'quality',
    total: gross.minus(good),
    claims: ledgerQualityClaims(ctx),
    remainderRateId: null,
    remainderBasis: 'measured',
  });
  return {
    lines: classifiedQualityLines(
      result.lines,
      ctx.slice.actuals?.classes,
      ctx.epsilon,
    ),
    flags: result.overClaim.gt(ZERO) ? [BRIDGE] : [],
  };
}

/** Auto candidate lines mirroring the capacity A/P/Q lines, re-based with the planning rate (ACC04). */
function candidates(ctx: SliceContext): Candidates {
  const { segments } = ctx;
  const claims = ledgerClaims(ctx);
  const stops = [
    ...timeLines(segments, ctx.line),
    ...derateAvailability(ctx, claims.availability),
  ];
  const capacity = (capacityOver(segments, 'planning') ?? ZERO).minus(
    totalOf(stops, 'availability'),
  );
  const performance = performanceCandidates(ctx, { capacity, claims });
  const quality = qualityCandidates(ctx);
  return {
    lines: [...stops, ...performance.lines, ...quality.lines],
    flags: [...performance.flags, ...quality.flags],
  };
}

/**
 * `transitionAllowanceInPlan = planned` (ISO 22400 / GE PLA): the plan target already allows for the
 * transitions' standard time, so their allowance lines leave the plan ledger (only the overrun explains
 * the gap); their sum is reported as planned transition time.
 */
function withoutAllowance(found: Candidates): Candidates & { planned: Dec } {
  const allowance = found.lines.filter(
    (l) => l.kind === 'transition_allowance',
  );
  return {
    lines: found.lines.filter((l) => l.kind !== 'transition_allowance'),
    flags:
      allowance.length > 0
        ? [...found.flags, TRANSITION_ALLOWANCE_PLANNED]
        : found.flags,
    planned: sumOf(allowance.map((l) => l.quantity)),
  };
}

function planLedgerTotals(
  slice: SliceInput,
  found: Candidates & { planned: Dec | null },
  plan: PlanTotals & { target: Dec },
): LedgerTotals {
  const production = productionOf(slice);
  const flags = new Set([...production.flags, ...found.flags, ...plan.flags]);
  if (plan.flags.includes('over_accounted') && found.lines.length > 0)
    flags.add(BRIDGE);
  return {
    ...emptyTotals(slice, 'plan', [...flags]),
    availability: componentTotal(found.lines, 'availability'),
    performance: componentTotal(found.lines, 'performance'),
    quality: componentTotal(found.lines, 'quality'),
    gain: totalOf(found.lines, 'gain').neg(),
    good: production.good,
    target: plan.target,
    actual: production.good,
    gap: plan.gap,
    attributed: plan.attributed,
    residual: plan.residual,
    overproduction: plan.overproduction,
    overAccounted: plan.overAccounted,
    plannedTransition: found.planned,
  };
}

const PLAN_LINE = (slice: SliceInput): LineContext => ({
  ledger: 'plan',
  sliceId: slice.sliceId,
  uom: slice.uom,
  basis: 'planning',
});

/**
 * The plan ledger's candidate lines of a slice (time-phased plans only) at the planned rate; with
 * `transitionAllowanceInPlan = planned` the standard transition time is not eligible plan time and the
 * allowance lines are reported, not attributed. `ctx.segments` are the slice's segments, unscaled.
 */
function planCandidates(
  ctx: SliceContext,
  target: Dec,
): Candidates & { planned: Dec | null } {
  const eligible = ctx.segments.filter((s) => !s.excluded);
  const allowanceInPlan = ctx.input.policy.transitionAllowanceInPlan ?? 'loss';
  if (!eligible.every((s) => s.planning !== null))
    return { lines: [], flags: ['plan_allocation_required'], planned: null };
  const deducted =
    allowanceInPlan === 'planned'
      ? standardTransitionCapacity(
          eligible,
          'planning',
          transitionScope(ctx.input, ctx.slice),
        )
      : ZERO;
  const planned = plannedSegments(eligible, target, deducted);
  const found = candidates({ ...ctx, segments: planned.segments });
  found.lines = withAppliedRates(found.lines, planned.segments, 'planning');
  if (planned.scaled) found.flags.push(PLANNED_RATE_SCALED);
  return allowanceInPlan === 'planned'
    ? withoutAllowance(found)
    : { ...found, planned: null };
}

/**
 * Plan ledger of one slice (ACC01/ACC04, SME Q1/Q2): target from the plan period, actual = good, gap,
 * automatic candidates at the planned rate (planning rate scaled to the target, flagged
 * `planned_rate_scaled` when k ≠ 1), recovery above the planned running rate as a signed gain line,
 * attributed = Σ active lines and the signed residual.
 * Without a planning rate over the scheduled time there are no automatic time lines: residual = gap and
 * `plan_allocation_required` (never distributed by the final gap). Candidates beyond the gap are kept
 * as they are and flagged `bridge_required` (T28: no forced allocation).
 */
export function planLedger(
  input: PeriodAccountingInput,
  slice: SliceInput,
  segments: readonly Segment[],
  pool?: ClaimPool,
): SliceLedgerResult {
  const target = toDec(slice.target);
  if (target === null) {
    return {
      lines: [],
      issues: [],
      totals: emptyTotals(slice, 'plan', ['no_plan_target']),
    };
  }
  const ctx = contextOf(input, slice, segments, PLAN_LINE(slice), pool);
  const found = planCandidates(ctx, target);
  const attributed = sumOf(found.lines.map((l) => l.quantity));
  const plan = planTotals({
    target,
    actual: productionOf(slice).good,
    attributed,
    epsilon: ctx.epsilon,
  });
  const lines = [...found.lines];
  if (plan.residual)
    lines.push(sliceLine('residual', plan.residual, slice, ctx.line));
  const totals = planLedgerTotals(slice, found, { ...plan, target });
  return { lines, issues: [], totals };
}
