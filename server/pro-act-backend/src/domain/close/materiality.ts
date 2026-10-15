import { Dec, formatDec } from '../actuals/decimal';
import { MaterialityRule } from './month-close-policy';

/** Σ |quantity| of a month's approved adjustment lines in one unit of measure (decimal string). */
export interface AdjustmentTotal {
  uom: string | null;
  quantity: string;
}

export interface MaterialityFinding {
  uom: string;
  quantity: string;
  threshold: string;
}

/** Kinds that adjust instead of explaining a loss (SME R1: "material manual adjustments"). */
export const MATERIAL_KINDS = [
  'bridge',
  'unaccounted_classified',
  'tolerance_adjustment',
  // SME R9: a reversal changes an approved figure of an earlier period
  'reversal',
] as const;

/**
 * The units of measure whose adjustment total reaches the rule's threshold (SME R1 materiality routing).
 * A disabled rule, or a unit of measure without a threshold, never routes; quantities of different units
 * are never added.
 */
export function materialityFindings(
  totals: readonly AdjustmentTotal[],
  rule: MaterialityRule,
): MaterialityFinding[] {
  if (!rule.enabled) return [];
  return totals.flatMap((total) => {
    const threshold = total.uom ? rule.thresholds[total.uom] : undefined;
    if (threshold === undefined || !total.uom) return [];
    const quantity = new Dec(total.quantity).abs();
    if (quantity.lt(threshold)) return [];
    return [
      {
        uom: total.uom,
        quantity: formatDec(quantity),
        threshold: formatDec(new Dec(threshold)),
      },
    ];
  });
}
