import { Dec } from '../actuals/decimal';
import { codingGate } from './coding-gate';

const policy = { mode: 'warn' as const, codedRatioTarget: 0.95 };
const ratio = (coded: number, stopped: number) => ({
  value: new Dec(coded).div(stopped),
  codedSeconds: new Dec(coded),
  stoppedSeconds: new Dec(stopped),
});

/** SME D12 worked example: 200 stopped minutes, 190 coded meet the 95 % shift target. */
describe('codingGate (SME D12)', () => {
  it('190 of 200 minutes coded and every stop coded or pending: passes', () => {
    const result = codingGate(
      { stops: 5, coded: 4, investigationPending: 1 },
      ratio(190 * 60, 200 * 60),
      policy,
    );
    expect(result).toMatchObject({
      passes: true,
      uncoded: 0,
      target: '0.95',
      codedRatio: '0.95',
    });
    expect(result.issues).toEqual([]);
  });

  it('a stop with neither a reason nor "investigation pending" fails, whatever the minutes', () => {
    const result = codingGate(
      { stops: 6, coded: 5, investigationPending: 0 },
      ratio(199, 200),
      policy,
    );
    expect(result.passes).toBe(false);
    expect(result.uncoded).toBe(1);
    expect(result.issues.map((i) => i.code)).toEqual(['STOPS_UNCODED']);
  });

  it('five trivial coded stops cannot compensate one uncoded two-hour event (coverage is in minutes)', () => {
    const result = codingGate(
      { stops: 6, coded: 5, investigationPending: 1 },
      ratio(5 * 60, 5 * 60 + 120 * 60),
      { mode: 'block', codedRatioTarget: 0.95 },
    );
    expect(result.mode).toBe('block');
    expect(result.issues.map((i) => i.code)).toEqual(['CODING_COVERAGE_LOW']);
    expect(result.issues[0].message).toContain('4.0 %');
  });

  it('a period without stop time passes', () => {
    const result = codingGate(
      { stops: 0, coded: 0, investigationPending: 0 },
      { value: null, codedSeconds: null, stoppedSeconds: null },
      policy,
    );
    expect(result.passes).toBe(true);
    expect(result.codedRatio).toBeNull();
  });
});
