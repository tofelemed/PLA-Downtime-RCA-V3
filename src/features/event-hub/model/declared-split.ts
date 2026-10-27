import type { SplitRow } from './reason-split';

/** Server rule: the tonnes of a split add up to the shortfall within max(0.001, shortfall x 1e-6). */
const ABSOLUTE_TOLERANCE = 0.001;
const RELATIVE_TOLERANCE = 1e-6;

export function tonnesTolerance(shortfall: number): number {
  return Math.max(ABSOLUTE_TOLERANCE, Math.abs(shortfall) * RELATIVE_TOLERANCE);
}

const valueOf = (row: SplitRow) => {
  const value = Number(row.value.trim());
  return Number.isFinite(value) ? value : 0;
};

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** The typed loss shares, recovery shares and their net (loss − recovery); an empty or invalid entry counts as 0. */
export interface SplitBalance {
  losses: number;
  recovery: number;
  net: number;
}

/** Task 13: Σ loss shares − Σ recovery shares must equal the shortfall (tonnes) or 100 (percent). */
export function splitBalance(rows: readonly SplitRow[]): SplitBalance {
  const losses = round6(rows.filter((row) => !row.recovery).reduce((sum, row) => sum + valueOf(row), 0));
  const recovery = round6(rows.filter((row) => row.recovery).reduce((sum, row) => sum + valueOf(row), 0));
  return { losses, recovery, net: round6(losses - recovery) };
}

/** Net of the typed tonnes (loss shares less recovery shares). */
export function tonnesSum(rows: readonly SplitRow[]): number {
  return splitBalance(rows).net;
}

/** Tonnes still to place (negative: over the shortfall), rounded to 6 places. */
export function tonnesRemaining(rows: readonly SplitRow[], shortfall: number): number {
  return round6(shortfall - tonnesSum(rows));
}

export function tonnesSplitFits(rows: readonly SplitRow[], shortfall: number): boolean {
  return Math.abs(shortfall - tonnesSum(rows)) <= tonnesTolerance(shortfall);
}

/** Every entry is a non-negative number. */
export function tonnesEntriesValid(rows: readonly SplitRow[]): boolean {
  return rows.every((row) => {
    const value = Number(row.value.trim());
    return row.value.trim() !== '' && Number.isFinite(value) && value >= 0;
  });
}

/** Recovery shares need at least one loss share beside them (the server refuses a split of recoveries only). */
export function recoveryValid(rows: readonly SplitRow[]): boolean {
  return rows.some((row) => !row.recovery);
}

export interface TonnesSplitGap {
  side: 'remaining' | 'over';
  tonnes: number;
}

/** What is left to place, or by how much the net overshoots `target`; null when it fits. The caller formats the number. */
export function splitGap(net: number, target: number, tolerance: number): TonnesSplitGap | null {
  const remaining = round6(target - net);
  if (Math.abs(remaining) <= tolerance) return null;
  return remaining > 0 ? { side: 'remaining', tonnes: remaining } : { side: 'over', tonnes: Math.abs(remaining) };
}

/** What is left to place, or by how much the tonnes overshoot; null when they fit. The caller formats the number. */
export function tonnesSplitGap(rows: readonly SplitRow[], shortfall: number): TonnesSplitGap | null {
  return splitGap(tonnesSum(rows), shortfall, tonnesTolerance(shortfall));
}
