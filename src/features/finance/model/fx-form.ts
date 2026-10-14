import type { FxRateCreateBody } from '@/api/v2/queries/valuation';
import type { FxRateType } from '@/api/v2/types/valuation';
import { validityErrors, type FieldErrors } from './field-errors';

/**
 * The FX rate draft form (plan 2.6, D08 Q2). The browser checks only the request shape `POST /fx-rates`
 * validates — ISO codes, different currencies, a decimal string with ≤ 14 integer and ≤ 10 fraction
 * digits that is not zero, a validity whose end follows its start — under the API's field names, so a
 * 422 `fieldErrors` entry lands on the same input. The rate stays the text the user typed (never a JS
 * number); the validity is ISO UTC from the date inputs; overlaps and approval are the server's.
 */
export interface FxFormValues {
  /** SME V5: the rate table by purpose (economic by default) */
  rateType: FxRateType;
  fromCurrency: string;
  toCurrency: string;
  rate: string | null;
  /** ISO UTC instant (DateTimeInput) */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: string;
}

/** FX rates carry up to 10 decimals (numeric(24,10)); the DecimalInput scale of this form. */
export const FX_SCALE = 10;
const CURRENCY = /^[A-Z]{3}$/;
const FX_RATE = /^\d{1,14}(\.\d{1,10})?$/;
const ZERO = /^0+(\.0+)?$/;
const SOURCE_MAX = 255;

/** D08 Q2: the reporting currencies, USD → IRR first. */
export const emptyFxForm = (): FxFormValues => ({ rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: null, effectiveFrom: null, effectiveTo: null, source: '' });

function rateError(rate: string | null): string | null {
  if (!rate) return 'Enter the rate.';
  if (!FX_RATE.test(rate)) return 'Use at most 14 digits before and 10 digits after the decimal point.';
  if (ZERO.test(rate)) return 'The rate must be greater than 0.';
  return null;
}

export function validateFxForm(values: FxFormValues): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo);
  if (!CURRENCY.test(values.fromCurrency)) errors.fromCurrency = 'Choose a currency.';
  if (!CURRENCY.test(values.toCurrency)) errors.toCurrency = 'Choose a currency.';
  else if (values.toCurrency === values.fromCurrency) errors.toCurrency = 'Choose a currency different from the first one.';
  const rate = rateError(values.rate);
  if (rate) errors.rate = rate;
  if (values.source.trim().length > SOURCE_MAX) errors.source = `Use at most ${SOURCE_MAX} characters.`;
  return errors;
}

export function fxCreateBody(values: FxFormValues): FxRateCreateBody {
  return {
    rateType: values.rateType,
    fromCurrency: values.fromCurrency,
    toCurrency: values.toCurrency,
    rate: values.rate as string,
    effectiveFrom: values.effectiveFrom as string,
    effectiveTo: values.effectiveTo,
    source: values.source.trim() || null,
  };
}
