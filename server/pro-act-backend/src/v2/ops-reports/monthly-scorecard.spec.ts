import { toOutput } from './monthly-scorecard';

describe('monthly scorecard (R12)', () => {
  it('utilisation = good / capacity, loss share = (capacity − good) / capacity, attainment = actual / target', () => {
    expect(
      toOutput({
        month: '2027-03',
        uom: 't',
        capacity: '3000.00000000',
        good: '2550',
        target: '2700',
        actual: '2550',
      }),
    ).toEqual({
      uom: 't',
      capacity: '3000',
      good: '2550',
      target: '2700',
      actual: '2550',
      utilisation: '0.85',
      lossShare: '0.15',
      planAttainment: '0.94444444',
    });
  });

  it('never divides without a capacity or target', () => {
    expect(
      toOutput({
        month: '2027-03',
        uom: 't',
        capacity: null,
        good: '10',
        target: null,
        actual: '10',
      }),
    ).toMatchObject({
      utilisation: null,
      lossShare: null,
      planAttainment: null,
    });
  });
});
