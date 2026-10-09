import { Dec } from '../actuals/decimal';
import {
  PlanGenerationError,
  PlanLeaf,
  PlanWarning,
  SliceInput,
  SliceStream,
} from './plan.types';

/** A slice active on a leaf. */
export interface Assignment {
  slice: SliceInput;
  leaf: PlanLeaf;
}

function fail(code: string, message: string): never {
  throw new PlanGenerationError(code, message);
}

const startMs = (slice: SliceInput) =>
  slice.campaignFrom ? slice.campaignFrom.getTime() : -Infinity;
const endMs = (slice: SliceInput) =>
  slice.campaignTo ? slice.campaignTo.getTime() : Infinity;

/**
 * PLAN05 / D14 rules on the slices of one version: one stream kind per version; `independent` and
 * `shared` streams need the `CONCURRENT_PRODUCTS` flag; sequential campaigns never overlap (422
 * `CAMPAIGN_OVERLAP`); a product appears once per concurrent version. Returns the stream kind.
 */
export function validateSlices(
  slices: readonly SliceInput[],
  concurrentProductsEnabled: boolean,
): SliceStream {
  if (slices.length === 0)
    fail('NO_SLICES', 'a plan version needs a product slice');
  const streams = new Set(slices.map((slice) => slice.stream));
  if (streams.size > 1) {
    fail('MIXED_STREAMS', 'all slices of a version use the same stream kind');
  }
  const stream = slices[0].stream;
  for (const slice of slices) {
    if (endMs(slice) <= startMs(slice)) {
      fail('INVALID_CAMPAIGN', 'campaignTo must be after campaignFrom');
    }
  }
  if (stream === 'sequential') {
    assertNoCampaignOverlap(slices);
    return stream;
  }
  if (!concurrentProductsEnabled) {
    fail(
      'CONCURRENT_PRODUCTS_DISABLED',
      'concurrent products are behind the CONCURRENT_PRODUCTS flag (D14)',
    );
  }
  const products = new Set(slices.map((slice) => slice.productId));
  if (products.size !== slices.length) {
    fail('DUPLICATE_PRODUCT', 'a product appears once in a concurrent version');
  }
  return stream;
}

function assertNoCampaignOverlap(slices: readonly SliceInput[]): void {
  const sorted = [...slices].sort((a, b) => startMs(a) - startMs(b));
  for (let i = 1; i < sorted.length; i++) {
    if (startMs(sorted[i]) < endMs(sorted[i - 1])) {
      fail(
        'CAMPAIGN_OVERLAP',
        'sequential campaigns must not overlap; give each slice its own campaign range',
      );
    }
  }
}

/**
 * Leaves to slices: a slice takes the leaves that start inside its campaign (no campaign = every leaf).
 * Sequential versions give each leaf to at most one slice; a leaf no campaign covers is unassigned
 * (warning) and a campaign boundary strictly inside a leaf is reported.
 */
export function assignLeaves(
  slices: readonly SliceInput[],
  leaves: readonly PlanLeaf[],
  warnings: PlanWarning[],
): Assignment[] {
  const assignments: Assignment[] = [];
  for (const leaf of leaves) {
    const start = leaf.start.getTime();
    const owners = slices.filter(
      (slice) => startMs(slice) <= start && start < endMs(slice),
    );
    if (owners.length === 0) {
      warnings.push({ code: 'unassigned_leaf', at: leaf.start.toISOString() });
    }
    for (const slice of owners) {
      reportBoundaryInside(slice, leaf, warnings);
      assignments.push({ slice, leaf });
    }
  }
  return assignments;
}

function reportBoundaryInside(
  slice: SliceInput,
  leaf: PlanLeaf,
  warnings: PlanWarning[],
): void {
  const end = endMs(slice);
  if (end > leaf.start.getTime() && end < leaf.end.getTime()) {
    warnings.push({
      code: 'campaign_boundary_inside_leaf',
      at: leaf.start.toISOString(),
      sliceKey: slice.key,
    });
  }
}

/**
 * Joint-recipe feasibility of shared streams (T43): on every leaf the shares of the shared capacity used
 * by the active slices must each be positive and add up to at most 1, otherwise the combined rate is
 * infeasible (422 `INFEASIBLE_PRODUCT_MIX`). Shared time is then split by share, never double-counted.
 */
export function assertFeasibleMix(
  shares: ReadonlyArray<{
    leafStart: Date;
    sliceKey: string;
    share: Dec | null;
  }>,
): void {
  const byLeaf = new Map<number, Dec>();
  for (const entry of shares) {
    if (!entry.share || !entry.share.gt(0)) {
      fail(
        'INFEASIBLE_PRODUCT_MIX',
        `slice ${entry.sliceKey} has no positive share in the joint recipe of its shared_capacity profile ` +
          `at ${entry.leafStart.toISOString()}`,
      );
    }
    const key = entry.leafStart.getTime();
    const total = (byLeaf.get(key) ?? new Dec(0)).plus(entry.share);
    if (total.greaterThan(1)) {
      fail(
        'INFEASIBLE_PRODUCT_MIX',
        `the joint recipe shares exceed the shared capacity (Σ ${total.toFixed()} > 1) at ` +
          entry.leafStart.toISOString(),
      );
    }
    byLeaf.set(key, total);
  }
}
