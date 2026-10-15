import * as fs from 'fs';
import * as path from 'path';
import { Dec } from '../../src/domain/actuals/decimal';
import {
  combineUncertainty,
  UncertaintyComponent,
} from '../../src/domain/uncertainty/uncertainty-budget';
import { RECONCILIATION_TOLERANCE_DEFAULT } from '../../src/periods/engine-policy-bodies';

/**
 * UB01 (SME E4): the uncertainty budget maths of a reconciliation boundary, decimal to 8 places — the SME
 * worked example (√(3² + 3²) = 4.24 t, U = 8.5 t at k = 2) and a five-component budget with covariance.
 * The budget justifies a tolerance; the seeded tolerance stays zero (never auto-enabled).
 */
type Expected = Record<string, string>;
const ub01 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'UB01.json'), 'utf8'),
) as { expected: Record<string, Expected> };
const want = (key: string) => ub01.expected[key];

const component = (
  kind: UncertaintyComponent['kind'],
  u: string,
  c: string,
): UncertaintyComponent => ({
  kind,
  label: kind,
  standardUncertainty: new Dec(u),
  sensitivity: new Dec(c),
});

describe('UB01 uncertainty budget (SME E4)', () => {
  it('two independent 3 t readings: 4.24 t combined, about 8.5 t expanded', () => {
    const expected = want('smeExample');
    const result = combineUncertainty(
      [component('meter', '3', '1'), component('scale', '3', '-1')],
      [],
      new Dec(2),
    );
    expect(result.combinedVariance).toBe(expected.combinedVariance);
    expect(result.combinedStandardUncertainty).toBe(
      expected.combinedStandardUncertainty,
    );
    expect(result.expandedUncertainty).toBe(expected.expandedUncertainty);
  });

  it('reactor-to-packing budget with a correlated inventory conversion', () => {
    const expected = want('fullBudget');
    const result = combineUncertainty(
      [
        component('meter', '1.5', '1'),
        component('scale', '0.8', '-1'),
        component('inventory', '2.0', '-1'),
        component('conversion', '0.6', '1'),
        component('timing', '0.4', '1'),
      ],
      [{ a: 2, b: 3, coefficient: new Dec('0.5') }],
    );
    const squares = new Dec(result.combinedVariance).minus(
      result.covarianceTerm,
    );
    expect(squares.toFixed()).toBe(expected.sumOfSquares);
    expect(result.covarianceTerm).toBe(expected.covarianceTerm);
    expect(result.combinedVariance).toBe(expected.combinedVariance);
    expect(result.combinedStandardUncertainty).toBe(
      expected.combinedStandardUncertainty,
    );
    expect(result.expandedUncertainty).toBe(expected.expandedUncertainty);
    expect(result.contributions[2].shareOfVariance).toBe(
      expected.inventoryShareOfVariance,
    );
  });

  it('the seeded reconciliation tolerance stays zero: a budget never enables one by itself', () => {
    const expected = want('toleranceDefault');
    expect(RECONCILIATION_TOLERANCE_DEFAULT.mode).toBe(expected.mode);
    expect(String(RECONCILIATION_TOLERANCE_DEFAULT.value)).toBe(expected.value);
    expect(RECONCILIATION_TOLERANCE_DEFAULT).not.toHaveProperty(
      'uncertaintyBudgetId',
    );
  });
});
