/**
 * RCA field history (item 2; backend `src/rca-case/rca-history.service.ts`): the append-only audit rows
 * of a case and of its actions, links, analysis tools and causes, newest first.
 */

/** Before / after of one small field (status, owner, due date, …; text fields as `<field>Length`). */
export interface RcaHistoryValueChange {
  from: unknown;
  to: unknown;
}

/** One entry of `GET /v2/rcas/{id}/history`. */
export interface RcaHistoryEntryView {
  id: string;
  at: string;
  /** `<entityType>.<verb>`, e.g. `rca_case.transitioned`, `rca_action.updated` */
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  /** null when the user is not readable any more, or a service acted */
  actorName: string | null;
  service: string | null;
  reason: string | null;
  revision: number | null;
  changedFields: string[];
  values: Record<string, RcaHistoryValueChange>;
  beforeHash: string | null;
  afterHash: string | null;
  /** the remaining facts of the command (tool, file name, link target, …) */
  detail: Record<string, unknown>;
}
