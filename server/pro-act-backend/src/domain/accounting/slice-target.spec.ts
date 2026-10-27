import { sliceTarget, windowTarget } from './slice-target';

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

describe('windowTarget (declared day over shift plan periods)', () => {
  const shift = (from: number, target: string) => ({
    start: at(from),
    end: at(from + 8),
    target,
  });

  it('a day slice over three shift plan periods carries the sum of their targets', () => {
    const day = { start: at(0), end: at(24) };
    expect(
      windowTarget([shift(0, '100'), shift(8, '120'), shift(16, '80.5')], day),
    ).toBe('300.5');
  });

  it('a plan period reaching past the day counts pro rata', () => {
    const day = { start: at(2), end: at(26) };
    expect(
      windowTarget(
        [shift(0, '80'), shift(8, '80'), shift(16, '80'), shift(24, '80')],
        day,
      ),
    ).toBe('240');
  });

  it('one plan period behaves as sliceTarget; none gives no target', () => {
    expect(windowTarget([shift(0, '720')], { start: at(6), end: at(8) })).toBe(
      '180',
    );
    expect(windowTarget([], { start: at(0), end: at(8) })).toBeNull();
  });
});
