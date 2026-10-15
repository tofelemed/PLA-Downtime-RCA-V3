import { Dec } from '../actuals/decimal';
import { bridgeFindings, bridgeLimitOf } from './bridge-limits';

const slices = [{ sliceId: 's1', target: new Dec(1000) }];
const bridge = (quantity: string) => ({
  ref: 'l1',
  sliceId: 's1',
  quantity: new Dec(quantity),
});

/** SME R8: per-unit absolute / relative bridge limits; null = no limit (pilot default). */
describe('bridge limits (SME R8)', () => {
  it('no limit by default: nothing is ever above it', () => {
    const none = {
      absolute: null,
      relative: null,
      overLimit: 'second_review' as const,
    };
    expect(bridgeFindings([bridge('500')], slices, none)).toEqual([]);
    expect(bridgeLimitOf(none, new Dec(1000))).toBeNull();
  });

  it('the smaller of the absolute and the relative limit binds', () => {
    const limits = {
      absolute: 8,
      relative: 0.005,
      overLimit: 'second_review' as const,
    };
    expect(bridgeLimitOf(limits, new Dec(1000))).toEqual({
      limit: new Dec(5),
      basis: 'relative',
    });
    expect(bridgeFindings([bridge('5')], slices, limits)).toEqual([]);
    expect(bridgeFindings([bridge('6')], slices, limits)).toEqual([
      {
        ref: 'l1',
        sliceId: 's1',
        quantity: '6',
        limit: '5',
        basis: 'relative',
      },
    ]);
  });

  it('without a plan target only the absolute limit applies', () => {
    const limits = {
      absolute: 2,
      relative: 0.001,
      overLimit: 'refuse' as const,
    };
    expect(
      bridgeFindings([bridge('3')], [{ sliceId: 's1', target: null }], limits),
    ).toMatchObject([{ limit: '2', basis: 'absolute' }]);
  });
});
