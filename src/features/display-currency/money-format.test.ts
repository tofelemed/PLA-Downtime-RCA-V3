import { describe, expect, it } from 'vitest';
import type { CurrencyValueView } from '@/api/v2/types/period-overview';
import { formatMoney } from '@/features/plan-dashboard/model/display';
import { currencyDigits, entriesInCurrency, formatCurrencyAmount } from './money-format';

describe('money format', () => {
  it('shows IRR without decimals and USD with two, grouped by thousands', () => {
    expect(formatCurrencyAmount('3456789012.5', 'IRR')).toBe('3,456,789,013 IRR');
    expect(formatCurrencyAmount('1285.123', 'USD')).toBe('1,285.12 USD');
    expect(formatCurrencyAmount('1285.125', 'USD')).toBe('1,285.13 USD');
    expect(formatCurrencyAmount('-0.004', 'USD')).toBe('0.00 USD');
  });

  it('uses two digits for other units', () => {
    expect(currencyDigits('IRR')).toBe(0);
    expect(currencyDigits('USD')).toBe(2);
    expect(currencyDigits('t')).toBe(2);
    expect(currencyDigits(null)).toBe(2);
  });

  it('formats valuation totals the same way and never shows a missing amount as 0', () => {
    const irr: CurrencyValueView = { currency: 'IRR', amount: '2690000000.4', nativeAmount: '0', status: 'valued', reasons: [] };
    const usd: CurrencyValueView = { currency: 'USD', amount: null, nativeAmount: '0', status: 'unvalued', reasons: ['fx_rate_missing'] };
    expect(formatMoney(irr)).toBe('2,690,000,000 IRR');
    expect(formatMoney(usd)).toBe('— USD (FX rate missing)');
  });
});

describe('entriesInCurrency', () => {
  const rows = [
    { currency: 'IRR', amount: '2690000' },
    { currency: 'USD', amount: '1' },
  ];

  it('selects the server entry of the display currency without converting', () => {
    expect(entriesInCurrency(rows, (r) => r.currency, 'USD')).toEqual([{ currency: 'USD', amount: '1' }]);
    expect(entriesInCurrency(rows, (r) => r.currency, 'IRR')).toEqual([{ currency: 'IRR', amount: '2690000' }]);
  });

  it('keeps every entry when the server has none in the display currency', () => {
    expect(entriesInCurrency([rows[0]], (r) => r.currency, 'USD')).toEqual([rows[0]]);
    expect(entriesInCurrency([], (r: { currency: string }) => r.currency, 'USD')).toEqual([]);
  });
});
