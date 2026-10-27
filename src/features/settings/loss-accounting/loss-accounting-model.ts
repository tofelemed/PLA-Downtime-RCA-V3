import type { LossAccountingDraftBody, LossAccountingPolicyView, LossBasis, LossGrain, LossTargetSource } from '@/api/v2/types/loss-accounting';

/** What the loss accounting form holds while typing (numbers as text, the unit and product as an id or ''). */
export interface LossAccountingFormValues {
  grain: LossGrain;
  dayStart: string;
  lossBasis: LossBasis;
  targetSource: LossTargetSource;
  accountingUnitId: string;
  /** '' = no accounting product */
  accountingProductId: string;
  stopsCrossCheck: boolean;
  identityTolerance: string;
}

export type LossAccountingFormErrors = Partial<Record<'dayStart' | 'accountingUnitId' | 'identityTolerance', string>>;

export const GRAIN_OPTIONS = [
  { value: 'shift', label: 'Shift' },
  { value: 'day', label: 'Day' },
];
export const BASIS_OPTIONS = [
  { value: 'computed', label: 'Computed from measurements and stops' },
  { value: 'declared', label: 'Declared by the OT production loss event' },
];
export const TARGET_OPTIONS = [
  { value: 'plan', label: 'Traverse Forge plan' },
  { value: 'declared', label: 'OT planned figure' },
];

const DAY_START_DEFAULT = '00:00';
const DAY_START = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The form as it opens: the version in force. */
export function initialLossAccountingForm(policy: LossAccountingPolicyView): LossAccountingFormValues {
  return {
    grain: policy.grain,
    dayStart: policy.grain === 'day' ? policy.dayStart : DAY_START_DEFAULT,
    lossBasis: policy.lossBasis,
    targetSource: policy.targetSource,
    accountingUnitId: policy.accountingUnitId ?? '',
    accountingProductId: policy.accountingProductId ?? '',
    stopsCrossCheck: policy.stopsCrossCheck,
    identityTolerance: String(policy.identityTolerance),
  };
}

/** Choosing Declared starts from the declared target; choosing Computed from the plan. */
export function withLossBasis(values: LossAccountingFormValues, lossBasis: LossBasis): LossAccountingFormValues {
  return { ...values, lossBasis, targetSource: lossBasis === 'declared' ? 'declared' : 'plan' };
}

/** What the typed values get wrong; the server still has the final word. */
export function lossAccountingErrors(values: LossAccountingFormValues): LossAccountingFormErrors {
  const errors: LossAccountingFormErrors = {};
  if (values.grain === 'day' && !DAY_START.test(values.dayStart)) errors.dayStart = 'Give the day start as a time, e.g. 00:00';
  if (values.lossBasis !== 'declared') return errors;
  if (!values.accountingUnitId) errors.accountingUnitId = 'Choose the unit the accounting is kept on';
  const tolerance = Number(values.identityTolerance);
  if (values.identityTolerance.trim() === '' || !Number.isFinite(tolerance) || tolerance < 0) errors.identityTolerance = 'Give a number, 0 or more';
  return errors;
}

/**
 * The POST body: exactly the DTO's keys; the declared-only fields keep the version in force when computed.
 * Drafts are plant-wide (no `unitId`): the server limits declared mode to `accountingUnitId`.
 */
export function lossAccountingBody(values: LossAccountingFormValues, base: LossAccountingPolicyView): LossAccountingDraftBody {
  const declared = values.lossBasis === 'declared';
  return {
    grain: values.grain,
    dayStart: values.grain === 'day' ? values.dayStart : base.dayStart,
    lossBasis: values.lossBasis,
    targetSource: declared ? values.targetSource : 'plan',
    accountingUnitId: values.accountingUnitId || null,
    accountingProductId: declared && values.accountingProductId ? values.accountingProductId : null,
    stopsCrossCheck: declared ? values.stopsCrossCheck : base.stopsCrossCheck,
    identityTolerance: declared ? Number(values.identityTolerance) : base.identityTolerance,
  };
}

/** One line for a version, e.g. "Daily accounting from 00:00 · declared by the OT production loss event · target: OT planned figure · unit: Extruder1". */
export function lossAccountingSummary(policy: LossAccountingPolicyView, unitName?: string, productName?: string): string {
  const period = policy.grain === 'day' ? `Daily accounting from ${policy.dayStart}` : 'Shift accounting';
  if (policy.lossBasis !== 'declared') return `${period} · computed from measurements and stops`;
  const target = policy.targetSource === 'declared' ? 'OT planned figure' : 'Traverse Forge plan';
  const parts = [period, 'declared by the OT production loss event', `target: ${target}`];
  if (unitName) parts.push(`unit: ${unitName}`);
  if (productName) parts.push(`product: ${productName}`);
  return parts.join(' · ');
}
