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

/** Performance at the planning rate (only a positive gap to plan rate is a candidate; no plan gains). */
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
  return {
    lines: result.lines,
    flags: result.overClaim.gt(ZERO) ? [BRIDGE] : [],
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
 * Plan ledger of one slice (ACC01/ACC04): target from the plan period, actual = good, gap, automatic
 * candidates at the time-phased planning rate, attributed = Σ active lines and the signed residual.
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
  const scheduled = segments.filter((s) => !s.excluded);
  const ctx = contextOf(input, slice, scheduled, line, pool);
  const timePhased = scheduled.every((s) => s.planning !== null);
  const found = timePhased
    ? candidates(ctx)
    : { lines: [], flags: ['plan_allocation_required'] };
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
