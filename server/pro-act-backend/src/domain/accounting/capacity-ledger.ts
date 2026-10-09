import { Dec, ZERO } from '../actuals/decimal';
import {
  LedgerTotals,
  LossLineDraft,
  PeriodAccountingInput,
  Segment,
  SliceInput,
  ValidationIssue,
} from './accounting.types';
import { qualityClaims } from './claims';
import {
  allocate,
  capacityOver,
  contextOf,
  derateAvailability,
  emptyTotals,
  issue,
  ledgerClaims,
  maxZero,
  Production,
  productionOf,
  runningRateId,
  SliceContext,
  sliceLine,
  SliceLedgerResult,
  splitDerates,
  totalOf,
} from './ledger-common';
import { LineContext, timeLines } from './time-lines';

interface Part {
  lines: LossLineDraft[];
  issues: ValidationIssue[];
}

interface Running extends Part {
  performance: Dec | null;
  quality: Dec | null;
  gain: Dec;
}

interface TimeTotals {
  capacity: Dec;
  exclusion: Dec;
  availability: Dec;
}

/** Impossible production values (validation, never clamped). */
function productionIssues(
  production: Production,
  slice: SliceInput,
): ValidationIssue[] {
  const { gross, good } = production;
  if (gross === null || good === null) return [];
  const issues: ValidationIssue[] = [];
  if (gross.lt(ZERO))
    issues.push(issue('NEGATIVE_GROSS', 'gross is negative', slice));
  if (good.lt(ZERO)) {
    issues.push(
      issue('QUALITY_EXCEEDS_GROSS', 'quality loss exceeds gross', slice),
    );
  }
  if (good.gt(gross)) {
    issues.push(
      issue(
        'NEGATIVE_LOSS',
        'good exceeds gross: negative quality loss',
        slice,
      ),
    );
  }
  return issues;
}

/** Quality = gross − good, allocated to quality events; a claim beyond it fails validation. */
function qualityPart(
  ctx: SliceContext,
  production: Production,
): Part & { total: Dec | null } {
  const { gross, good } = production;
  const issues = productionIssues(production, ctx.slice);
  if (gross === null || good === null)
    return { lines: [], issues, total: null };
  const total = gross.minus(good);
  if (total.lt(ZERO)) return { lines: [], issues, total };
  const result = allocate(ctx, {
    kind: 'quality',
    total,
    claims: qualityClaims(ctx.input.events, ctx.slice.window),
    remainderRateId: null,
    remainderBasis: 'measured',
  });
  if (result.overClaim.gt(ZERO)) {
    const claimed = result.overClaim.toFixed();
    issues.push(
      issue(
        'IMPOSSIBLE_CLAIM',
        `quality events claim ${claimed} more than gross − good`,
        ctx.slice,
      ),
    );
  }
  return { lines: result.lines, issues, total };
}

/** Running time: performance = max(0, capacity − gross) allocated to micro-stops and derates; above → gain. */
function runningPart(
  ctx: SliceContext,
  effective: { capacity: Dec; claims: ReturnType<typeof splitDerates> },
): Running {
  const production = productionOf(ctx.slice);
  const quality = qualityPart(ctx, production);
  if (production.gross === null) {
    return {
      lines: [],
      issues: quality.issues,
      performance: null,
      quality: null,
      gain: ZERO,
    };
  }
  const performance = maxZero(effective.capacity.minus(production.gross));
  const gain = maxZero(production.gross.minus(effective.capacity));
  const result = allocate(ctx, {
    kind: 'performance',
    total: performance,
    claims: effective.claims.performance,
    remainderRateId: runningRateId(ctx.segments, 'sustained'),
    remainderBasis: 'sustained_rate',
  });
  const issues = [...quality.issues];
  if (result.overClaim.gt(ZERO)) {
    const claimed = result.overClaim.toFixed();
    issues.push(
      issue(
        'IMPOSSIBLE_CLAIM',
        `slowdowns and micro-stops claim ${claimed} more than the performance loss`,
        ctx.slice,
      ),
    );
  }
  const lines = [...result.lines, ...quality.lines];
  if (gain.gt(ZERO)) lines.push(sliceLine('gain', gain, ctx.slice, ctx.line));
  return { lines, issues, performance, quality: quality.total, gain };
}

function capacityTotals(
  slice: SliceInput,
  time: TimeTotals,
  running: Running,
): LedgerTotals {
  const production = productionOf(slice);
  const flags = [...production.flags];
  if (slice.concurrent) flags.push('concurrent_products');
  if (running.gain.gt(ZERO)) flags.push('above_reference');
  const good = production.good;
  const losses = time.exclusion
    .plus(time.availability)
    .plus(running.performance ?? ZERO)
    .plus(running.quality ?? ZERO);
  const residual =
    good === null
      ? null
      : time.capacity.minus(losses).minus(good).plus(running.gain);
  return {
    ...emptyTotals(slice, 'capacity', flags),
    capacity: time.capacity,
    exclusion: time.exclusion,
    availability: time.availability,
    performance: running.performance,
    quality: running.quality,
    good,
    gain: running.gain,
    attributed: losses,
    residual,
  };
}

/** No profile or no sustained rate over the whole slice: the capacity ledger cannot be computed. */
function unavailable(slice: SliceInput): SliceLedgerResult {
  const flag = slice.sustainedRates ? 'no_sustained_rate' : 'no_profile';
  return {
    lines: [],
    issues: [],
    totals: emptyTotals(slice, 'capacity', [flag]),
  };
}

/**
 * Capacity ledger of one slice (ACC01/ACC02): capacity at the sustained rate per segment, schedule
 * exclusion, availability from full stops (shares per occurrence), performance and quality computed
 * once and allocated to causes, gains above reference, and the signed residual
 * `capacity − exclusion − A − P − Q − good + gain`, never clamped.
 */
export function capacityLedger(
  input: PeriodAccountingInput,
  slice: SliceInput,
  segments: readonly Segment[],
): SliceLedgerResult {
  const capacity = slice.sustainedRates
    ? capacityOver(segments, 'sustained')
    : null;
  if (!capacity) return unavailable(slice);
  const line: LineContext = {
    ledger: 'capacity',
    sliceId: slice.sliceId,
    uom: slice.uom,
    basis: 'sustained',
  };
  const ctx = contextOf(input, slice, segments, line);
  const claims = ledgerClaims(ctx);
  const time = [
    ...timeLines(segments, line),
    ...derateAvailability(ctx, claims.availability),
  ];
  const timeTotals = {
    capacity,
    exclusion: totalOf(time, 'schedule_exclusion'),
    availability: totalOf(time, 'availability'),
  };
  const effective = capacity
    .minus(timeTotals.exclusion)
    .minus(timeTotals.availability);
  const running = runningPart(ctx, { capacity: effective, claims });
  const totals = capacityTotals(slice, timeTotals, running);
  const lines = [...time, ...running.lines];
  if (totals.residual)
    lines.push(sliceLine('residual', totals.residual, slice, line));
  return { lines, issues: running.issues, totals };
}
