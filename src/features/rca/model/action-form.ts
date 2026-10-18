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
  /** a member of the plant ('' = no owner); the server checks it (422 INVALID_REFERENCE) */
  ownerId: string;
  actionType: '' | RcaActionType;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  baselineMetric: '' | 'recurrences' | 'downtime_seconds';
  /** empty = the lookback of the RCA policy in force */
  baselineDays: string;
  claimed: string;
  claimedCurrency: '' | 'IRR' | 'USD';
  /** item 5: the case recommendation the action implements ('' = none) */
  recommendationId: string;
  /** CA4: how the completion is verified ('' = not stated) */
  verificationMethod: string;
  /** CA4: the named verifier ('' = any RCA writer other than the owner); never the owner (server 422) */
  verifierId: string;
}

export const EMPTY_ACTION_FORM: ActionForm = {
  title: '',
  ownerId: '',
  actionType: '',
  dueDate: '',
  windowStart: '',
  windowEnd: '',
  baselineMetric: '',
  baselineDays: '',
  claimed: '',
  claimedCurrency: '',
  recommendationId: '',
  verificationMethod: '',
  verifierId: '',
};

export const asActionType = (value: string): '' | RcaActionType => RCA_ACTION_TYPES.find((type) => type === value) ?? '';

function baselineOf(form: ActionForm): RcaActionBody['baseline'] {
  if (!form.baselineMetric) return null;
  const days = form.baselineDays.trim();
  return { metric: form.baselineMetric, ...(days ? { windowDays: Number(days) } : {}) };
}

export const VERIFIER_IS_OWNER = "The verifier checks the owner's evidence, so choose someone other than the owner.";

/** A verifier who is also the owner (the server refuses it with 422 VERIFIER_IS_OWNER). */
export const verifierIsOwner = (form: Pick<ActionForm, 'ownerId' | 'verifierId'>) => Boolean(form.verifierId) && form.verifierId === form.ownerId;

/** The v2 action body; the server checks window order, claim currency, baseline and verifier (422 otherwise). */
export function buildActionBody(form: ActionForm, timeZone: string): RcaActionBody {
  const day = (value: string) => plantDayStart(value, timeZone);
  return {
    title: form.title.trim(),
    ownerId: form.ownerId || null,
    actionType: form.actionType || null,
    dueDate: day(form.dueDate),
    verificationWindowStart: day(form.windowStart),
    verificationWindowEnd: day(form.windowEnd),
    baseline: baselineOf(form),
    claimedAvoidedLoss: form.claimed.trim() || null,
    claimedCurrency: form.claimedCurrency || null,
    ...(form.recommendationId ? { recommendationId: form.recommendationId } : {}),
    ...(form.verificationMethod.trim() ? { verificationMethod: form.verificationMethod.trim() } : {}),
    ...(form.verifierId ? { verifierId: form.verifierId } : {}),
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

/** The owner's PATCH (not an RCA writer): the evidence reference and files only (the server refuses more). */
export function buildOwnerEvidencePatch(form: CompletionForm): RcaActionPatch {
  return {
    completionEvidenceRef: form.evidenceRef.trim() || null,
    completionAttachments: form.attachments.map(({ fileName, name }) => ({ fileName, name })),
  };
}
