import { sliceTarget } from './slice-target';

const at = (hour: number) => new Date(Date.UTC(2027, 2, 1, hour));

describe('sliceTarget (LA-07)', () => {
  it('a slice covering its whole plan period takes the whole target', () => {
    expect(
      sliceTarget(
        '720',
        { start: at(0), end: at(8) },
        { start: at(0), end: at(8) },
      ),
    ).toBe('720');
  });

  it('a slice covering part of its plan period takes the time share of the target', () => {
    expect(
      sliceTarget(
        '720',
        { start: at(0), end: at(8) },
        { start: at(6), end: at(8) },
      ),
    ).toBe('180');
  });

  it('the share is exact to the stored 8 places', () => {
    expect(
      sliceTarget(
        '100',
        { start: at(0), end: at(3) },
        { start: at(0), end: at(1) },
      ),
    ).toBe('33.33333333');
  });

  it('only the overlap counts when the slice reaches beyond the plan period', () => {
    expect(
      sliceTarget(
        '800',
        { start: at(0), end: at(8) },
        { start: at(4), end: at(12) },
      ),
    ).toBe('400');
  });

  it('an empty plan period or no overlap gives no target share', () => {
    expect(
      sliceTarget(
        '800',
        { start: at(8), end: at(8) },
        { start: at(0), end: at(8) },
      ),
    ).toBe('0');
    expect(
      sliceTarget(
        '800',
        { start: at(0), end: at(8) },
        { start: at(8), end: at(9) },
      ),
    ).toBe('0');
  });
});
