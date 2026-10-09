import { useState } from 'react';
import { useCreatePlan, useNewPlanVersion, usePatchPlanVersion } from '@/api/v2/queries/plans';
import type { PlanVersionView, PlanView } from '@/api/v2/types/plans';
import { emptyPlanForm, planChangeBody, planCreateBody, planFormOf, validatePlanForm, type PlanFormValues } from '../model/plan-form';
import type { FieldErrors } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

/** What the plan form does: create a plan (draft v1), edit the open draft (If-Match), or open the next version. */
export type PlanFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; plan: PlanView; version: PlanVersionView }
  | { kind: 'new-version'; plan: PlanView; version: PlanVersionView };

export function initialPlanValues(mode: PlanFormMode, timezone: string): PlanFormValues {
  return mode.kind === 'create' ? emptyPlanForm() : planFormOf(mode.plan, mode.version, timezone);
}

/** Form state, request-shape validation and the three plan commands; server 422 field errors merge in. */
export function usePlanForm(mode: PlanFormMode, timezone: string) {
  const [values, setValues] = useState<PlanFormValues>(() => initialPlanValues(mode, timezone));
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreatePlan();
  const patch = usePatchPlanVersion();
  const next = useNewPlanVersion();
  const command = mode.kind === 'create' ? create : mode.kind === 'edit' ? patch : next;

  /** saves; resolves to the plan id, or null when refused (the refusal is in `error`) */
  const submit = async (): Promise<string | null> => {
    const found = validatePlanForm(values, timezone, mode.kind === 'create');
    setErrors(found);
    if (Object.keys(found).length > 0) return null;
    const body = planChangeBody(values, timezone);
    const saved =
      mode.kind === 'create'
        ? (await create.submit(planCreateBody(values, timezone)).catch(() => null))?.id
        : mode.kind === 'edit'
          ? (await patch.submit({ version: mode.version, body }).catch(() => null))?.planId
          : (await next.submit({ planId: mode.plan.id, body }).catch(() => null))?.planId;
    return saved ?? null;
  };

  return {
    values,
    set: <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value })),
    errors: { ...(refusalOf(command.error)?.fieldErrors ?? {}), ...errors },
    error: command.error,
    pending: command.isPending,
    submit,
  };
}
