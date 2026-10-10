import type { RcaActionBody } from '@/api/v2/queries/rca-commands';

/** The action form (RCA03); dates are plant-agnostic calendar days sent as UTC midnight. */
export interface ActionForm {
  title: string;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  baselineMetric: '' | 'recurrences' | 'downtime_seconds';
  baselineDays: string;
  /** empty = counted by the server from history before the window */
  baselineValue: string;
  claimed: string;
  claimedCurrency: '' | 'IRR' | 'USD';
}

export const EMPTY_ACTION_FORM: ActionForm = {
  title: '',
  dueDate: '',
  windowStart: '',
  windowEnd: '',
  baselineMetric: '',
  baselineDays: '30',
  baselineValue: '',
  claimed: '',
  claimedCurrency: '',
};

const day = (value: string) => (value ? new Date(`${value}T00:00:00Z`).toISOString() : undefined);

/** The v2 action body; the server checks window order, claim currency and baseline (422 otherwise). */
export function buildActionBody(form: ActionForm, ownerId: string | null): RcaActionBody {
  return {
    title: form.title.trim(),
    ownerId,
    dueDate: day(form.dueDate) ?? null,
    verificationWindowStart: day(form.windowStart) ?? null,
    verificationWindowEnd: day(form.windowEnd) ?? null,
    baseline: form.baselineMetric
      ? {
          metric: form.baselineMetric,
          windowDays: Number(form.baselineDays),
          ...(form.baselineValue.trim() ? { value: form.baselineValue.trim() } : {}),
        }
      : null,
    claimedAvoidedLoss: form.claimed.trim() || null,
    claimedCurrency: form.claimedCurrency || null,
  };
}
