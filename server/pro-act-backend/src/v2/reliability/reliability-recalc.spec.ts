import { windowsByUnit } from './reliability-recalc';

const at = (hour: number) => new Date(Date.UTC(2027, 2, 3, hour));

describe('reliability recalculation windows', () => {
  it('one window per unit from the earliest start to the latest end', () => {
    expect(
      windowsByUnit([
        { unitId: 'u2', start: at(5), end: at(6) },
        { unitId: 'u1', start: at(3), end: at(4) },
        { unitId: 'u1', start: at(1), end: at(2) },
      ]),
    ).toEqual([
      { unitId: 'u1', from: at(1), to: at(4) },
      { unitId: 'u2', from: at(5), to: at(6) },
    ]);
  });

  it('an open span runs the window up to now (to null), whatever comes after', () => {
    expect(
      windowsByUnit([
        { unitId: 'u1', start: at(3), end: at(4) },
        { unitId: 'u1', start: at(2), end: null },
        { unitId: 'u1', start: at(1), end: at(9) },
      ]),
    ).toEqual([{ unitId: 'u1', from: at(1), to: null }]);
  });

  it('no spans → no request', () => {
    expect(windowsByUnit([])).toEqual([]);
  });
});
