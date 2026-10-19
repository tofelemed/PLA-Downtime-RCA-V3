import type { DigitSystem } from '@/lib/dates';
import { formatDecimal } from './decimal';

/**
 * The one separator between a figure and its unit or currency (QA: "28.00t", "4,200.00USD"): a space,
 * kept inside the figure's own text so it never collapses between inline elements.
 */
export const UNIT_SEPARATOR = ' ';

/** `"28.00", "t"` → `"28.00 t"`; no unit, or no figure ("—"), leaves the figure as it is. */
export function withUnit(figure: string, unit: string | null | undefined): string {
  if (!unit || figure === '—') return figure;
  return `${figure}${UNIT_SEPARATOR}${unit}`;
}

/** A decimal string with its unit of measure: `"28", "t"` → `"28.00 t"`; null → "—". */
export function formatQuantity(value: string | null | undefined, uom: string | null | undefined, fractionDigits = 2, digits?: DigitSystem): string {
  return withUnit(formatDecimal(value, fractionDigits, digits), uom);
}
