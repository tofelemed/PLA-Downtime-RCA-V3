import type { RcaCaseCauseBody, RcaCaseCausePatch, RcaCaseCauseView, RcaCauseKind } from '@/api/v2/types/rca-causes';
import { RCA_CAUSE_KINDS } from '@/api/v2/types/rca-causes';

/** Item 7: the cause form; '' = no catalogue code. */
export interface CauseForm {
  kind: RcaCauseKind;
  causeCodeId: string;
  statement: string;
  evidenceIds: string[];
  nodeIds: string[];
}

/** Anchor of the Causes panel on the analysis page (the coded root-cause blocker links there). */
export const CAUSES_ANCHOR = 'causes';

export const CAUSE_STATEMENT_MAX = 4000;
/** the server accepts at most 50 evidence items and 50 logic-tree nodes per cause */
export const CAUSE_LINKS_MAX = 50;

/** Once closure is requested the causes are frozen (the server answers 422 CAUSES_LOCKED). */
const LOCKED_STATUSES: ReadonlySet<string> = new Set(['Closure Review', 'Closed']);

export const causesLocked = (status: string | null): boolean => status !== null && LOCKED_STATUSES.has(status);

export const EMPTY_CAUSE_FORM: CauseForm = { kind: 'root', causeCodeId: '', statement: '', evidenceIds: [], nodeIds: [] };

export const asCauseKind = (value: string): RcaCauseKind => RCA_CAUSE_KINDS.find((kind) => kind === value) ?? 'root';

export function causeFormOf(cause: RcaCaseCauseView): CauseForm {
  return {
    kind: cause.kind,
    causeCodeId: cause.causeCodeId ?? '',
    statement: cause.statement,
    evidenceIds: [...cause.evidenceIds],
    nodeIds: [...cause.nodeIds],
  };
}

export const causeFormValid = (form: CauseForm): boolean => {
  const statement = form.statement.trim();
  return statement.length > 0 && statement.length <= CAUSE_STATEMENT_MAX;
};

export function buildCauseBody(form: CauseForm): RcaCaseCauseBody {
  return {
    kind: form.kind,
    causeCodeId: form.causeCodeId || null,
    statement: form.statement.trim(),
    evidenceIds: form.evidenceIds,
    nodeIds: form.nodeIds,
  };
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** PATCH of what changed (empty = nothing to save), so an untouched retired code is never re-sent. */
export function buildCausePatch(form: CauseForm, cause: RcaCaseCauseView): RcaCaseCausePatch {
  const before = causeFormOf(cause);
  const statement = form.statement.trim();
  return {
    ...(form.kind !== before.kind ? { kind: form.kind } : {}),
    ...(form.causeCodeId !== before.causeCodeId ? { causeCodeId: form.causeCodeId || null } : {}),
    ...(statement !== before.statement ? { statement } : {}),
    ...(!sameIds(form.evidenceIds, before.evidenceIds) ? { evidenceIds: form.evidenceIds } : {}),
    ...(!sameIds(form.nodeIds, before.nodeIds) ? { nodeIds: form.nodeIds } : {}),
  };
}

/** Adds or removes one id (keeping the list order of the case and at most `CAUSE_LINKS_MAX`). */
export function toggleId(ids: readonly string[], id: string, order: readonly string[]): string[] {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= CAUSE_LINKS_MAX) return [...ids];
  const next = new Set([...ids, id]);
  return [...order.filter((item) => next.has(item)), ...ids.filter((item) => !order.includes(item))];
}

/** Causes grouped Root → Direct → Contributing, each group oldest first (the server's order). */
export function groupCauses(causes: readonly RcaCaseCauseView[]): Array<{ kind: RcaCauseKind; causes: RcaCaseCauseView[] }> {
  return RCA_CAUSE_KINDS.map((kind) => ({ kind, causes: causes.filter((cause) => cause.kind === kind) }));
}
