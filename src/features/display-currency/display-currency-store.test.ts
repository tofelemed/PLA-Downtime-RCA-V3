import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_CURRENCY, isDisplayCurrency, loadDisplayCurrency, saveDisplayCurrency } from './display-currency-store';

describe('display currency store', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to USD', () => {
    expect(DEFAULT_DISPLAY_CURRENCY).toBe('USD');
    expect(loadDisplayCurrency('u1')).toBe('USD');
    expect(loadDisplayCurrency(null)).toBe('USD');
  });

  it('keeps one preference per user', () => {
    saveDisplayCurrency('u1', 'IRR');
    expect(loadDisplayCurrency('u1')).toBe('IRR');
    expect(loadDisplayCurrency('u2')).toBe('USD');
    saveDisplayCurrency('u1', 'USD');
    expect(loadDisplayCurrency('u1')).toBe('USD');
  });

  it('ignores unknown stored values and does not save without a user', () => {
    window.localStorage.setItem('proact.displayCurrency.u1', 'EUR');
    expect(loadDisplayCurrency('u1')).toBe('USD');
    saveDisplayCurrency(null, 'IRR');
    expect(window.localStorage.length).toBe(1);
  });

  it('accepts only the reporting currencies', () => {
    expect(isDisplayCurrency('USD')).toBe(true);
    expect(isDisplayCurrency('IRR')).toBe(true);
    expect(isDisplayCurrency('usd')).toBe(false);
    expect(isDisplayCurrency(null)).toBe(false);
  });
});
