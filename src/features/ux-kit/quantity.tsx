import { useNumberFormat } from './use-number-format';

export interface QuantityProps {
  /** decimal string from the API */
  value: string | null | undefined;
  /** unit of measure; a quantity is never shown without one */
  uom: string | null | undefined;
  fractionDigits?: number;
  className?: string;
}

/** `1,234.50 t` — a decimal string with its explicit unit; a missing unit is flagged, not guessed.
 * Digits and separators follow the plant's digits setting; the hover shows the API value as sent. */
export function Quantity({ value, uom, fractionDigits = 2, className }: QuantityProps) {
  const text = useNumberFormat().decimal(value, fractionDigits);
  return (
    <span className={className} title={value ?? undefined}>
      {text}
      {text !== '—' &&
        (uom ? (
          <span className="ml-1 text-muted-foreground">{uom}</span>
        ) : (
          <span className="ml-1 text-amber-600" title="The source did not state a unit">
            (unit unknown)
          </span>
        ))}
    </span>
  );
}
