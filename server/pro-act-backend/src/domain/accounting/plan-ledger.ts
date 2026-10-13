import { Dec, toDec, ZERO } from '../actuals/decimal';
import {
  LedgerTotals,
  LossLineDraft,
  PeriodAccountingInput,
  Segment,
  SliceInput,
} from './accounting.types';
import { ClaimPool } from './claim-pooling';
import { qualityClaims, sumOf } from './claims';
import {
  allocate,
  capacityOver,
  contextOf,
  derateAvailability,
  emptyTotals,
  ledgerClaims,
  maxZero,
  productionOf,
  runningRateId,
  SliceContext,
  sliceLine,
  SliceLedgerResult,
  splitDerates,
  totalOf,
} from './ledger-common';
import { PlanTotals, planTotals } from './plan-totals';
import { LineContext, timeLines } from './time-lines';

interface Candidates {
  lines: LossLineDraft[];
  flags: string[];
}

const BRIDGE = 'bridge_required';
const PLANNED_RATE_SCALED = 'planned_rate_scaled';

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
 * profile. k = 1 when the plan was generated from the approved rates.
 */
function plannedSegments(
  segments: readonly Segment[],
  target: Dec,
): { segments: Segment[]; scaled: boolean } {
  const capacity = capacityOver(segments, 'planning');
  if (!capacity || capacity.lte(ZERO))
    return { segments: [...segments], scaled: false };
  const k = target.div(capacity);
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

/** Quality candidates: declared quantities (quality events) and the measured remainder of gross − good. */
function qualityCandidates(ctx: SliceContext): Candidates {
  const { gross, good } = productionOf(ctx.slice);
  if (gross === null || good === null || gross.lt(good))
    return { lines: [], flags: [] };
  const result = allocate(ctx, {
    kind: 'quality',
    total: gross.minus(good),
    claims: qualityClaims(ctx.input.events, ctx.slice.window),
    remainderRateId: null,
    remainderBasis: 'measured',
  });
  return {
    lines: result.lines,
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

function planLedgerTotals(
  slice: SliceInput,
  found: Candidates,
  plan: PlanTotals & { target: Dec },
): LedgerTotals {
  const production = productionOf(slice);
  const flags = new Set([...production.flags, ...found.flags, ...plan.flags]);
  if (plan.flags.includes('over_accounted') && found.lines.length > 0)
    flags.add(BRIDGE);
  return {
    ...emptyTotals(slice, 'plan', [...flags]),
    availability: totalOf(found.lines, 'availability'),
    performance: totalOf(found.lines, 'performance'),
    quality: totalOf(found.lines, 'quality'),
    gain: totalOf(found.lines, 'gain').neg(),
    good: production.good,
    target: plan.target,
    actual: production.good,
    gap: plan.gap,
    attributed: plan.attributed,
    residual: plan.residual,
    overproduction: plan.overproduction,
    overAccounted: plan.overAccounted,
  };
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
  const line: LineContext = {
    ledger: 'plan',
    sliceId: slice.sliceId,
    uom: slice.uom,
    basis: 'planning',
  };
  const timePhased = segments
    .filter((s) => !s.excluded)
    .every((s) => s.planning !== null);
  const planned = plannedSegments(
    segments.filter((s) => !s.excluded),
    target,
  );
  const ctx = contextOf(input, slice, planned.segments, line, pool);
  const found = timePhased
    ? candidates(ctx)
    : { lines: [], flags: ['plan_allocation_required'] };
  if (timePhased && planned.scaled) found.flags.push(PLANNED_RATE_SCALED);
  const attributed = sumOf(found.lines.map((l) => l.quantity));
  const plan = planTotals({
    target,
    actual: productionOf(slice).good,
    attributed,
    epsilon: ctx.epsilon,
  });
  const lines = [...found.lines];
  if (plan.residual)
    lines.push(sliceLine('residual', plan.residual, slice, line));
  const totals = planLedgerTotals(slice, found, { ...plan, target });
  return { lines, issues: [], totals };
}
