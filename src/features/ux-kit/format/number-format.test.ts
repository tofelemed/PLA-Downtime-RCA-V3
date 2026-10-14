import { describe, expect, it } from 'vitest';
import { formatCount, formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { formatMoney, formatRatioPercent } from '@/features/plan-dashboard/model/display';
import { formatDecimal, formatNumber, parseDecimalInput } from './decimal';

describe('formatDecimal in the plant digits', () => {
  it('formats API decimal strings with Latin digits and separators by default', () => {
    expect(formatDecimal('12345.678')).toBe('12,345.68');
    expect(formatDecimal('-1234567.5', 0)).toBe('-1,234,568');
    expect(formatDecimal('0.004', 2)).toBe('0.00');
  });

  it('uses Persian digits with ٫ and ٬ when the plant shows Persian digits', () => {
    expect(formatDecimal('12345.678', 2, 'persian')).toBe('۱۲٬۳۴۵٫۶۸');
    expect(formatDecimal('-1234567.5', 0, 'persian')).toBe('-۱٬۲۳۴٬۵۶۸');
    expect(formatDecimal('7', 2, 'persian')).toBe('۷٫۰۰');
  });

  it('shows "—" for an absent value in either digit system', () => {
    expect(formatDecimal(null, 2, 'persian')).toBe('—');
    expect(formatDecimal(undefined)).toBe('—');
    expect(formatDecimal('  ', 2, 'persian')).toBe('—');
    expect(formatNumber(null, 0, 'persian')).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('formats JS numbers (counts, chart ticks) without the browser locale', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234, 0, 'persian')).toBe('۱٬۲۳۴');
    expect(formatNumber(-2.5, 1, 'persian')).toBe('-۲٫۵');
  });
});

describe('feature number helpers follow the digits', () => {
  it('counts, ratios and percentages', () => {
    expect(formatCount('1234.0000000000', 'persian')).toBe('۱٬۲۳۴');
    expect(formatRatio('0.875', 1, 'persian')).toBe('۸۷٫۵ %');
    expect(formatRatio('0.875')).toBe('87.5 %');
    expect(formatRatioPercent('0.875', 'persian')).toBe('۸۷٫۵ %');
    expect(formatRatio(null, 1, 'persian')).toBe('—');
  });

  it('money keeps the currency code as an identifier', () => {
    expect(formatCurrencyAmount('1234567.5', 'IRR', 'persian')).toBe('۱٬۲۳۴٬۵۶۸ IRR');
    expect(formatCurrencyAmount('1234.5', 'USD')).toBe('1,234.50 USD');
    expect(formatMoney({ amount: '-1234.5', nativeAmount: '-1234.5', currency: 'USD', status: 'valued', reasons: [] }, 'persian')).toBe('-۱٬۲۳۴٫۵۰ USD');
  });
});

describe('parseDecimalInput', () => {
  it('stays Latin and accepts Persian digits typed by the user', () => {
    expect(parseDecimalInput('1,234.5')).toEqual({ value: '1234.5', error: null });
    expect(parseDecimalInput('۱٬۲۳۴٫۵')).toEqual({ value: '1234.5', error: null });
    expect(parseDecimalInput('۱۲.۵')).toEqual({ value: '12.5', error: null });
  });
});
