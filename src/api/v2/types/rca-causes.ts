/**
 * Typed causes of an RCA case (item 7; backend `src/rca-case/rca-causes.service.ts`): direct,
 * contributing and root causes, each optionally coded from the plant's cause library.
 */
import type { BodyOf } from '../schema-types';

export const RCA_CAUSE_KINDS = ['root', 'direct', 'contributing'] as const;
export type RcaCauseKind = (typeof RCA_CAUSE_KINDS)[number];

export type RcaCaseCauseBody = BodyOf<'/api/v2/rcas/{id}/causes', 'post'>;
export type RcaCaseCausePatch = BodyOf<'/api/v2/rca-case-causes/{id}', 'patch'>;

/** One cause of `GET /v2/rcas/{id}/causes`. */
export interface RcaCaseCauseView {
  id: string;
  rcaId: string;
  kind: RcaCauseKind;
  causeCodeId: string | null;
  /** the catalogue entry (null without a code); `active` false once it was retired */
  causeCode: { code: string; name: string; active: boolean } | null;
  statement: string;
  /** evidence items of the case supporting the cause */
  evidenceIds: string[];
  /** logic-tree nodes of the case behind the cause */
  nodeIds: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
