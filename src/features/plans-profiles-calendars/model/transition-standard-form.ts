import { plantLocalToUtc } from '@/lib/dates';
import type { TransitionStandardCreateBody } from '@/api/v2/queries/profile-commands';
import { type FieldErrors, validityErrors } from './profile-form';

/**
 * The grade-transition matrix form (LA-08). The planner types the reference in hours; the API takes
 * seconds, so the form converts the typed value (input unit only — the split of transition loss into
 * allowance and overrun is the server's). Rules about overlaps and approval are the server's too.
 */
export interface TransitionStandardFormValues {
  unitId: string;
  fromProductId: string;
  toProductId: string;
  referenceHours: string | null;
  referenceOffgradeQty: string | null;
  offgradeUom: string;
  sampleCount: string;
  evidence: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export const emptyTransitionStandardForm = (unitId: string): TransitionStandardFormValues => ({
  unitId,
  fromProductId: '',
  toProductId: '',
  referenceHours: null,
  referenceOffgradeQty: null,
  offgradeUom: 't',
  sampleCount: '',
  evidence: '',
  effectiveFrom: '',
  effectiveTo: '',
});

const SECONDS_PER_HOUR = 3600;

/** Typed hours as the API's seconds (at most 3 decimals). */
export function secondsOfHours(hours: string): string {
  return String(Math.round(Number(hours) * SECONDS_PER_HOUR * 1000) / 1000);
}

/** Seconds from the server shown as hours (display only). */
export function hoursOfSeconds(seconds: string): string {
  return (Number(seconds) / SECONDS_PER_HOUR).toFixed(2);
}

export function validateTransitionStandardForm(values: TransitionStandardFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!values.unitId) errors.unitId = 'Choose a unit';
  if (!values.fromProductId) errors.fromProductId = 'Choose the product before the change';
  if (!values.toProductId) errors.toProductId = 'Choose the product after the change';
  if (values.fromProductId && values.fromProductId === values.toProductId) errors.toProductId = 'Choose a different product';
  if (!values.referenceHours || Number(values.referenceHours) <= 0) errors.referenceSeconds = 'Enter the reference duration in hours (> 0)';
  if (values.referenceOffgradeQty && !values.offgradeUom.trim()) errors.offgradeUom = 'Enter the off-grade unit';
  if (values.sampleCount && !/^[1-9]\d*$/.test(values.sampleCount)) errors.sampleCount = 'Enter a whole number ≥ 1';
  return errors;
}

export function transitionStandardCreateBody(values: TransitionStandardFormValues, timezone: string): TransitionStandardCreateBody {
  const offGrade = values.referenceOffgradeQty || null;
  return {
    unitId: values.unitId,
    fromProductId: values.fromProductId,
    toProductId: values.toProductId,
    referenceSeconds: secondsOfHours(values.referenceHours as string),
    referenceOffgradeQty: offGrade,
    offgradeUom: offGrade ? values.offgradeUom.trim() : null,
    sampleCount: values.sampleCount ? Number(values.sampleCount) : null,
    evidence: values.evidence.trim() || null,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}
