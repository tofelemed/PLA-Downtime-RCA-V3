import type { RcaCostCurrency, RcaPolicyInput, RcaPolicyVersion, RcaRepeatMatch } from './rca-policy-api';

/** The editable fields of a new RCA trigger policy version, as typed (SME D17 / CA8). */
export interface RcaPolicyDraft {
  durationMinutes: string;
  repeatCount: string;
  repeatWindowDays: string;
  repeatMatch: RcaRepeatMatch;
  autoCreate: 'recommend' | 'create';
  costThreshold: string;
  costCurrency: '' | RcaCostCurrency;
  /** percent of the unit's daily plan; '' = off */
  lostQuantityPercent: string;
  /** comma-separated asset criticalities that count as critical */
  criticalities: string;
  /** production threshold factor of critical assets, e.g. 0.5 */
  criticalFactor: string;
  /** cumulative same-mode downtime (hours) within days; '' = off */
  cumulativeHours: string;
  cumulativeDays: string;
  notes: string;
}

const text = (value: number | null) => (value === null ? '' : String(value));

export function draftOf(policy: RcaPolicyVersion): RcaPolicyDraft {
  return {
    durationMinutes: String(Math.round(policy.durationThresholdSeconds / 60)),
    repeatCount: String(policy.repeatCount),
    repeatWindowDays: String(policy.repeatWindowDays),
    repeatMatch: policy.repeatMatch,
    autoCreate: policy.autoCreate,
    costThreshold: text(policy.costThreshold),
    costCurrency: policy.costCurrency ?? '',
    lostQuantityPercent: policy.lostQuantityShareOfDailyPlan === null ? '' : String(policy.lostQuantityShareOfDailyPlan * 100),
    criticalities: policy.criticalAssets.criticalities.join(', '),
    criticalFactor: String(policy.criticalAssets.thresholdFactor),
    cumulativeHours: policy.cumulative ? String(policy.cumulative.downtimeSeconds / 3600) : '',
    cumulativeDays: policy.cumulative ? String(policy.cumulative.windowDays) : '',
    notes: '',
  };
}

const wholeNumber = (value: string, min: number) => (/^\d+$/.test(value.trim()) && Number(value) >= min ? Number(value) : null);
const decimal = (value: string) => (/^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null);

/** The money limit with its currency (finance sets both, D17); undefined when incomplete. */
function costOf(draft: RcaPolicyDraft): Pick<RcaPolicyInput, 'costThreshold' | 'costCurrency'> | undefined {
  if (draft.costThreshold.trim() === '') return { costThreshold: null, costCurrency: null };
  const amount = decimal(draft.costThreshold);
  if (amount === null || !draft.costCurrency) return undefined;
  return { costThreshold: amount, costCurrency: draft.costCurrency };
}

function shareOf(draft: RcaPolicyDraft): number | null | undefined {
  if (draft.lostQuantityPercent.trim() === '') return null;
  const percent = decimal(draft.lostQuantityPercent);
  return percent !== null && percent > 0 && percent <= 100 ? percent / 100 : undefined;
}

function cumulativeOf(draft: RcaPolicyDraft): RcaPolicyInput['cumulative'] | undefined {
  if (draft.cumulativeHours.trim() === '' && draft.cumulativeDays.trim() === '') return null;
  const hours = decimal(draft.cumulativeHours);
  const days = wholeNumber(draft.cumulativeDays, 1);
  if (hours === null || hours <= 0 || days === null) return undefined;
  return { windowDays: days, downtimeSeconds: Math.round(hours * 3600) };
}

function criticalOf(draft: RcaPolicyDraft): RcaPolicyInput['criticalAssets'] | undefined {
  const factor = decimal(draft.criticalFactor);
  if (factor === null || factor <= 0 || factor > 1) return undefined;
  const criticalities = draft.criticalities.split(',').map((value) => value.trim()).filter(Boolean);
  return { criticalities, thresholdFactor: factor };
}

/** The request of a draft, or null while a value is missing or out of range (the server re-validates). */
export function inputOf(draft: RcaPolicyDraft, unitId: string | null): RcaPolicyInput | null {
  const minutes = wholeNumber(draft.durationMinutes, 0);
  const repeatCount = wholeNumber(draft.repeatCount, 1);
  const repeatWindowDays = wholeNumber(draft.repeatWindowDays, 1);
  const cost = costOf(draft);
  const share = shareOf(draft);
  const cumulative = cumulativeOf(draft);
  const criticalAssets = criticalOf(draft);
  if (minutes === null || repeatCount === null || repeatWindowDays === null) return null;
  if (!cost || share === undefined || cumulative === undefined || !criticalAssets) return null;
  const notes = draft.notes.trim();
  return {
    unitId,
    durationThresholdSeconds: minutes * 60,
    repeatCount,
    repeatWindowDays,
    repeatMatch: draft.repeatMatch,
    autoCreate: draft.autoCreate,
    ...cost,
    lostQuantityShareOfDailyPlan: share,
    criticalAssets,
    cumulative,
    ...(notes ? { notes } : {}),
  };
}
