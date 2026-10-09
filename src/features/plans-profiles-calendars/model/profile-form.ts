import { plantLocalToUtc, utcToPlantLocal } from '@/features/event-hub/model/plant-local-time';
import type { ProfileCreateBody, ProfilePatchBody, RateCreateBody, ValuationRateCreateBody } from '@/api/v2/queries/profile-commands';
import type { CapacityModel, ProfileView, RateKind, RateTimebase, ValuationBasis } from '@/api/v2/types/profiles';

/**
 * Profile, rate and valuation-rate forms (plan 3.4). The browser checks only the request shape the API
 * validates (required fields, decimal text, mode pattern, ISO currency, an end after the start) with the
 * API's field names, so a 422 `fieldErrors` entry lands on the same input; rules about overlaps, approval
 * and units are the server's. Times are typed on the plant clock and sent as UTC instants.
 */
export type FieldErrors = Record<string, string>;

export interface ProfileFormValues {
  unitId: string;
  productId: string;
  operatingMode: string;
  quantityUom: string;
  rateTimebase: RateTimebase | '';
  capacityModel: CapacityModel;
  effectiveFrom: string;
  effectiveTo: string;
}

const MODE = /^[A-Za-z0-9_.-]{1,64}$/;
const CURRENCY = /^[A-Z]{3}$/;

export const emptyProfileForm = (): ProfileFormValues => ({
  unitId: '',
  productId: '',
  operatingMode: 'normal',
  quantityUom: '',
  rateTimebase: '',
  capacityModel: 'single_stream',
  effectiveFrom: '',
  effectiveTo: '',
});

export function profileFormOf(profile: ProfileView, timezone: string): ProfileFormValues {
  return {
    unitId: profile.unitId,
    productId: profile.productId,
    operatingMode: profile.operatingMode,
    quantityUom: profile.quantityUom ?? '',
    rateTimebase: profile.rateTimebase ?? '',
    capacityModel: profile.capacityModel,
    effectiveFrom: utcToPlantLocal(profile.effectiveFrom, timezone),
    effectiveTo: utcToPlantLocal(profile.effectiveTo, timezone),
  };
}

/** `effectiveFrom` / `effectiveTo` errors of a half-open validity typed on the plant clock. */
export function validityErrors(from: string, to: string, timezone: string): FieldErrors {
  const errors: FieldErrors = {};
  const start = plantLocalToUtc(from, timezone);
  if (!start) errors.effectiveFrom = 'effectiveFrom is required';
  const end = to ? plantLocalToUtc(to, timezone) : null;
  if (to && !end) errors.effectiveTo = 'effectiveTo must be a date and time';
  if (start && end && end <= start) errors.effectiveTo = 'effectiveTo must be after effectiveFrom';
  return errors;
}

export function validateProfileForm(values: ProfileFormValues, timezone: string, creating: boolean): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (creating && !values.unitId) errors.unitId = 'unitId is required';
  if (creating && !values.productId) errors.productId = 'productId is required';
  if (creating && !MODE.test(values.operatingMode)) errors.operatingMode = 'operatingMode must be 1–64 letters, digits, _ . -';
  if (!values.quantityUom.trim()) errors.quantityUom = 'quantityUom is required';
  if (!values.rateTimebase) errors.rateTimebase = 'rateTimebase is required';
  return errors;
}

function content(values: ProfileFormValues, timezone: string) {
  return {
    quantityUom: values.quantityUom.trim(),
    rateTimebase: values.rateTimebase as RateTimebase,
    capacityModel: values.capacityModel,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}

export function profileCreateBody(values: ProfileFormValues, timezone: string): ProfileCreateBody {
  return { ...content(values, timezone), unitId: values.unitId, productId: values.productId, operatingMode: values.operatingMode };
}

export function profilePatchBody(values: ProfileFormValues, timezone: string): ProfilePatchBody {
  return content(values, timezone);
}

export interface RateFormValues {
  rateKind: RateKind;
  rate: string | null;
  timebase: RateTimebase;
  effectiveFrom: string;
  effectiveTo: string;
}

export function validateRateForm(values: RateFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!values.rate) errors.rate = 'rate is required';
  return errors;
}

export function rateCreateBody(values: RateFormValues, timezone: string): RateCreateBody {
  return {
    rateKind: values.rateKind,
    rate: values.rate as string,
    timebase: values.timebase,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}

export interface ValuationFormValues {
  basis: ValuationBasis;
  value: string | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export function validateValuationForm(values: ValuationFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!values.value) errors.value = 'value is required';
  if (!CURRENCY.test(values.currency)) errors.currency = 'currency must be an ISO 4217 code';
  return errors;
}

export function valuationCreateBody(profileId: string, values: ValuationFormValues, timezone: string): ValuationRateCreateBody {
  return {
    profileId,
    basis: values.basis,
    value: values.value as string,
    currency: values.currency,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}
