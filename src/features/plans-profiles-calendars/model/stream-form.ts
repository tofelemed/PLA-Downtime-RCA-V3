import { plantLocalToUtc } from '@/lib/dates';
import type { StreamRunCreateBody, UnitStreamCreateBody } from '@/api/v2/queries/plant-model';
import { formatSignificant } from '@/features/ux-kit/format/decimal';
import { type FieldErrors, validityErrors } from './profile-form';

/**
 * Stream and stream-run forms (SME E6). The planner types a stream's share of the unit's rate in percent;
 * the API takes a fraction, so the form converts the typed value (input unit only). Rules about the sum
 * of shares, overlapping runs and lot codes are the server's; times are typed on the plant clock.
 */
export interface StreamFormValues {
  unitId: string;
  code: string;
  name: string;
  sharePercent: string | null;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface StreamRunFormValues {
  unitId: string;
  streamCode: string;
  productId: string;
  lotCode: string;
  startTime: string;
  endTime: string;
}

const CODE = /^[A-Za-z0-9_.-]{1,64}$/;

export const emptyStreamForm = (unitId: string): StreamFormValues => ({
  unitId,
  code: '',
  name: '',
  sharePercent: null,
  effectiveFrom: '',
  effectiveTo: '',
});

export const emptyStreamRunForm = (unitId: string): StreamRunFormValues => ({
  unitId,
  streamCode: '',
  productId: '',
  lotCode: '',
  startTime: '',
  endTime: '',
});

/** Typed percent as the API's fraction (at most 8 decimals). */
export function shareOfPercent(percent: string): string {
  return String(Math.round(Number(percent) * 1e6) / 1e8);
}

/** A stored fraction shown as percent (display only; Latin digits — localize at render). */
export function percentOfShare(share: string): string {
  return formatSignificant(Number(share) * 100, 6);
}

export function validateStreamForm(values: StreamFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!CODE.test(values.code.trim())) errors.code = 'Use 1–64 letters, digits, _ . -';
  if (!values.name.trim()) errors.name = 'Enter a name';
  const percent = Number(values.sharePercent);
  if (!values.sharePercent || !(percent > 0) || percent > 100) errors.capacityShare = 'Enter a share above 0 and up to 100 %';
  return errors;
}

export function streamCreateBody(values: StreamFormValues, timezone: string): UnitStreamCreateBody {
  return {
    unitId: values.unitId,
    code: values.code.trim(),
    name: values.name.trim(),
    capacityShare: shareOfPercent(values.sharePercent as string),
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}

export function validateStreamRunForm(values: StreamRunFormValues, timezone: string): FieldErrors {
  const validity = validityErrors(values.startTime, values.endTime, timezone);
  const errors: FieldErrors = {};
  if (validity.effectiveFrom) errors.startTime = validity.effectiveFrom;
  if (validity.effectiveTo) errors.endTime = validity.effectiveTo;
  if (!values.streamCode) errors.streamCode = 'Choose a stream';
  if (!values.productId) errors.productId = 'Choose the product the stream runs';
  return errors;
}

export function streamRunCreateBody(values: StreamRunFormValues, timezone: string): StreamRunCreateBody {
  return {
    unitId: values.unitId,
    streamCode: values.streamCode,
    productId: values.productId,
    lotCode: values.lotCode.trim() || null,
    startTime: plantLocalToUtc(values.startTime, timezone) as string,
    endTime: values.endTime ? plantLocalToUtc(values.endTime, timezone) : null,
  };
}
