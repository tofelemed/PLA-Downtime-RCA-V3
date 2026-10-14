import { LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { ValuationBasis } from '../profiles/profile.types';
import {
  ValuationContext,
  ValuationLineInput,
  ValuationRateSnapshot,
} from './valuation.types';

/** Kinds whose quantity accrues uniformly over the line's interval (rate × time), so rate changes split it. */
export const TIME_UNIFORM: ReadonlySet<LossKind> = new Set([
  'availability',
  'schedule_exclusion',
]);

export interface RatePiece {
  rate: ValuationRateSnapshot;
  from: number;
  to: number;
}

export const normUom = (uom: string) => uom.replace(/\s+/g, '').toLowerCase();
const ms = (iso: string | null) => (iso === null ? Infinity : Date.parse(iso));

/** Approved rate versions of one owner and basis, in effective order. */
export function ratesOf(
  context: ValuationContext,
  ownerId: string,
  basis: ValuationBasis,
): ValuationRateSnapshot[] {
  return context.rates
    .filter((r) => r.ownerId === ownerId && r.basis === basis)
    .sort((a, b) => ms(a.from) - ms(b.from) || a.id.localeCompare(b.id));
}

/** The rates' share of `[start, end)`: time pieces in order, null when some instant has no rate. */
function pieces(
  rates: readonly ValuationRateSnapshot[],
  start: number,
  end: number,
): RatePiece[] | null {
  const found: RatePiece[] = [];
  let cursor = start;
  while (cursor < end) {
    const rate = rates.find((r) => ms(r.from) <= cursor && ms(r.to) > cursor);
    if (!rate) return null;
    const to = Math.min(end, ms(rate.to));
    found.push({ rate, from: cursor, to });
    cursor = to;
  }
  return found;
}

/** Rate pieces of a line: split at rate edges for time-uniform lines, else the rate at the valuation date. */
export function ratePieces(
  line: ValuationLineInput,
  rates: readonly ValuationRateSnapshot[],
  uniform: boolean,
): RatePiece[] | null {
  const start = line.start.getTime();
  const end = line.end.getTime();
  if (uniform && end > start) return pieces(rates, start, end);
  const rate = rates.find((r) => ms(r.from) <= start && ms(r.to) > start);
  return rate ? [{ rate, from: start, to: Math.max(start, end) }] : null;
}

/** The piece's share of the line's interval (1 for an instant line). */
export function shareOf(line: ValuationLineInput, piece: RatePiece): Dec {
  const span = line.end.getTime() - line.start.getTime();
  return span > 0 ? new Dec(piece.to - piece.from).div(span) : new Dec(1);
}
