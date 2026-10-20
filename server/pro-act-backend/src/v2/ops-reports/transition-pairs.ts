import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import type { TransitionRowView } from './transition-performance';

/** The transitions of one product change (from → to) in the window (R5), decimal strings for seconds. */
export interface TransitionPairView {
  fromProductId: string | null;
  fromProduct: string | null;
  toProductId: string | null;
  toProduct: string | null;
  /** transitions, and the ended ones the durations are taken over */
  transitions: number;
  ended: number;
  meanSeconds: string | null;
  bestSeconds: string | null;
  worstSeconds: string | null;
  /** ended transitions with a standard, how many ran over it, and their mean excess seconds */
  withStandard: number;
  overStandard: number;
  meanExcessSeconds: string | null;
}

const mean = (values: Dec[]) =>
  values.length === 0
    ? null
    : formatDec(values.reduce((a, b) => a.plus(b), ZERO).div(values.length));

function pairOf(rows: readonly TransitionRowView[]): TransitionPairView {
  const ended = rows.flatMap((r) =>
    r.seconds === null ? [] : [new Dec(r.seconds)],
  );
  const sorted = [...ended].sort((a, b) => a.comparedTo(b));
  const excess = rows.flatMap((r) =>
    r.excessSeconds === null ? [] : [new Dec(r.excessSeconds)],
  );
  const first = rows[0];
  return {
    fromProductId: first.fromProductId,
    fromProduct: first.fromProduct,
    toProductId: first.toProductId,
    toProduct: first.toProduct,
    transitions: rows.length,
    ended: ended.length,
    meanSeconds: mean(ended),
    bestSeconds: sorted.length ? formatDec(sorted[0]) : null,
    worstSeconds: sorted.length ? formatDec(sorted[sorted.length - 1]) : null,
    withStandard: excess.length,
    overStandard: excess.filter((e) => e.gt(0)).length,
    meanExcessSeconds: mean(excess),
  };
}

/**
 * Per product change, worst mean excess first (then most transitions): the server's summary of the listed
 * transitions — means of the ended ones, never of running transitions.
 */
export function summarizeTransitions(
  rows: readonly TransitionRowView[],
): TransitionPairView[] {
  const byPair = new Map<string, TransitionRowView[]>();
  for (const row of rows) {
    const key = `${row.fromProductId ?? '-'}>${row.toProductId ?? '-'}`;
    byPair.set(key, [...(byPair.get(key) ?? []), row]);
  }
  const excess = (p: TransitionPairView) =>
    p.meanExcessSeconds === null ? -Infinity : Number(p.meanExcessSeconds);
  return [...byPair.values()]
    .map(pairOf)
    .sort((a, b) => excess(b) - excess(a) || b.transitions - a.transitions);
}
