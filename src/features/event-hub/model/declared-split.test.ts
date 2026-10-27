import { describe, expect, it } from 'vitest';
import { tonnesEntriesValid, tonnesRemaining, tonnesSplitFits, tonnesSplitGap, tonnesTolerance } from './declared-split';
import { reasonWeightsBody, type SplitRow } from './reason-split';

const rows = (...values: string[]): SplitRow[] => values.map((value, key) => ({ key, reasonCodeId: `r${key}`, value }));

describe('declared tonnes split', () => {
  it('accepts tonnes that add up to the shortfall, within max(0.001, shortfall x 1e-6)', () => {
    expect(tonnesSplitFits(rows('4', '3.5'), 7.5)).toBe(true);
    expect(tonnesSplitFits(rows('4', '3.5004'), 7.5)).toBe(true);
    expect(tonnesTolerance(7.5)).toBe(0.001);
    expect(tonnesTolerance(5_000_000)).toBe(5);
  });

  it('refuses tonnes that do not add up and says what is left', () => {
    expect(tonnesSplitFits(rows('4', '3'), 7.5)).toBe(false);
    expect(tonnesRemaining(rows('4', '3'), 7.5)).toBe(0.5);
    expect(tonnesSplitGap(rows('4', '3'), 7.5)).toEqual({ side: 'remaining', tonnes: 0.5 });
    expect(tonnesSplitGap(rows('5', '3'), 7.5)).toEqual({ side: 'over', tonnes: 0.5 });
    expect(tonnesSplitGap(rows('4', '3.5'), 7.5)).toBeNull();
  });

  it('needs a non-negative number in every row', () => {
    expect(tonnesEntriesValid(rows('4', '3.5'))).toBe(true);
    expect(tonnesEntriesValid(rows('4', ''))).toBe(false);
    expect(tonnesEntriesValid(rows('4', '-1'))).toBe(false);
  });

  it('sends the tonnes as quantity entries', () => {
    expect(reasonWeightsBody(rows('4', '3.5'), 'tonnes')).toEqual([
      { reasonCodeId: 'r0', quantity: '4' },
      { reasonCodeId: 'r1', quantity: '3.5' },
    ]);
  });
});
