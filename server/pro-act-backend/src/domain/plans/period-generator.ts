import { Dec, formatDec, toDec } from '../actuals/decimal';
import {
  GeneratedPeriod,
  GenerationInput,
  GenerationResult,
  PlanLeaf,
  PlanWarning,
  SliceStream,
  UomTotal,
} from './plan.types';
import {
  assertFeasibleMix,
  Assignment,
  assignLeaves,
  validateSlices,
} from './slice-assignment';
import { MeasuredPair, roundQty, targetsFor } from './target-rules';

/**
 * Plan period generation (plan 2.3, PLAN02/PLAN03, D14): leaves are the unit's shift instances in the
 * plan window; each slice active on a leaf gets its scheduled seconds (excluded instances → 0), planning
 * and sustained capacity (scheduled seconds × rate per second, × recipe share for shared streams) and a
 * target by basis and distribution. Targets of a group add up to its target exactly (remainder on the
 * last eligible leaf). Pure: rates are looked up through `input.ratesAt`.
 */
export function generatePeriods(input: GenerationInput): GenerationResult {
  const warnings: PlanWarning[] = [];
  const stream = validateSlices(input.slices, input.concurrentProductsEnabled);
  leafWarnings(input, warnings);
  const assignments = assignLeaves(input.slices, input.leaves, warnings);
  const pairs = assignments.map((a) => measure(a, input, stream, warnings));
  if (stream === 'shared') {
    assertFeasibleMix(
      pairs
        .filter((pair) => pair.scheduledSeconds > 0)
        .map((pair) => ({
          leafStart: pair.leafStart,
          sliceKey: pair.slice.key,
          share: toDec(pair.rates.recipeShare),
        })),
    );
  }
  const targets = targetsFor(input, pairs);
  const periods = pairs.map((pair, i) =>
    toPeriod(pair, assignments[i].leaf, targets[i]),
  );
  const totals = totalsOf(periods);
  return {
    periods,
    headerTarget: headerOf(totals),
    totals,
    warnings,
  };
}

/** Elapsed seconds of a leaf that count as scheduled (0 for an excluded instance). */
export function scheduledSecondsOf(leaf: PlanLeaf): number {
  if (leaf.isExcluded) return 0;
  return Math.round((leaf.end.getTime() - leaf.start.getTime()) / 1000);
}

function measure(
  assignment: Assignment,
  input: GenerationInput,
  stream: SliceStream,
  warnings: PlanWarning[],
): MeasuredPair {
  const { slice, leaf } = assignment;
  const rates = input.ratesAt(slice, leaf);
  const scheduledSeconds = scheduledSecondsOf(leaf);
  const share = stream === 'shared' ? toDec(rates.recipeShare) : new Dec(1);
  const effective = new Dec(scheduledSeconds).mul(share ?? 0);
  if (scheduledSeconds > 0) rateWarnings(rates, leaf, slice.key, warnings);
  const capacity = (rate: { perSecond: string } | null) =>
    rate ? roundQty(effective.mul(rate.perSecond)) : null;
  return {
    slice,
    leafStart: leaf.start,
    scheduledSeconds,
    planningCapacity: capacity(rates.planning),
    sustainedCapacity: capacity(rates.sustained),
    rates,
  };
}

function rateWarnings(
  rates: GeneratedPeriod['rates'],
  leaf: PlanLeaf,
  sliceKey: string,
  warnings: PlanWarning[],
): void {
  const at = leaf.start.toISOString();
  if (!rates.profileId) {
    warnings.push({ code: 'missing_profile', at, sliceKey });
    return;
  }
  if (!rates.planning) {
    warnings.push({ code: 'missing_planning_rate', at, sliceKey });
  }
  if (!rates.sustained) {
    warnings.push({ code: 'missing_sustained_rate', at, sliceKey });
  }
  if (rates.rateChangesInside) {
    warnings.push({ code: 'rate_change_inside_leaf', at, sliceKey });
  }
}

/** Leaf-level notes (§3.3): exclusions, DST, clipping at the plan window and uncovered window time. */
function leafWarnings(input: GenerationInput, warnings: PlanWarning[]): void {
  let covered = 0;
  for (const leaf of input.leaves) {
    const at = leaf.start.toISOString();
    covered += leaf.end.getTime() - leaf.start.getTime();
    if (leaf.isExcluded) {
      warnings.push({
        code: 'excluded_leaf',
        at,
        detail: leaf.exclusionKind ?? undefined,
      });
    }
    if (leaf.offsetChanges) warnings.push({ code: 'dst_leaf', at });
    if (leaf.clipped) warnings.push({ code: 'clipped_leaf', at });
  }
  const windowMs = input.window.end.getTime() - input.window.start.getTime();
  const uncovered = Math.round((windowMs - covered) / 1000);
  if (uncovered > 0) {
    warnings.push({
      code: 'unscheduled_time',
      detail: `${uncovered} s of the plan window lie in no shift instance`,
    });
  }
}

function toPeriod(
  pair: MeasuredPair,
  leaf: PlanLeaf,
  target: Dec,
): GeneratedPeriod {
  const format = (value: Dec | null) => (value ? formatDec(value) : null);
  return {
    sliceKey: pair.slice.key,
    productId: pair.slice.productId,
    leaf,
    scheduledSeconds: pair.scheduledSeconds,
    target: formatDec(target),
    planningCapacity: format(pair.planningCapacity),
    sustainedCapacity: format(pair.sustainedCapacity),
    rates: pair.rates,
  };
}

/**
 * Σ target per quantity unit (unlike units are reported separately, never added). A slice's unit is the
 * first one its profiles give, so leaves without a profile (target 0) do not split its total.
 */
export function totalsOf(periods: readonly GeneratedPeriod[]): UomTotal[] {
  const sliceUom = new Map<string, string | null>();
  for (const period of periods) {
    if (!sliceUom.get(period.sliceKey)) {
      sliceUom.set(period.sliceKey, period.rates.quantityUom);
    }
  }
  const sums = new Map<string | null, Dec>();
  for (const period of periods) {
    const uom = sliceUom.get(period.sliceKey) ?? null;
    sums.set(uom, (sums.get(uom) ?? new Dec(0)).plus(period.target));
  }
  return [...sums.entries()].map(([quantityUom, target]) => ({
    quantityUom,
    target: formatDec(target),
  }));
}

function headerOf(totals: readonly UomTotal[]): string | null {
  if (totals.length === 0) return '0';
  return totals.length === 1 ? totals[0].target : null;
}
