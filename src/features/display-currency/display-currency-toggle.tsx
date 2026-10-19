import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { cn } from '@/lib/utils';
import { DISPLAY_CURRENCIES, isDisplayCurrency } from './display-currency-store';
import { useDisplayCurrency } from './use-display-currency';

const LABELS = { USD: '$ USD', IRR: 'IRR' } as const;

/**
 * Compact USD / IRR switch for the money shown on every valuation screen (a view preference only); not
 * shown to roles without money (owner 19 Oct 2026: operators).
 */
export function DisplayCurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  if (!canViewMoney) return null;
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={currency}
      onValueChange={(next) => {
        if (isDisplayCurrency(next)) setCurrency(next);
      }}
      aria-label="Display currency"
      data-testid="display-currency-toggle"
      className={cn('gap-0', className)}
    >
      {DISPLAY_CURRENCIES.map((code) => (
        <ToggleGroupItem key={code} value={code} aria-label={`Show money in ${code}`} className="h-8 whitespace-nowrap px-2 text-xs" data-testid={`display-currency-${code}`}>
          {LABELS[code]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
