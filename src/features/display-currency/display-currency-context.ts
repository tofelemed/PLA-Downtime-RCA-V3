import { createContext } from 'react';
import { DEFAULT_DISPLAY_CURRENCY, type DisplayCurrency } from './display-currency-store';

export interface DisplayCurrencyValue {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
}

/** Outside the provider (isolated renders, tests) money shows in the default currency and cannot change. */
export const DisplayCurrencyContext = createContext<DisplayCurrencyValue>({
  currency: DEFAULT_DISPLAY_CURRENCY,
  setCurrency: () => undefined,
});
