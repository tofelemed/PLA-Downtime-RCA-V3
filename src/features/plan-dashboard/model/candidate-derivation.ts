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
