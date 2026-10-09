import { Dec } from '../actuals/decimal';
import {
  GenerationInput,
  LeafRates,
  PlanGenerationError,
  SliceInput,
} from './plan.types';
import { distribute, parseTarget } from './target-distribution';

/** One (slice, leaf) pair with its scheduled time and capacities, before targets are set. */
export interface MeasuredPair {
  slice: SliceInput;
  leafStart: Date;
  scheduledSeconds: number;
  planningCapacity: Dec | null;
  sustainedCapacity: Dec | null;
  rates: LeafRates;
}

function fail(code: string, message: string): never {
  throw new PlanGenerationError(code, message);
}

/**
 * Targets of each pair by basis (PLAN02/PLAN03): `time` = planning capacity of the leaf; `quantity` =
 * a header target (or each slice's own target) distributed by the version's distribution; `manual` =
 * entered per-leaf targets, checked against the header.
 */
export function targetsFor(
  input: GenerationInput,
  pairs: readonly MeasuredPair[],
): Dec[] {
  if (input.basis === 'time') {
    return pairs.map((pair) => roundQty(pair.planningCapacity ?? new Dec(0)));
  }
  if (input.basis === 'manual') return manualTargets(input, pairs);
  if (input.headerTarget !== null) {
    assertSingleUom(pairs);
    const total = parseTarget(input.headerTarget, 'headerTarget');
    return distribute(total, headerWeights(input, pairs));
  }
  return perSliceTargets(input, pairs);
}

/** Quantity at the stored scale (half-even, as every other quantity). */
export function roundQty(value: Dec): Dec {
  return value.toDecimalPlaces(8);
}

function eligible(pair: MeasuredPair): boolean {
  return pair.scheduledSeconds > 0;
}

/** Distribution weights of one group of pairs (one slice, or every slice under a header target). */
function weightsOf(
  distribution: GenerationInput['distribution'],
  pairs: readonly MeasuredPair[],
): Dec[] {
  if (distribution === 'equal') {
    return pairs.map((pair) => new Dec(eligible(pair) ? 1 : 0));
  }
  return pairs.map((pair) =>
    eligible(pair) ? (pair.planningCapacity ?? new Dec(0)) : new Dec(0),
  );
}

/**
 * Header-target weights: `scheduled_capacity` (default) and `equal` over every pair; `explicit_weights`
 * splits the header between slices by their weights and within a slice by planning capacity.
 */
function headerWeights(
  input: GenerationInput,
  pairs: readonly MeasuredPair[],
): Dec[] {
  if (input.distribution !== 'explicit_weights') {
    return weightsOf(input.distribution, pairs);
  }
  const capacityBySlice = new Map<string, Dec>();
  for (const pair of pairs) {
    const weight = weightsOf('scheduled_capacity', [pair])[0];
    const sum = capacityBySlice.get(pair.slice.key) ?? new Dec(0);
    capacityBySlice.set(pair.slice.key, sum.plus(weight));
  }
  return pairs.map((pair) => {
    const sliceWeight = explicitWeight(pair.slice);
    const sliceCapacity = capacityBySlice.get(pair.slice.key) ?? new Dec(0);
    if (sliceWeight.gt(0) && !sliceCapacity.gt(0)) {
      fail(
        'NO_ELIGIBLE_TIME',
        `slice ${pair.slice.key} has a weight but no eligible planning capacity`,
      );
    }
    if (!sliceCapacity.gt(0)) return new Dec(0);
    const capacity = weightsOf('scheduled_capacity', [pair])[0];
    return sliceWeight.mul(capacity).div(sliceCapacity);
  });
}

function explicitWeight(slice: SliceInput): Dec {
  if (slice.weight === null) {
    fail('WEIGHTS_REQUIRED', 'explicit_weights needs a weight on every slice');
  }
  return parseTarget(slice.weight, 'weight');
}

function perSliceTargets(
  input: GenerationInput,
  pairs: readonly MeasuredPair[],
): Dec[] {
  if (input.distribution === 'explicit_weights') {
    fail(
      'INVALID_DISTRIBUTION',
      'explicit_weights splits a header target between slices; send headerTarget',
    );
  }
  const result = pairs.map(() => new Dec(0));
  for (const slice of input.slices) {
    if (slice.target === null) {
      fail(
        'TARGET_REQUIRED',
        'a quantity plan needs a headerTarget or a target on every slice',
      );
    }
    const indexes = pairs.flatMap((pair, i) =>
      pair.slice.key === slice.key ? [i] : [],
    );
    const shares = distribute(
      parseTarget(slice.target, 'slice target'),
      weightsOf(
        input.distribution,
        indexes.map((i) => pairs[i]),
      ),
    );
    indexes.forEach((pairIndex, j) => (result[pairIndex] = shares[j]));
  }
  return result;
}

function manualTargets(
  input: GenerationInput,
  pairs: readonly MeasuredPair[],
): Dec[] {
  const index = new Map<string, number>();
  pairs.forEach((pair, i) =>
    index.set(`${pair.slice.key}@${pair.leafStart.getTime()}`, i),
  );
  const result = pairs.map(() => new Dec(0));
  for (const entry of input.manualTargets) {
    const i = index.get(`${entry.sliceKey}@${entry.utcStart.getTime()}`);
    if (i === undefined) {
      fail(
        'UNKNOWN_LEAF',
        `no leaf of slice ${entry.sliceKey} starts at ${entry.utcStart.toISOString()}`,
      );
    }
    const target = parseTarget(entry.target, 'manual target');
    if (target.gt(0) && !eligible(pairs[i])) {
      fail(
        'NO_ELIGIBLE_TIME',
        `the leaf at ${entry.utcStart.toISOString()} has no scheduled time`,
      );
    }
    result[i] = result[i].plus(target);
  }
  assertManualSum(input.headerTarget, result);
  return result;
}

function assertManualSum(header: string | null, targets: readonly Dec[]): void {
  if (header === null) return;
  const sum = targets.reduce((acc, value) => acc.plus(value), new Dec(0));
  if (!sum.equals(parseTarget(header, 'headerTarget'))) {
    fail(
      'TARGET_SUM_MISMATCH',
      `the entered targets add up to ${sum.toFixed()}, not the header target ${header}`,
    );
  }
}

/** A header target is one quantity: slices in different units cannot share it (PLAN05). */
function assertSingleUom(pairs: readonly MeasuredPair[]): void {
  const units = new Set(
    pairs
      .map((pair) => pair.rates.quantityUom)
      .filter((uom): uom is string => uom !== null),
  );
  if (units.size > 1) {
    fail(
      'MIXED_UOM',
      'slices in different quantity units need their own targets, not one header target',
    );
  }
}
