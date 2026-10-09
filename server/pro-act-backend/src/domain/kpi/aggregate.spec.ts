import { Dec } from '../actuals/decimal';
import { combine, groupTerms, StoredKpi } from './aggregate';

const row = (
  numerator: string | null,
  denominator: string | null,
  extra: Partial<StoredKpi> = {},
): StoredKpi => ({
  numerator: numerator === null ? null : new Dec(numerator),
  denominator: denominator === null ? null : new Dec(denominator),
  value:
    numerator !== null && denominator !== null && denominator !== '0'
      ? new Dec(numerator).div(denominator)
      : null,
  quality: 'ok',
  reason: null,
  policyId: 'p1',
  ...extra,
});

describe('KPI aggregation (AN03)', () => {
  it('a period without terms is missing: the rest is combined and marked provisional', () => {
    const result = combine(
      'oee',
      groupTerms('oee', [
        row('10800', '28800'),
        row(null, '28800', { reason: 'actuals_missing' }),
      ]),
    );
    expect(result).toMatchObject({
      quality: 'provisional',
      reason: 'incomplete_periods',
      missing: 1,
    });
    expect(result.value?.toFixed()).toBe('0.375');
  });

  it('no complete row → null with the stored reasons, never zero', () => {
    const result = combine(
      'oee',
      groupTerms('oee', [row(null, null, { reason: 'no_slices' })]),
    );
    expect(result).toMatchObject({
      value: null,
      quality: 'unavailable',
      reason: 'no_slices',
    });
  });

  it('MTBF sums exposure and failures; zero failures keeps the exposure', () => {
    const none = combine(
      'mtbf',
      groupTerms('mtbf', [row('25200', '0'), row('28800', '0')]),
    );
    expect(none).toMatchObject({ value: null, reason: 'no_failures' });
    expect(none.numerator?.toFixed()).toBe('54000');
    const some = combine(
      'mtbf',
      groupTerms('mtbf', [row('25200', '1'), row('28800', '0')]),
    );
    expect(some.value?.toFixed()).toBe('54000');
  });

  it('amounts are summed; ratios above 1 stay exceptions', () => {
    const amount = combine(
      'downtime_total',
      groupTerms('downtime_total', [row('60', null), row('30', null)]),
    );
    expect(amount.value?.toFixed()).toBe('90');
    const above = combine(
      'performance',
      groupTerms('performance', [row('30000', '28800')]),
    );
    expect(above).toMatchObject({
      quality: 'exception',
      reason: 'above_100_percent',
    });
  });
});
