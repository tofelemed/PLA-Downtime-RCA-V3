import { describe, expect, it } from 'vitest';
import { recoveryValid, splitBalance, tonnesEntriesValid, tonnesRemaining, tonnesSplitFits, tonnesSplitGap, tonnesTolerance } from './declared-split';
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

describe('declared split with recovery shares (Task 13)', () => {
  const split = (...values: Array<[string, boolean]>): SplitRow[] => values.map(([value, recovery], key) => ({ key, reasonCodeId: 'r' + String(key), value, recovery }));

  it('nets the loss shares against the recovery shares: 23 + 11 + 6 − 8 = 32', () => {
    const rows = split(['23', false], ['11', false], ['6', false], ['8', true]);
    expect(splitBalance(rows)).toEqual({ losses: 40, recovery: 8, net: 32 });
    expect(tonnesSplitFits(rows, 32)).toBe(true);
    expect(tonnesSplitGap(rows, 32)).toBeNull();
  });

  it('says what is left or over against the net', () => {
    expect(tonnesSplitGap(split(['40', false], ['10', true]), 32)).toEqual({ side: 'remaining', tonnes: 2 });
    expect(tonnesSplitGap(split(['40', false], ['6', true]), 32)).toEqual({ side: 'over', tonnes: 2 });
  });

  it('needs a loss share beside the recovery and sends the recovery mark', () => {
    expect(recoveryValid(split(['32', true]))).toBe(false);
    expect(recoveryValid(split(['40', false], ['8', true]))).toBe(true);
    expect(reasonWeightsBody(split(['40', false], ['8', true]), 'tonnes')).toEqual([
      { reasonCodeId: 'r0', quantity: '40' },
      { reasonCodeId: 'r1', quantity: '8', recovery: true },
    ]);
  });
});
