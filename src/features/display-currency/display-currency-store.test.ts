import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_CURRENCY, DISPLAY_CURRENCY_SWITCH_ENABLED, isDisplayCurrency, loadDisplayCurrency, saveDisplayCurrency } from './display-currency-store';

describe('display currency store', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to USD', () => {
    expect(DEFAULT_DISPLAY_CURRENCY).toBe('USD');
    expect(loadDisplayCurrency('u1')).toBe('USD');
    expect(loadDisplayCurrency(null)).toBe('USD');
  });

  it('shows USD and leaves the saved choice untouched while the switch is off', () => {
    expect(DISPLAY_CURRENCY_SWITCH_ENABLED).toBe(false);
    window.localStorage.setItem('proact.displayCurrency.u1', 'IRR');
    expect(loadDisplayCurrency('u1')).toBe('USD');
    expect(window.localStorage.getItem('proact.displayCurrency.u1')).toBe('IRR');
  });

  it('does not save without a user', () => {
    saveDisplayCurrency(null, 'IRR');
    expect(window.localStorage.length).toBe(0);
  });

  it('accepts only the reporting currencies', () => {
    expect(isDisplayCurrency('USD')).toBe(true);
    expect(isDisplayCurrency('IRR')).toBe(true);
    expect(isDisplayCurrency('usd')).toBe(false);
    expect(isDisplayCurrency(null)).toBe(false);
  });
});
