import { createLogger } from '@/lib/logger';

const log = createLogger('display-currency');
const KEY_PREFIX = 'proact.displayCurrency.';

/** Reporting currencies the user can choose to see (D08); the server values every line in both. */
export const DISPLAY_CURRENCIES = ['USD', 'IRR'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Owner decision (2026-10-10): money is shown in US dollars unless the user picks IRR. */
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'USD';

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

/**
 * The display currency is a per-user view preference kept in this browser under the user's id (like the
 * plant selection); without a user, or with an unreadable value, it is the default.
 */
export function loadDisplayCurrency(userId: string | null): DisplayCurrency {
  if (!userId) return DEFAULT_DISPLAY_CURRENCY;
  try {
    const saved = window.localStorage.getItem(KEY_PREFIX + userId);
    return isDisplayCurrency(saved) ? saved : DEFAULT_DISPLAY_CURRENCY;
  } catch (error: unknown) {
    log.warn('Ignoring unreadable display currency', error);
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

export function saveDisplayCurrency(userId: string | null, currency: DisplayCurrency): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, currency);
  } catch (error: unknown) {
    log.warn('Could not save display currency', error);
  }
}
