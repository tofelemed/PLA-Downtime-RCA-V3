import type { RcaCaseBody, RcaCasePatch } from '@/api/v2/queries/rca-commands';
import type { RcaCaseView, RcaPriority, RcaStatus } from '@/api/v2/types/rca';
import { RCA_PRIORITIES, RCA_STATUSES } from '@/api/v2/types/rca';
import { RCA_CONSEQUENCE_CLASSES, type RcaConsequenceClass } from '@/api/v2/types/rca-workflow';
import { plantDayOf, plantDayStart } from './plant-day';

/**
 * The case definition (the "Overview" form and the new-case page): the scalar v2 contract fields. Nested
 * content (evidence, recommendations, logic tree, event diagram) is saved by its own screens, each as a
 * PATCH of just that list. The status moves only through the workflow (`POST …/transitions`); it is part
 * of the form for the new-case page, which may open a case as Draft or In Progress.
 */
export interface RcaCaseForm {
  title: string;
  description: string;
  status: RcaStatus;
  /** CA7 investigation tier; null = not classified yet */
  consequenceClass: RcaConsequenceClass | null;
  priority: RcaPriority;
  unitId: string | null;
  /** ISO calendar date `YYYY-MM-DD` or '' */
  targetCloseDate: string;
  rootCause: string;
  teamCharter: string;
  teamLeadId: string | null;
  teamMemberIds: string[];
  templateId: string | null;
}

export function emptyCaseForm(unitId: string | null): RcaCaseForm {
  return {
    title: '',
    description: '',
    status: 'Draft',
    consequenceClass: null,
    priority: 'Medium',
    unitId,
    targetCloseDate: '',
    rootCause: '',
    teamCharter: '',
    teamLeadId: null,
    teamMemberIds: [],
    templateId: null,
  };
}

export const asStatus = (value: string | null): RcaStatus => RCA_STATUSES.find((s) => s === value) ?? 'Draft';
export const asPriority = (value: string | null): RcaPriority => RCA_PRIORITIES.find((p) => p === value) ?? 'Medium';
export const asConsequence = (value: string | null): RcaConsequenceClass | null => RCA_CONSEQUENCE_CLASSES.find((c) => c === value) ?? null;

/** The form of a stored case; the target close day is the plant's day of the stored instant. */
export function formFromCase(view: RcaCaseView, timeZone: string): RcaCaseForm {
  return {
    title: view.title,
    description: view.description ?? '',
    status: asStatus(view.status),
    consequenceClass: asConsequence(view.consequenceClass),
    priority: asPriority(view.priority),
    unitId: view.unitId,
    targetCloseDate: plantDayOf(view.targetCloseDate, timeZone),
    rootCause: view.rootCause ?? '',
    teamCharter: view.teamCharter ?? '',
    teamLeadId: view.teamLeadId,
    teamMemberIds: view.teamMemberIds,
    templateId: view.templateId,
  };
}

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * PATCH body of the definition form: only declared scalar fields (the server refuses anything else) and
 * never the status (422 STATUS_VIA_TRANSITION when it differs).
 */
export function buildDefinitionPatch(form: RcaCaseForm, timeZone: string): RcaCasePatch {
  return {
    title: form.title.trim(),
    description: textOrNull(form.description),
    consequenceClass: form.consequenceClass,
    priority: form.priority,
    unitId: form.unitId,
    targetCloseDate: plantDayStart(form.targetCloseDate, timeZone),
    rootCause: textOrNull(form.rootCause),
    teamCharter: textOrNull(form.teamCharter),
    teamLeadId: form.teamLeadId,
    teamMemberIds: form.teamMemberIds,
  };
}

/** Statuses a case may be opened in (the server refuses others). */
const START_STATUSES: readonly RcaStatus[] = ['Draft', 'In Progress'];

/** POST body of a new case (Draft unless stated); a template's tree is copied by the server. */
export function buildCreateBody(form: RcaCaseForm, timeZone: string): RcaCaseBody {
  const status = START_STATUSES.includes(form.status) ? form.status : 'Draft';
  return { ...buildDefinitionPatch(form, timeZone), title: form.title.trim(), status, templateId: form.templateId };
}

/** A new item with a local id (ids are client labels; the server keeps them as given). */
export function newItemId(prefix: string, existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((item) => item.id));
  let index = existing.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}
