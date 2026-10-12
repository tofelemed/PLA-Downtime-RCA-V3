import type { RcaCaseBody, RcaCasePatch } from '@/api/v2/queries/rca-commands';
import type { RcaCaseView, RcaPriority, RcaStatus } from '@/api/v2/types/rca';
import { RCA_PRIORITIES, RCA_STATUSES } from '@/api/v2/types/rca';

/**
 * The case definition (the "Overview" form and the new-case page): the scalar v2 contract fields. Nested
 * content (evidence, recommendations, logic tree, event diagram) is saved by its own screens, each as a
 * PATCH of just that list.
 */
export interface RcaCaseForm {
  title: string;
  description: string;
  status: RcaStatus;
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

export function formFromCase(view: RcaCaseView): RcaCaseForm {
  return {
    title: view.title,
    description: view.description ?? '',
    status: asStatus(view.status),
    priority: asPriority(view.priority),
    unitId: view.unitId,
    targetCloseDate: view.targetCloseDate ? view.targetCloseDate.slice(0, 10) : '',
    rootCause: view.rootCause ?? '',
    teamCharter: view.teamCharter ?? '',
    teamLeadId: view.teamLeadId,
    teamMemberIds: view.teamMemberIds,
    templateId: view.templateId,
  };
}

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());
/** A calendar day as the UTC midnight instant the API stores. */
const dayOrNull = (value: string) => (value ? `${value}T00:00:00.000Z` : null);

/** PATCH body of the definition form: only declared scalar fields (the server refuses anything else). */
export function buildDefinitionPatch(form: RcaCaseForm): RcaCasePatch {
  return {
    title: form.title.trim(),
    description: textOrNull(form.description),
    status: form.status,
    priority: form.priority,
    unitId: form.unitId,
    targetCloseDate: dayOrNull(form.targetCloseDate),
    rootCause: textOrNull(form.rootCause),
    teamCharter: textOrNull(form.teamCharter),
    teamLeadId: form.teamLeadId,
    teamMemberIds: form.teamMemberIds,
  };
}

/** POST body of a new case (Draft unless stated); a template's tree is copied by the server. */
export function buildCreateBody(form: RcaCaseForm): RcaCaseBody {
  return { ...buildDefinitionPatch(form), title: form.title.trim(), templateId: form.templateId };
}

/** A new item with a local id (ids are client labels; the server keeps them as given). */
export function newItemId(prefix: string, existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((item) => item.id));
  let index = existing.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}
