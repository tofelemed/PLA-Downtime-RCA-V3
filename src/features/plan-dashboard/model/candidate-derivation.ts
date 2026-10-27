import type { AppliedRateView, CandidateDerivationView, CandidateView, DerivationRateView } from '@/api/v2/types/reconciliation';
import { humanize } from '@/features/ux-kit/labels';

const DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/**
 * A 0..1 share decimal string from the server as a percentage decimal string (`"0.125"` → `"12.5"`):
 * the decimal point moves two places in the text, no floating-point arithmetic. Malformed → null.
 */
export function shareAsPercent(share: string): string | null {
  const match = DECIMAL.exec(share.trim());
  if (!match || (match[2] === '' && !match[3])) return null;
  const [, sign, int, frac = ''] = match;
  const padded = frac.padEnd(2, '0');
  const whole = `${int}${padded.slice(0, 2)}`.replace(/^0+(?=\d)/, '') || '0';
  const rest = padded.slice(2).replace(/0+$/, '');
  return `${sign}${whole}${rest ? `.${rest}` : ''}`;
}

/** An engine flag as words; a flag carrying an identifier (`origin_unit:<id>`) shows only its name. */
export function derivationFlagLabel(flag: string): string {
  const name = flag.includes(':') ? flag.slice(0, flag.indexOf(':')) : flag;
  return humanize(name);
}

const DECLARED_SHORTFALL_PREFIX = 'declared_shortfall:';
const STOPS_CROSS_CHECK_PREFIX = 'stops_cross_check:';

/** The shortfall the declared line was booked from (`declared_shortfall:<q>`); the flag value is data, not a label. */
export function declaredShortfallOf(flags: readonly string[]): string | null {
  const flag = flags.find((f) => f.startsWith(DECLARED_SHORTFALL_PREFIX));
  return flag ? flag.slice(DECLARED_SHORTFALL_PREFIX.length) || null : null;
}

/** The recorded stops' quantity next to the declared loss (`stops_cross_check:<qty>:<uom>`), when the slice carries it. */
export function stopsCrossCheckOf(flags: readonly string[]): { quantity: string; uom: string | null } | null {
  const flag = flags.find((f) => f.startsWith(STOPS_CROSS_CHECK_PREFIX));
  if (!flag) return null;
  const [quantity, uom] = flag.slice(STOPS_CROSS_CHECK_PREFIX.length).split(':');
  return quantity ? { quantity, uom: uom || null } : null;
}

/** Value-carrying flags are shown as data elsewhere, so they are not repeated as labels. */
export function isDataFlag(flag: string): boolean {
  return flag.startsWith(DECLARED_SHORTFALL_PREFIX) || flag.startsWith(STOPS_CROSS_CHECK_PREFIX);
}

/** Both quantities are the server's; the effective one is shown only when its text differs. */
export function effectiveDiffers(candidate: Pick<CandidateView, 'quantity' | 'effectiveQuantity'>): boolean {
  return candidate.effectiveQuantity !== null && candidate.effectiveQuantity !== candidate.quantity;
}

/**
 * Which rate text a derivation shows (UX D-2): the stored applied rate with the planning rate it was scaled
 * from; for runs before the applied rate was stored, only that the rate was scaled; else the rate version.
 */
export type RateDisplay =
  | { mode: 'scaled'; applied: AppliedRateView; planning: DerivationRateView | null }
  | { mode: 'scaled-unstored' }
  | { mode: 'version'; rate: DerivationRateView }
  | { mode: 'none' };

export function rateDisplayOf(derivation: Pick<CandidateDerivationView, 'rate' | 'rateScaledToTarget' | 'appliedRate'>): RateDisplay {
  const { rate, rateScaledToTarget, appliedRate } = derivation;
  if (rateScaledToTarget) return appliedRate ? { mode: 'scaled', applied: appliedRate, planning: rate } : { mode: 'scaled-unstored' };
  if (!rate || rate.value === null) return { mode: 'none' };
  return { mode: 'version', rate };
}
