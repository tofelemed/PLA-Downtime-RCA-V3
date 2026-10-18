import type { RcaActionPatch } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { plantDayOf, plantDayStart } from './plant-day';

/** The planning fields of an existing action that the update DTO accepts (A-8). */
export interface ActionEditForm {
  title: string;
  /** '' = no owner */
  ownerId: string;
  /** plant calendar days `YYYY-MM-DD` or '' */
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  /** item 5: the recommendation the action implements ('' = none) */
  recommendationId: string;
  /** CA4: how the completion is verified and the named verifier ('' = none) */
  verificationMethod: string;
  verifierId: string;
}

type EditableAction = Pick<RcaActionView, 'title' | 'ownerId' | 'dueDate' | 'verificationWindowStart' | 'verificationWindowEnd'> &
  Partial<Pick<RcaActionView, 'recommendationId' | 'verificationMethod' | 'verifierId'>>;

export function actionEditFormOf(action: EditableAction, timeZone: string): ActionEditForm {
  return {
    title: action.title,
    ownerId: action.ownerId ?? '',
    dueDate: plantDayOf(action.dueDate, timeZone),
    windowStart: plantDayOf(action.verificationWindowStart, timeZone),
    windowEnd: plantDayOf(action.verificationWindowEnd, timeZone),
    recommendationId: action.recommendationId ?? '',
    verificationMethod: action.verificationMethod ?? '',
    verifierId: action.verifierId ?? '',
  };
}

/**
 * PATCH of the planning fields: only what changed, so an untouched verification window is never re-sent
 * (the server re-checks a changed window and the owner; 422 otherwise). Empty = nothing to save.
 */
export function buildActionEditPatch(form: ActionEditForm, action: EditableAction, timeZone: string): RcaActionPatch {
  const before = actionEditFormOf(action, timeZone);
  const day = (value: string) => plantDayStart(value, timeZone);
  const orNull = (value: string) => value || null;
  const fields: Array<[keyof RcaActionPatch, string, string, (value: string) => string | null]> = [
    ['title', form.title.trim(), before.title, (value) => value],
    ['ownerId', form.ownerId, before.ownerId, orNull],
    ['dueDate', form.dueDate, before.dueDate, day],
    ['verificationWindowStart', form.windowStart, before.windowStart, day],
    ['verificationWindowEnd', form.windowEnd, before.windowEnd, day],
    ['recommendationId', form.recommendationId, before.recommendationId, orNull],
    ['verificationMethod', form.verificationMethod.trim(), before.verificationMethod, orNull],
    ['verifierId', form.verifierId, before.verifierId, orNull],
  ];
  return Object.fromEntries(fields.filter(([, next, previous]) => next !== previous).map(([key, next, , to]) => [key, to(next)])) as RcaActionPatch;
}
