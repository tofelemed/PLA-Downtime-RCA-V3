import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { DISPLAY_CURRENCIES, isDisplayCurrency } from './display-currency-store';
import { useDisplayCurrency } from './use-display-currency';

const LABELS = { USD: '$ USD', IRR: 'IRR' } as const;

/** Compact USD / IRR switch for the money shown on every valuation screen (a view preference only). */
export function DisplayCurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useDisplayCurrency();
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
