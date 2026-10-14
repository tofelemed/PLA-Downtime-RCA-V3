import type { RcaActionBody, RcaActionPatch } from '@/api/v2/queries/rca-commands';
import type { RcaCompletionAttachment, RcaActionType } from '@/api/v2/types/rca-workflow';
import { RCA_ACTION_TYPES } from '@/api/v2/types/rca-workflow';
import { plantDayOf, plantDayStart } from './plant-day';

/**
 * The action form (RCA03, SME CA2–CA4); dates are plant calendar days sent as the instant the day starts. The
 * baseline is counted by the server from history (a typed value is refused, 422 BASELINE_DECLARED).
 */
export interface ActionForm {
  title: string;
  actionType: '' | RcaActionType;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  baselineMetric: '' | 'recurrences' | 'downtime_seconds';
  /** empty = the lookback of the RCA policy in force */
  baselineDays: string;
  claimed: string;
  claimedCurrency: '' | 'IRR' | 'USD';
}

export const EMPTY_ACTION_FORM: ActionForm = {
  title: '',
  actionType: '',
  dueDate: '',
  windowStart: '',
  windowEnd: '',
  baselineMetric: '',
  baselineDays: '',
  claimed: '',
  claimedCurrency: '',
};


export const asActionType = (value: string): '' | RcaActionType => RCA_ACTION_TYPES.find((type) => type === value) ?? '';

function baselineOf(form: ActionForm): RcaActionBody['baseline'] {
  if (!form.baselineMetric) return null;
  const days = form.baselineDays.trim();
  return { metric: form.baselineMetric, ...(days ? { windowDays: Number(days) } : {}) };
}

/** The v2 action body; the server checks window order, claim currency and baseline (422 otherwise). */
export function buildActionBody(form: ActionForm, ownerId: string | null, timeZone: string): RcaActionBody {
  const day = (value: string) => plantDayStart(value, timeZone);
  return {
    title: form.title.trim(),
    ownerId,
    actionType: form.actionType || null,
    dueDate: day(form.dueDate),
    verificationWindowStart: day(form.windowStart),
    verificationWindowEnd: day(form.windowEnd),
    baseline: baselineOf(form),
    claimedAvoidedLoss: form.claimed.trim() || null,
    claimedCurrency: form.claimedCurrency || null,
  };
}

/** CA4 completion evidence of an action as edited on its row. */
export interface CompletionForm {
  actionType: '' | RcaActionType;
  evidenceRef: string;
  /** calendar day `YYYY-MM-DD` or '' (= today on the server) */
  completedAt: string;
  attachments: RcaCompletionAttachment[];
}

export function completionFormOf(
  action: {
    actionType: RcaActionType | null;
    completionEvidenceRef: string | null;
    completedAt: string | null;
    completionAttachments: RcaCompletionAttachment[];
  },
  timeZone: string,
): CompletionForm {
  return {
    actionType: action.actionType ?? '',
    evidenceRef: action.completionEvidenceRef ?? '',
    completedAt: plantDayOf(action.completedAt, timeZone),
    attachments: action.completionAttachments,
  };
}

/**
 * PATCH of the evidence; with `markDone` also the status. Marking done needs the type and evidence and is
 * refused for the owner (the server decides: 422 ACTION_TYPE_REQUIRED / EVIDENCE_REQUIRED, 403).
 */
export function buildCompletionPatch(form: CompletionForm, markDone: boolean, timeZone: string): RcaActionPatch {
  const completedAt = plantDayStart(form.completedAt, timeZone);
  return {
    actionType: form.actionType || null,
    completionEvidenceRef: form.evidenceRef.trim() || null,
    completionAttachments: form.attachments.map(({ fileName, name }) => ({ fileName, name })),
    ...(completedAt ? { completedAt } : {}),
    ...(markDone ? { status: 'done' as const } : {}),
  };
}
