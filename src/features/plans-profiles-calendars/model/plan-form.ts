import { plantLocalToUtc, utcToPlantLocal } from '@/features/event-hub/model/plant-local-time';
import type { PlanCreateBody, PlanVersionChangeBody } from '@/api/v2/queries/plans';
import type { Distribution, PlanBasis, PlanVersionView, PlanView } from '@/api/v2/types/plans';
import type { FieldErrors } from './profile-form';

/**
 * Plan form (plan 3.4 step 3, PLAN02): header, basis, distribution and sequential product slices
 * (campaigns). Times are typed on the plant clock and sent as UTC instants. The browser checks the
 * request shape only; targets, period splits and capacities come from the server preview — there is no
 * default rate anywhere (no "100 units / h").
 */
export interface SliceRow {
  productId: string;
  campaignFrom: string;
  campaignTo: string;
  weight: string | null;
  target: string | null;
}

export interface PlanFormValues {
  name: string;
  unitId: string;
  scenarioId: string;
  validFrom: string;
  validTo: string;
  basis: PlanBasis;
  headerTarget: string | null;
  distribution: Distribution;
  slices: SliceRow[];
  changeReason: string;
}

export const emptySlice = (): SliceRow => ({ productId: '', campaignFrom: '', campaignTo: '', weight: null, target: null });

export const emptyPlanForm = (): PlanFormValues => ({
  name: '',
  unitId: '',
  scenarioId: '',
  validFrom: '',
  validTo: '',
  basis: 'quantity',
  headerTarget: null,
  distribution: 'scheduled_capacity',
  slices: [emptySlice()],
  changeReason: '',
});

export function planFormOf(plan: Pick<PlanView, 'name' | 'scenarioId'>, version: PlanVersionView, timezone: string): PlanFormValues {
  return {
    name: plan.name,
    unitId: version.unitId,
    scenarioId: plan.scenarioId ?? '',
    validFrom: utcToPlantLocal(version.validFrom, timezone),
    validTo: utcToPlantLocal(version.validTo, timezone),
    basis: version.basis,
    headerTarget: version.headerTarget,
    distribution: version.distribution,
    slices: (version.slices ?? []).map((slice) => ({
      productId: slice.productId,
      campaignFrom: utcToPlantLocal(slice.campaignFrom, timezone),
      campaignTo: utcToPlantLocal(slice.campaignTo, timezone),
      weight: slice.weight,
      target: slice.target,
    })),
    changeReason: '',
  };
}

function windowErrors(values: PlanFormValues, timezone: string): FieldErrors {
  const errors: FieldErrors = {};
  const from = plantLocalToUtc(values.validFrom, timezone);
  const to = plantLocalToUtc(values.validTo, timezone);
  if (!from) errors.validFrom = 'validFrom is required';
  if (!to) errors.validTo = 'validTo is required';
  if (from && to && to <= from) errors.validTo = 'validTo must be after validFrom';
  return errors;
}

export function validatePlanForm(values: PlanFormValues, timezone: string, creating: boolean): FieldErrors {
  const errors = windowErrors(values, timezone);
  if (creating && !values.name.trim()) errors.name = 'name is required';
  if (!values.unitId) errors.unitId = 'unitId is required';
  if (values.slices.length === 0) errors.slices = 'slices must contain at least 1 element';
  values.slices.forEach((slice, index) => {
    if (!slice.productId) errors[`slices.${index}.productId`] = 'productId is required';
  });
  const sliceTargets = values.slices.length > 0 && values.slices.every((slice) => slice.target);
  if (values.basis === 'quantity' && !values.headerTarget && !sliceTargets) {
    errors.headerTarget = 'a quantity plan needs a header target (or a target on every slice)';
  }
  return errors;
}

const instant = (local: string, timezone: string) => (local ? plantLocalToUtc(local, timezone) : null);

function content(values: PlanFormValues, timezone: string) {
  return {
    unitId: values.unitId,
    validFrom: plantLocalToUtc(values.validFrom, timezone) as string,
    validTo: plantLocalToUtc(values.validTo, timezone) as string,
    basis: values.basis,
    headerTarget: values.basis === 'time' ? null : values.headerTarget,
    distribution: values.distribution,
    slices: values.slices.map((slice) => ({
      productId: slice.productId,
      campaignFrom: instant(slice.campaignFrom, timezone),
      campaignTo: instant(slice.campaignTo, timezone),
      weight: slice.weight,
      target: slice.target,
      stream: 'sequential' as const,
    })),
    changeReason: values.changeReason.trim() || null,
  };
}

export function planCreateBody(values: PlanFormValues, timezone: string): PlanCreateBody {
  return { ...content(values, timezone), name: values.name.trim(), ...(values.scenarioId ? { scenarioId: values.scenarioId } : {}) };
}

export function planChangeBody(values: PlanFormValues, timezone: string): PlanVersionChangeBody {
  return content(values, timezone);
}

/** Open versions may still change; approved / superseded versions are frozen (PLAN04: new version). */
export function isOpenVersion(version: Pick<PlanVersionView, 'approvalState'>): boolean {
  return version.approvalState === 'draft' || version.approvalState === 'submitted';
}

/**
 * Σ badge of the preview: the server's per-unit totals against the header target, compared as the
 * canonical decimal strings the API returns (no arithmetic in the browser). null = nothing to compare.
 */
export function sumMatchesHeader(totals: ReadonlyArray<{ target: string }>, headerTarget: string | null): boolean | null {
  if (headerTarget === null || totals.length !== 1) return null;
  return totals[0].target === headerTarget;
}
