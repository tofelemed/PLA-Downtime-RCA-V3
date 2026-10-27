import type { ProductionEventView, ReasonWeightInput, ReasonWeightView } from '@/api/v2/types/events';
import { roundDecimal } from '@/features/ux-kit/format/decimal';

/** How the coder enters the split: percent of the stop, minutes of it (sent as seconds), or tonnes of a production loss. */
export type SplitMode = 'percent' | 'minutes' | 'tonnes';

/** One row of the "Split across several reasons" section, as typed. */
export interface SplitRow {
  key: number;
  reasonCodeId: string;
  value: string;
  /** declared mode (Task 13): the share is a recovery, offsetting the loss shares */
  recovery?: boolean;
}

/** Rows to start from: the stored split (as percents of its weights), else the current reason and one empty row. */
export function initialSplitRows(event: Pick<ProductionEventView, 'reasonCodeId' | 'reasonWeights'>): SplitRow[] {
  const stored = event.reasonWeights ?? [];
  if (stored.length > 1) {
    return stored.map((w, i) => ({ key: i, reasonCodeId: w.reasonCodeId, value: percentOf(w.weight), ...(w.recovery ? { recovery: true } : {}) }));
  }
  return [
    { key: 0, reasonCodeId: event.reasonCodeId ?? '', value: '' },
    { key: 1, reasonCodeId: '', value: '' },
  ];
}

/**
 * A stored weight (8-place fraction) as a percent: 0.75 → "75". Editing keeps 6 places, so the percents of a
 * stored split add up to exactly 100 again (0.33333334 → "33.333334"); display rounds to `digits`.
 */
export function percentOf(weight: string, digits = 6): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(weight.trim());
  if (!match) return '';
  const [, int, frac = ''] = match;
  const padded = frac.padEnd(2, '0');
  const shifted = `${int}${padded.slice(0, 2)}.${padded.slice(2) || '0'}`;
  const rounded = roundDecimal(shifted, digits) ?? '';
  return rounded.includes('.') ? rounded.replace(/\.?0+$/, '') : rounded;
}

/** Every row names a reason and a value (the server checks the rest and answers with its own message). */
export function splitComplete(rows: readonly SplitRow[]): boolean {
  return rows.length > 1 && rows.every((row) => row.reasonCodeId !== '' && row.value.trim() !== '');
}

/**
 * The PATCH `reasonWeights` of the rows: percents as typed, minutes as seconds. Nothing is normalised or
 * checked here: the server normalises the weights and refuses a sum that does not fit (422 with its reason).
 */
export function reasonWeightsBody(rows: readonly SplitRow[], mode: SplitMode): ReasonWeightInput[] {
  return rows.map((row) => {
    const recovery = row.recovery ? { recovery: true } : {};
    if (mode === 'percent') return { reasonCodeId: row.reasonCodeId, percent: row.value.trim(), ...recovery };
    if (mode === 'tonnes') return { reasonCodeId: row.reasonCodeId, quantity: row.value.trim(), ...recovery };
    return { reasonCodeId: row.reasonCodeId, seconds: Number(row.value) * 60 };
  });
}

/** True for a stored split across two or more reasons. */
export function hasSplit(weights: readonly ReasonWeightView[] | null | undefined): weights is ReasonWeightView[] {
  return Array.isArray(weights) && weights.length > 1;
}
