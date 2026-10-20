import { ratio, toProductionRow } from './production-by-product';

const row = {
  group_key: 'total',
  product_id: 'p1',
  product_code: 'HD5218',
  product_name: 'Film grade',
  uom: 't',
  slices: 3,
  complete_slices: 2,
  capacity: '3000.00000000',
  target: '3000.00000000',
  actual: '2550.00000000',
  gross: '2600',
  good: '2550',
  prime: '2500',
  wideSpec: '50',
  downgrade: '30',
  transitionOffGrade: '20',
  scrap: '0',
  rework: '0',
  unclassified: null,
  recovered: '0',
  offGrade: '50',
};

describe('production by product (R1)', () => {
  it('divides the sums: prime yield = prime / gross, attainment = actual / target', () => {
    const view = toProductionRow(row);
    expect(view).toMatchObject({
      key: 'total',
      productCode: 'HD5218',
      target: '3000',
      actual: '2550',
      offGrade: '50',
      unclassified: null,
      planAttainment: '0.85',
      slices: 3,
      completeSlices: 2,
    });
    expect(view.primeYield).toBe('0.96153846');
  });

  it('never divides by a missing or zero base', () => {
    expect(ratio('10', null)).toBeNull();
    expect(ratio(null, '10')).toBeNull();
    expect(ratio('10', '0')).toBeNull();
    expect(ratio('5', '10')).toBe('0.5');
  });
});
