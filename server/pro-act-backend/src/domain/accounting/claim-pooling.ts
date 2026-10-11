import { Decimal } from 'decimal.js';
import { Dec, ZERO } from '../actuals/decimal';
import { Ledger, SliceInput } from './accounting.types';
import { Claim, sumOf } from './claims';

/** Components whose causes claim part of a total computed at the production boundary. */
export type PooledKind = 'performance' | 'quality';

export interface PoolKey {
  ledger: Ledger;
  kind: PooledKind;
  sliceId: string;
}

/**
 * Claim pooling over a product run (ACC03 across plan slices). Pass 1 records each slice's component
 * total and its own claims; pass 2 hands each slice its part of the run's pooled claims.
 */
export interface ClaimPool {
  record?(key: PoolKey, total: Dec, claims: readonly Claim[]): void;
  /** undefined: the slice keeps its own claims */
  claimsFor?(key: PoolKey): Claim[] | undefined;
}

/** Flag on a claim line that carries a share of a product-run claim (see `pooledClaims`). */
export const PRODUCT_RUN_SHARE = 'product_run_share';

const SCALE = 8;
const keyOf = (key: PoolKey) => `${key.ledger}|${key.kind}|${key.sliceId}`;

/**
 * Product runs: chains of two or more sequential slices of one product and unit with no concurrent
 * stream, each starting where the previous one ends. Within a period they are only cut by plan
 * periods (e.g. two month plans meeting inside a shift), not by anything the line did.
 */
export function productRuns(slices: readonly SliceInput[]): SliceInput[][] {
  const candidates = slices
    .filter((s) => s.productId !== undefined && !s.concurrent)
    .sort((a, b) => a.window.start.getTime() - b.window.start.getTime());
  const runs: SliceInput[][] = [];
  let current: SliceInput[] = [];
  for (const slice of candidates) {
    const last = current[current.length - 1];
    const continues =
      last !== undefined &&
      last.productId === slice.productId &&
      last.uom === slice.uom &&
      last.window.end.getTime() === slice.window.start.getTime();
    if (!continues) {
      if (current.length > 1) runs.push(current);
      current = [];
    }
    current.push(slice);
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

/** Pass 1: remembers what every slice's ledgers computed. */
export class ClaimRecorder implements ClaimPool {
  private readonly recorded = new Map<
    string,
    { total: Dec; claims: readonly Claim[] }
  >();

  record(key: PoolKey, total: Dec, claims: readonly Claim[]): void {
    this.recorded.set(keyOf(key), { total, claims });
  }

  get(key: PoolKey): { total: Dec; claims: readonly Claim[] } | undefined {
    return this.recorded.get(keyOf(key));
  }
}

/** One claim per event: parts of an event prorated into several slices of the run are added up. */
function mergeByEvent(claims: readonly Claim[]): Claim[] {
  const merged = new Map<string, Claim>();
  for (const claim of claims) {
    const existing = merged.get(claim.event.eventId);
    if (!existing) {
      merged.set(claim.event.eventId, {
        ...claim,
        rateVersionIds: [...claim.rateVersionIds],
      });
      continue;
    }
    existing.quantity = existing.quantity.plus(claim.quantity);
    existing.start =
      claim.start < existing.start ? claim.start : existing.start;
    existing.end = claim.end > existing.end ? claim.end : existing.end;
    for (const id of claim.rateVersionIds) {
      if (!existing.rateVersionIds.includes(id))
        existing.rateVersionIds.push(id);
    }
  }
  return [...merged.values()];
}

/**
 * Each pooled claim split over the run's slices in proportion to their component totals: truncated
 * to 8 places, the last slice takes the remainder, so the parts add up to the claim exactly and every
 * slice's claims relate to its own total as the run's claims relate to the run's total.
 */
function splitClaims(
  pooled: readonly Claim[],
  totals: readonly Dec[],
  runTotal: Dec,
): Claim[][] {
  const parts: Claim[][] = totals.map(() => []);
  for (const claim of pooled) {
    let assigned = ZERO;
    totals.forEach((total, i) => {
      const last = i === totals.length - 1;
      const quantity = last
        ? claim.quantity.minus(assigned)
        : claim.quantity
            .mul(total)
            .div(runTotal)
            .toDecimalPlaces(SCALE, Decimal.ROUND_DOWN);
      assigned = assigned.plus(quantity);
      parts[i].push({
        ...claim,
        quantity,
        rateVersionIds: [...claim.rateVersionIds],
        pooled: true,
      });
    });
  }
  return parts;
}

/**
 * Pass 2 lookup: for every product run, ledger and pooled component whose slices all computed a total,
 * the slices' claims pooled and split by `splitClaims`. A run whose total is not above epsilon keeps
 * the slices' own claims (any claim there is impossible and fails as before).
 */
export function pooledClaims(
  runs: readonly SliceInput[][],
  recorder: ClaimRecorder,
  epsilon: Dec,
): ClaimPool {
  const result = new Map<string, Claim[]>();
  const components = (['capacity', 'plan'] as const).flatMap((ledger) =>
    (['performance', 'quality'] as const).map((kind) => ({ ledger, kind })),
  );
  for (const run of runs) {
    for (const component of components) {
      poolComponent(run, component, { recorder, epsilon, result });
    }
  }
  return { claimsFor: (key) => result.get(keyOf(key)) };
}

/** One run and component: its slices' claims pooled and split (skipped when not all computed it). */
function poolComponent(
  run: readonly SliceInput[],
  component: { ledger: Ledger; kind: PooledKind },
  target: {
    recorder: ClaimRecorder;
    epsilon: Dec;
    result: Map<string, Claim[]>;
  },
): void {
  const keys = run.map((s) => ({ ...component, sliceId: s.sliceId }));
  const recorded = keys.map((key) => target.recorder.get(key));
  if (recorded.some((r) => r === undefined)) return;
  const totals = recorded.map((r) => r?.total ?? ZERO);
  const runTotal = sumOf(totals);
  if (runTotal.lte(target.epsilon)) return;
  const pooled = mergeByEvent(recorded.flatMap((r) => r?.claims ?? []));
  splitClaims(pooled, totals, runTotal).forEach((claims, i) =>
    target.result.set(keyOf(keys[i]), claims),
  );
}
