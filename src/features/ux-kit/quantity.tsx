import { UNIT_SEPARATOR } from './format/units';
import { useNumberFormat } from './use-number-format';

export interface QuantityProps {
  /** decimal string from the API */
  value: string | null | undefined;
  /** unit of measure; a quantity is never shown without one */
  uom: string | null | undefined;
  fractionDigits?: number;
  className?: string;
}

/** `1,234.50 t` / `4,200.00 USD` — a decimal string with its explicit unit, separated by a real space (so copied
 * and read-aloud text is "28.00 t", never "28.00t"); a missing unit is flagged, not guessed.
 * Digits and separators follow the plant's digits setting; the hover shows the API value as sent. */
export function Quantity({ value, uom, fractionDigits = 2, className }: QuantityProps) {
  const text = useNumberFormat().decimal(value, fractionDigits);
  return (
    <span className={className} title={value ?? undefined}>
      {text === '—' ? text : `${text}${UNIT_SEPARATOR}`}
      {text !== '—' &&
        (uom ? (
          <span className="text-muted-foreground">{uom}</span>
        ) : (
          <span className="text-warning" title="The source did not state a unit">
            (unit unknown)
          </span>
        ))}
    </span>
  );
}
