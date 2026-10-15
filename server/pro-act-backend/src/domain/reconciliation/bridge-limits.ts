import { Dec } from '../actuals/decimal';

export interface BridgeLimits {
  /** in the slice's unit of measure; null = no absolute limit */
  absolute: number | null;
  /** share of the slice's plan target (0.005 = 0.5 %); null = no relative limit */
  relative: number | null;
  overLimit: 'second_review' | 'refuse';
}

export interface BridgeLine {
  /** line id, or the index of the line in a draft save */
  ref: string;
  sliceId: string;
  quantity: Dec;
}

export interface BridgeSlice {
  sliceId: string;
  /** plan target; null = no plan (only an absolute limit applies) */
  target: Dec | null;
}

/** A bridge above its slice's limit. */
export interface BridgeFinding {
  ref: string;
  sliceId: string;
  quantity: string;
  limit: string;
  /** which limit is the binding (smaller) one */
  basis: 'absolute' | 'relative';
}

/** The binding limit of a slice: the smaller of the absolute and the relative one; null = no limit. */
export function bridgeLimitOf(
  limits: BridgeLimits,
  target: Dec | null,
): { limit: Dec; basis: 'absolute' | 'relative' } | null {
  const candidates: Array<{ limit: Dec; basis: 'absolute' | 'relative' }> = [];
  if (limits.absolute !== null) {
    candidates.push({ limit: new Dec(limits.absolute), basis: 'absolute' });
  }
  if (limits.relative !== null && target !== null) {
    candidates.push({
      limit: target.abs().times(limits.relative),
      basis: 'relative',
    });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((min, c) => (c.limit.lt(min.limit) ? c : min));
}

/**
 * SME R8: the bridge lines above their slice's limit — per-unit measurement uncertainty and materiality,
 * absolute (slice unit) and / or relative to the plan target, the smaller one binding; no limit = none.
 * Each bridge is judged on its own size (a bridge never offsets another). Pure.
 */
export function bridgeFindings(
  lines: readonly BridgeLine[],
  slices: readonly BridgeSlice[],
  limits: BridgeLimits,
): BridgeFinding[] {
  const targets = new Map(slices.map((s) => [s.sliceId, s.target]));
  return lines.flatMap((line) => {
    const bound = bridgeLimitOf(limits, targets.get(line.sliceId) ?? null);
    if (!bound || line.quantity.abs().lte(bound.limit)) return [];
    return [
      {
        ref: line.ref,
        sliceId: line.sliceId,
        quantity: line.quantity.toString(),
        limit: bound.limit.toString(),
        basis: bound.basis,
      },
    ];
  });
}
