import type { FxRateCreateBody } from '@/api/v2/queries/valuation';
import { plantLocalToUtc } from '@/features/event-hub/model/plant-local-time';
import { validityErrors, type FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';

/**
 * The FX rate draft form (plan 2.6, D08 Q2). The browser checks only the request shape `POST /fx-rates`
 * validates — ISO codes, different currencies (SAME_CURRENCY), a decimal string with ≤ 14 integer and
 * ≤ 10 fraction digits that is not zero (INVALID_VALUE), a validity whose end follows its start — under
 * the API's field names, so a 422 `fieldErrors` entry lands on the same input. The rate stays the text
 * the user typed (never a JS number); overlaps and approval are the server's.
 */
export interface FxFormValues {
  fromCurrency: string;
  toCurrency: string;
  rate: string | null;
  effectiveFrom: string;
  effectiveTo: string;
  source: string;
}

/** FX rates carry up to 10 decimals (numeric(24,10)); the DecimalInput scale of this form. */
export const FX_SCALE = 10;
const CURRENCY = /^[A-Z]{3}$/;
const FX_RATE = /^\d{1,14}(\.\d{1,10})?$/;
const ZERO = /^0+(\.0+)?$/;
const SOURCE_MAX = 255;

/** D08 Q2: the reporting currencies, USD → IRR first. */
export const emptyFxForm = (): FxFormValues => ({ fromCurrency: 'USD', toCurrency: 'IRR', rate: null, effectiveFrom: '', effectiveTo: '', source: '' });

function rateError(rate: string | null): string | null {
  if (!rate) return 'rate is required';
  if (!FX_RATE.test(rate)) return 'rate must be a decimal string with at most 14 integer digits and 10 decimals';
  if (ZERO.test(rate)) return 'rate must be a decimal > 0';
  return null;
}

export function validateFxForm(values: FxFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!CURRENCY.test(values.fromCurrency)) errors.fromCurrency = 'fromCurrency must be an ISO 4217 code';
  if (!CURRENCY.test(values.toCurrency)) errors.toCurrency = 'toCurrency must be an ISO 4217 code';
  else if (values.toCurrency === values.fromCurrency) errors.toCurrency = 'fromCurrency and toCurrency must differ';
  const rate = rateError(values.rate);
  if (rate) errors.rate = rate;
  if (values.source.trim().length > SOURCE_MAX) errors.source = `source must be at most ${SOURCE_MAX} characters`;
  return errors;
}

export function fxCreateBody(values: FxFormValues, timezone: string): FxRateCreateBody {
  return {
    fromCurrency: values.fromCurrency,
    toCurrency: values.toCurrency,
    rate: values.rate as string,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
    source: values.source.trim() || null,
  };
}
