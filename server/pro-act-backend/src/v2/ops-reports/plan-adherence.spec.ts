import { planAdherence } from './plan-adherence';
import { ProductionRowView } from './production-by-product';

const day = (
  key: string,
  target: string | null,
  actual: string | null,
  product = 'p1',
): ProductionRowView => ({
  key,
  productId: product,
  productCode: product === 'p1' ? 'HD5218' : 'EX3',
  productName: null,
  uom: 't',
  capacity: null,
  target,
  actual,
  gross: null,
  good: null,
  prime: null,
  wideSpec: null,
  downgrade: null,
  transitionOffGrade: null,
  scrap: null,
  rework: null,
  unclassified: null,
  recovered: null,
  offGrade: null,
  primeYield: null,
  planAttainment: null,
  slices: 1,
  completeSlices: 1,
});

describe('plan adherence (R11)', () => {
  it('caps each day at its target: overproduction one day never makes up for a short day', () => {
    const [row] = planAdherence([
      day('2027-03-01', '100', '130'),
      day('2027-03-02', '100', '70'),
      day('2027-03-03', '100', null),
      day('2027-03-04', null, '50'),
    ]);
    expect(row).toMatchObject({
      plannedDays: 3,
      ranAsPlannedDays: 2,
      missedDays: 1,
      unplannedDays: 1,
      target: '300',
      actual: '250',
      volumeAdherence: '0.56666667',
      dayAdherence: '0.66666667',
    });
    expect(row.attainment).toBe('0.83333333');
  });

  it('one row per product, products in code order; no plan → no ratios', () => {
    const rows = planAdherence([
      day('2027-03-01', null, '40', 'p2'),
      day('2027-03-01', '10', '10'),
    ]);
    expect(rows.map((r) => r.productCode)).toEqual(['EX3', 'HD5218']);
    expect(rows[0]).toMatchObject({
      attainment: null,
      volumeAdherence: null,
      dayAdherence: null,
      unplannedDays: 1,
    });
  });
});
