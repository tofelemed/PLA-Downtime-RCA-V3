import { Dec } from '../actuals/decimal';
import {
  combineUncertainty,
  UncertaintyBudgetError,
  UncertaintyComponent,
} from './uncertainty-budget';

const reading = (
  u: string,
  sensitivity = '1',
  kind: UncertaintyComponent['kind'] = 'meter',
): UncertaintyComponent => ({
  kind,
  label: `${kind} ${u}`,
  standardUncertainty: new Dec(u),
  sensitivity: new Dec(sensitivity),
});

describe('combineUncertainty (SME E4, NIST TN 1297 §5)', () => {
  it('two independent 3 t readings: u_c = 4.24 t, U (k = 2) ≈ 8.5 t', () => {
    const result = combineUncertainty([reading('3'), reading('3', '-1')], []);
    expect(result.combinedVariance).toBe('18');
    expect(result.combinedStandardUncertainty).toBe('4.24264069');
    expect(result.coverageFactor).toBe('2');
    expect(result.expandedUncertainty).toBe('8.48528137');
    expect(result.contributions.map((c) => c.shareOfVariance)).toEqual([
      '0.5',
      '0.5',
    ]);
  });

  it('covariance: a correlated difference shrinks, a correlated sum grows', () => {
    const difference = combineUncertainty(
      [reading('3'), reading('3', '-1')],
      [{ a: 0, b: 1, coefficient: new Dec('0.5') }],
    );
    expect(difference.covarianceTerm).toBe('-9');
    expect(difference.combinedStandardUncertainty).toBe('3');
    const sum = combineUncertainty(
      [reading('3'), reading('4', '1', 'inventory')],
      [{ a: 0, b: 1, coefficient: new Dec('1') }],
    );
    expect(sum.combinedStandardUncertainty).toBe('7');
  });

  it('all five component kinds and a coverage factor of 3', () => {
    const result = combineUncertainty(
      [
        reading('2', '1', 'meter'),
        reading('1', '-1', 'scale'),
        reading('2', '-1', 'inventory'),
        reading('0.5', '1', 'conversion'),
        reading('0.5', '1', 'timing'),
      ],
      [],
      new Dec(3),
    );
    expect(result.combinedVariance).toBe('9.5');
    expect(result.combinedStandardUncertainty).toBe('3.082207');
    expect(result.expandedUncertainty).toBe('9.246621');
  });

  it('refuses inconsistent budgets instead of computing around them', () => {
    expect(() => combineUncertainty([], [])).toThrow(UncertaintyBudgetError);
    expect(() => combineUncertainty([reading('-1')], [])).toThrow(
      UncertaintyBudgetError,
    );
    expect(() => combineUncertainty([reading('1')], [], new Dec(0))).toThrow(
      UncertaintyBudgetError,
    );
    expect(() =>
      combineUncertainty(
        [reading('1'), reading('1')],
        [{ a: 0, b: 1, coefficient: new Dec('1.2') }],
      ),
    ).toThrow(UncertaintyBudgetError);
    expect(() =>
      combineUncertainty(
        [reading('1'), reading('1')],
        [{ a: 0, b: 0, coefficient: new Dec('0.2') }],
      ),
    ).toThrow(UncertaintyBudgetError);
    expect(() =>
      combineUncertainty(
        [reading('1'), reading('1'), reading('1')],
        [
          { a: 0, b: 1, coefficient: new Dec('-1') },
          { a: 0, b: 2, coefficient: new Dec('-1') },
          { a: 1, b: 2, coefficient: new Dec('-1') },
        ],
      ),
    ).toThrow(/negative/);
  });
});
