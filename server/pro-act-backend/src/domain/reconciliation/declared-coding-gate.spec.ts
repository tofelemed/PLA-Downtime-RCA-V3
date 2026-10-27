import { Dec } from '../actuals/decimal';
import { declaredCodingGate } from './declared-coding-gate';

const d = (value: number) => new Dec(value);
const warn = { mode: 'warn' as const, codedRatioTarget: 0.95 };

describe('declaredCodingGate (declared mode)', () => {
  it('a day without a production loss passes with ratio 1', () => {
    const result = declaredCodingGate(
      {
        events: 0,
        coded: 0,
        investigationPending: 0,
        shortfall: d(0),
        codedShortfall: d(0),
      },
      warn,
    );
    expect(result).toMatchObject({ passes: true, codedRatio: '1', uncoded: 0 });
  });

  it('an event with neither reason nor investigation pending is LOSS_EVENT_UNCODED and uncovers the shortfall', () => {
    const result = declaredCodingGate(
      {
        events: 1,
        coded: 0,
        investigationPending: 0,
        shortfall: d(40),
        codedShortfall: d(0),
      },
      { mode: 'block', codedRatioTarget: 0.95 },
    );
    expect(result.mode).toBe('block');
    expect(result.passes).toBe(false);
    expect(result.issues.map((i) => i.code)).toEqual([
      'LOSS_EVENT_UNCODED',
      'CODING_COVERAGE_LOW',
    ]);
    expect(result.codedRatio).toBe('0');
  });

  it('the coded share is of the shortfall, not of the event count', () => {
    const coded = declaredCodingGate(
      {
        events: 1,
        coded: 1,
        investigationPending: 0,
        shortfall: d(40),
        codedShortfall: d(40),
      },
      warn,
    );
    expect(coded).toMatchObject({ passes: true, codedRatio: '1' });
    const mixed = declaredCodingGate(
      {
        events: 2,
        coded: 1,
        investigationPending: 1,
        shortfall: d(100),
        codedShortfall: d(90),
      },
      warn,
    );
    expect(mixed.uncoded).toBe(0);
    expect(mixed.codedRatio).toBe('0.9');
    expect(mixed.issues.map((i) => i.code)).toEqual(['CODING_COVERAGE_LOW']);
  });

  it('investigation pending satisfies the per-event rule but never the coverage target', () => {
    const result = declaredCodingGate(
      {
        events: 1,
        coded: 0,
        investigationPending: 1,
        shortfall: d(10),
        codedShortfall: d(0),
      },
      warn,
    );
    expect(result.uncoded).toBe(0);
    expect(result.issues.map((i) => i.code)).toEqual(['CODING_COVERAGE_LOW']);
  });
});
