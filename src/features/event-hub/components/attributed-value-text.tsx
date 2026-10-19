import type { AttributedValueView } from '@/api/v2/types/events';
import { currencyDigits } from '@/features/display-currency/money-format';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';

/**
 * One currency's value of an attributed loss, as the server states it: the amount, or in words why there
 * is none (no line valued / some lines without a value), plus a provisional exchange rate when one was used.
 */
export function AttributedValueText({ value }: { value: AttributedValueView }) {
  const { number } = useNumberFormat();
  const total = value.valuedLines + value.unvaluedLines;
  return (
    <span data-testid="attributed-value" data-status={value.status}>
      {value.amount !== null ? (
        <Quantity value={value.amount} uom={value.currency} fractionDigits={currencyDigits(value.currency)} />
      ) : value.status === 'unvalued' ? (
        <span className="text-muted-foreground">Not valued in {value.currency} (no line has a value yet)</span>
      ) : (
        <span className="text-muted-foreground">
          Not fully valued in {value.currency} ({number(value.unvaluedLines)} of {number(total)} lines without a value)
        </span>
      )}
      {value.fxProvisional && (
        <span className="ml-1 text-xs text-warning" data-testid="attributed-fx-provisional">
          (provisional exchange rate on {plural(value.provisionalLines, 'line', 'lines', number)})
        </span>
      )}
    </span>
  );
}
