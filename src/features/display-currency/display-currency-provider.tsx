import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DisplayCurrencyContext } from './display-currency-context';
import { DISPLAY_CURRENCY_SWITCH_ENABLED, loadDisplayCurrency, saveDisplayCurrency, type DisplayCurrency } from './display-currency-store';

/** The signed-in user's display currency (USD unless they chose IRR), kept per user in this browser. */
export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [currency, setState] = useState<DisplayCurrency>(() => loadDisplayCurrency(userId));

  useEffect(() => {
    setState(loadDisplayCurrency(userId));
  }, [userId]);

  const setCurrency = useCallback(
    (next: DisplayCurrency) => {
      if (!DISPLAY_CURRENCY_SWITCH_ENABLED) return;
      setState(next);
      saveDisplayCurrency(userId, next);
    },
    [userId],
  );

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}
