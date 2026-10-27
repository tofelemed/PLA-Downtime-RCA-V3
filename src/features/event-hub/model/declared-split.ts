import type { SplitRow } from './reason-split';

/** Server rule: the tonnes of a split add up to the shortfall within max(0.001, shortfall x 1e-6). */
const ABSOLUTE_TOLERANCE = 0.001;
const RELATIVE_TOLERANCE = 1e-6;

export function tonnesTolerance(shortfall: number): number {
  return Math.max(ABSOLUTE_TOLERANCE, Math.abs(shortfall) * RELATIVE_TOLERANCE);
}

/** Sum of the typed tonnes; an empty or invalid entry counts as 0. */
export function tonnesSum(rows: readonly SplitRow[]): number {
  return rows.reduce((total, row) => {
    const value = Number(row.value.trim());
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

/** Tonnes still to place (negative: over the shortfall), rounded to 6 places. */
export function tonnesRemaining(rows: readonly SplitRow[], shortfall: number): number {
  return Number((shortfall - tonnesSum(rows)).toFixed(6));
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

/** Live text under the rows: what is left to place, or by how much the tonnes overshoot; null when they fit. */
export function tonnesSplitMessage(rows: readonly SplitRow[], shortfall: number): string | null {
  if (tonnesSplitFits(rows, shortfall)) return null;
  const remaining = tonnesRemaining(rows, shortfall);
  return remaining > 0 ? `${remaining} t still to place.` : `${Math.abs(remaining)} t over the shortfall.`;
}
