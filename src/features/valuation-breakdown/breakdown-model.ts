import type { EconomicComponentGroupView, EconomicComponentValueView } from '@/api/v2/types/period-overview';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { ECONOMIC_COMPONENT_LABELS, humanize } from '@/features/ux-kit/labels';
import type { DigitSystem } from '@/lib/dates';

/** One row of the economic breakdown in the display currency (the server values every currency). */
export interface BreakdownRow {
  key: string;
  label: string;
  value: EconomicComponentValueView | null;
  quantities: EconomicComponentGroupView['quantities'];
}

/** The display currency when the server reports it, else the first reported one (nothing is converted). */
export function shownCurrency(groups: readonly EconomicComponentGroupView[], display: string): string {
  const reported = [...new Set(groups.flatMap((g) => g.currencies.map((c) => c.currency)))].sort();
  return reported.includes(display) || reported.length === 0 ? display : reported[0];
}

export const componentLabel = (key: string) => ECONOMIC_COMPONENT_LABELS[key] ?? humanize(key);

/** The rows in the server's order, each with its entry in `currency` (none when the server has none). */
export function breakdownRows(groups: readonly EconomicComponentGroupView[], currency: string): BreakdownRow[] {
  return groups.map((group) => ({
    key: group.key,
    label: componentLabel(group.key),
    value: group.currencies.find((c) => c.currency === currency) ?? null,
    quantities: group.quantities,
  }));
}

/** `1,234.57 USD`; a missing amount says why (FX rate missing, not valued), never 0. */
export function breakdownMoney(value: EconomicComponentValueView | null, currency: string, digits?: DigitSystem): string {
  if (!value) return `— ${currency}`;
  if (value.amount !== null) return formatCurrencyAmount(value.amount, value.currency, digits);
  const why = value.reasons.includes('fx_rate_missing') ? 'FX rate missing' : 'not valued';
  return `— ${value.currency} (${why})`;
}

/** Status words shown with a value: partly valued, provisional FX. */
export function breakdownStatus(value: EconomicComponentValueView | null): string | null {
  if (!value) return null;
  const parts = [value.status === 'mixed' ? 'partly valued' : null, value.fxProvisional ? 'provisional FX rate' : null];
  const shown = parts.filter((p): p is string => p !== null);
  return shown.length > 0 ? shown.join(' · ') : null;
}
