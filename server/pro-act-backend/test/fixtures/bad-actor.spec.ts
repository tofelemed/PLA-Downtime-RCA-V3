import {
  badActorTrigger,
  rankBadActors,
  RankedFigures,
} from '../../src/domain/rca/bad-actor';
import { RCA_POLICY_DEFAULT } from '../../src/domain/rca/rca-policy';

/**
 * SME CA8 (14 Oct 2026) bad actors with the answer's own example (illustrative, test data): a monthly
 * review of the top assets / modes over a rolling 90 days. Ten small jams losing 100 tonnes in aggregate
 * outrank one large stop of 60 tonnes; the ranking is by approved quantity (default), approved value or
 * stop count, unknown values last; the cumulative trigger state uses the pilot 8 h in 90 days, halved
 * for critical assets.
 */
const row = (
  key: string,
  quantity: string | null,
  amount: string | null,
  stops: number,
): RankedFigures => ({ key, quantity, amount, stops });

const JAMS = row('P-101|mode:jam', '100', '30000', 10);
const BIG_STOP = row('K-201|mode:trip', '60', '18000', 1);
const UNVALUED = row('E-301|mode:leak', '80', null, 3);

describe('CA8 bad-actor ranking', () => {
  it('ten small jams losing 100 t outrank one 60 t stop (approved quantity, the default)', () => {
    const ranked = rankBadActors([BIG_STOP, UNVALUED, JAMS], 'quantity', 5);
    expect(ranked.map((r) => r.key)).toEqual([
      'P-101|mode:jam',
      'E-301|mode:leak',
      'K-201|mode:trip',
    ]);
  });

  it('by value: an unvalued group is never ranked as zero — it comes after every valued one', () => {
    const ranked = rankBadActors([UNVALUED, BIG_STOP, JAMS], 'value', 5);
    expect(ranked.map((r) => r.key)).toEqual([
      'P-101|mode:jam',
      'K-201|mode:trip',
      'E-301|mode:leak',
    ]);
  });

  it('by stops, top N only, ties broken by key', () => {
    const tie = row('A-001|mode:jam', '1', '1', 10);
    expect(
      rankBadActors([BIG_STOP, JAMS, UNVALUED, tie], 'stops', 2).map(
        (r) => r.key,
      ),
    ).toEqual(['A-001|mode:jam', 'P-101|mode:jam']);
  });
});

describe('CA8 cumulative bad-actor trigger state', () => {
  const policy = RCA_POLICY_DEFAULT;

  it('pilot 8 h in 90 days: 9 h is over the threshold until a firing is recorded', () => {
    expect(
      badActorTrigger({
        policy,
        seconds: 9 * 3600,
        criticalAsset: false,
        fired: false,
      }),
    ).toEqual({
      state: 'over_threshold',
      seconds: 32400,
      thresholdSeconds: 28800,
      windowDays: 90,
      criticalAsset: false,
    });
    expect(
      badActorTrigger({
        policy,
        seconds: 9 * 3600,
        criticalAsset: false,
        fired: true,
      }).state,
    ).toBe('fired');
  });

  it('critical assets are halved (4 h); without a cumulative rule the trigger is off', () => {
    const critical = badActorTrigger({
      policy,
      seconds: 5 * 3600,
      criticalAsset: true,
      fired: false,
    });
    expect(critical).toMatchObject({
      state: 'over_threshold',
      thresholdSeconds: 14400,
    });
    expect(
      badActorTrigger({
        policy,
        seconds: 3600,
        criticalAsset: false,
        fired: false,
      }).state,
    ).toBe('below');
    expect(
      badActorTrigger({
        policy: { ...policy, cumulative: null },
        seconds: 99_999,
        criticalAsset: false,
        fired: false,
      }),
    ).toMatchObject({ state: 'off', thresholdSeconds: null });
  });
});
