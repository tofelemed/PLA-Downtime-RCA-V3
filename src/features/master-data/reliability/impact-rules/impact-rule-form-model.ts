import { plantLocalToUtc } from '@/lib/dates';
import type { UnitImpactRuleCreateBody } from '@/api/v2/queries/unit-impact-rules';
import type { UnitImpactMode } from '@/api/v2/types/unit-impact';
import { type FieldErrors, validityErrors } from '@/features/plans-profiles-calendars/model/profile-form';

export const IMPACT_MODE_LABELS: Readonly<Record<UnitImpactMode, string>> = {
  full_stop: 'Full stop (the unit stops)',
  fractional: 'Partial (the unit loses a share of its rate)',
  none: 'None (the unit keeps running)',
};

/**
 * A draft unit impact rule as typed (plan 1.10, SME Q5 + D9). The share lost is typed in percent and sent
 * as a 0..1 decimal; overlaps and approval are the server's. Times are typed on the plant clock.
 */
export interface ImpactRuleFormValues {
  unitId: string;
  assetId: string;
  mode: UnitImpactMode;
  /** percent of the unit rate lost (fractional only) */
  percent: string;
  standbyAssetId: string;
  takeoverSeconds: string;
  reason: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export const emptyImpactRuleForm = (): ImpactRuleFormValues => ({
  unitId: '',
  assetId: '',
  mode: 'full_stop',
  percent: '',
  standbyAssetId: '',
  takeoverSeconds: '60',
  reason: '',
  effectiveFrom: '',
  effectiveTo: '',
});

const percentOk = (text: string) => {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 100;
};

/** Problems of the impact itself: the share lost, the standby and the takeover window. */
function impactErrors(values: ImpactRuleFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (values.mode === 'fractional' && !percentOk(values.percent)) errors.fraction = 'Enter the share lost, above 0 and at most 100 %';
  if (values.standbyAssetId && values.standbyAssetId === values.assetId) errors.standbyAssetId = 'The standby is another asset';
  const takeover = Number(values.takeoverSeconds);
  if (!Number.isInteger(takeover) || takeover < 0 || takeover > 86400) errors.takeoverSeconds = 'Whole seconds from 0 to 86400';
  return errors;
}

export function validateImpactRuleForm(values: ImpactRuleFormValues, timezone: string): FieldErrors {
  const errors = { ...validityErrors(values.effectiveFrom, values.effectiveTo, timezone), ...impactErrors(values) };
  if (!values.unitId) errors.unitId = 'Choose the unit';
  if (!values.assetId) errors.assetId = 'Choose the asset';
  if (!values.reason.trim()) errors.reason = 'Say why (e.g. one of two trains, installed spare)';
  return errors;
}

/** 50 % → "0.5" (at most 8 decimals, the stored scale). */
const fractionOf = (percent: string) => String(Number((Number(percent) / 100).toFixed(8)));

export function impactRuleCreateBody(values: ImpactRuleFormValues, timezone: string): UnitImpactRuleCreateBody {
  return {
    unitId: values.unitId,
    assetId: values.assetId,
    mode: values.mode,
    fraction: values.mode === 'fractional' ? fractionOf(values.percent) : null,
    standbyAssetId: values.standbyAssetId || null,
    takeoverSeconds: Number(values.takeoverSeconds),
    reason: values.reason.trim(),
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}
