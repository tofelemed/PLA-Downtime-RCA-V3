import { useContext } from 'react';
import { DisplayCurrencyContext, type DisplayCurrencyValue } from './display-currency-context';

/** The currency money is shown in (default USD) and its setter. */
export function useDisplayCurrency(): DisplayCurrencyValue {
  return useContext(DisplayCurrencyContext);
}
