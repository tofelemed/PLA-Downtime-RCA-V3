import { EntityManager } from 'typeorm';
import {
  LossLineDraft,
  PeriodAccounting,
} from '../domain/accounting/accounting.types';
import { canon } from './reviewed-content';
import { RevisionState } from './revision-state';

const CANDIDATE_KINDS = new Set(['availability', 'performance', 'quality']);

/** Classification of a loss line's cause event a proposal names when it changes (Marun regression R3). */
export const CODING_AXES = [
  'oeeComponent',
  'scheduleClass',
  'impactMode',
] as const;
export type CodingAxis = (typeof CODING_AXES)[number];

/** The cause event's classification behind an approved loss line, as its event revision recorded it. */
export type CauseCoding = Record<CodingAxis, string | null>;

export interface CodingFieldChange {
  field: CodingAxis;
  before: string | null;
  after: string | null;
}

/** A plan-ledger loss line whose reason code or cause classification differs between the approved run and the new inputs. */
export interface CodingChange {
  autoKey: string;
  sliceId: string;
  kind: string;
  /** the line's quantity under the new inputs */
  quantity: string | null;
  before: string | null;
  after: string | null;
  /** changed classification of the cause event; absent = none changed */
  fields?: CodingFieldChange[];
}

/**
 * Per approved plan-ledger candidate line (by auto key): the classification of its cause event at the event
 * revision the approved run used (`loss_line_evidence.event_revision_id` → `event_revisions.effective_facts`).
 * The evidence of the line's cause event is preferred. Uses IDX_loss_line_evidence_line.
 */
const CAUSE_CODING_SQL = `SELECT DISTINCT ON (ev."loss_line_id") ev."loss_line_id" AS "lineId",
       r."effective_facts"->>'oeeComponent' AS "oeeComponent",
       r."effective_facts"->>'scheduleClass' AS "scheduleClass",
       r."effective_facts"->>'impactMode' AS "impactMode"
  FROM "loss_line_evidence" ev
  JOIN "loss_lines" l ON l."id" = ev."loss_line_id"
  JOIN "event_revisions" r ON r."id" = ev."event_revision_id"
 WHERE ev."tenant_id" = $1 AND ev."loss_line_id" = ANY($2::uuid[])
 ORDER BY ev."loss_line_id", (ev."event_id" = l."cause_event_id") DESC NULLS LAST, ev."clipped_start"`;

export async function approvedCauseCoding(
  manager: EntityManager,
  state: RevisionState,
): Promise<Map<string, CauseCoding>> {
  const lines = state.candidateLines.filter(
    (l) => l.ledger === 'plan' && l.autoKey && CANDIDATE_KINDS.has(l.kind),
  );
  if (lines.length === 0) return new Map();
  const keyOf = new Map(lines.map((l) => [l.id, l.autoKey as string]));
  const rows: Array<{ lineId: string } & CauseCoding> = await manager.query(
    CAUSE_CODING_SQL,
    [state.period.tenantId, [...keyOf.keys()]],
  );
  return new Map(
    rows.map((row) => [
      keyOf.get(row.lineId) as string,
      {
        oeeComponent: row.oeeComponent,
        scheduleClass: row.scheduleClass,
        impactMode: row.impactMode,
      },
    ]),
  );
}

function fieldChangesOf(
  approved: CauseCoding | undefined,
  line: LossLineDraft,
): CodingFieldChange[] {
  if (!approved || !line.cause) return [];
  const cause = line.cause;
  return CODING_AXES.flatMap((field) => {
    const after = cause[field] ?? null;
    return approved[field] === after
      ? []
      : [{ field, before: approved[field], after }];
  });
}

/**
 * Marun E2E note D / regression R3: the reason codes and cause classifications (OEE component, schedule
 * class, impact) a change proposal would change, per loss line (matched by its stable auto key), so the
 * accepting manager sees a re-coding and not only quantities. Lines that appear or go away are already in
 * the ledger figures. `causeCoding` absent = reason codes only.
 */
export function codingChangesOf(
  state: RevisionState,
  preview: PeriodAccounting,
  causeCoding: ReadonlyMap<string, CauseCoding> = new Map(),
): CodingChange[] {
  const approved = new Map(
    state.candidateLines
      .filter((l) => l.ledger === 'plan' && l.autoKey)
      .map((l) => [l.autoKey as string, l.reasonCodeId]),
  );
  return preview.lines
    .filter((l) => l.ledger === 'plan' && CANDIDATE_KINDS.has(l.kind))
    .flatMap((l) => {
      if (!approved.has(l.autoKey)) return [];
      const before = approved.get(l.autoKey) ?? null;
      const after = l.cause?.reasonCodeId ?? null;
      const fields = fieldChangesOf(causeCoding.get(l.autoKey), l);
      if (before === after && fields.length === 0) return [];
      const change: CodingChange = {
        autoKey: l.autoKey,
        sliceId: l.sliceId,
        kind: l.kind,
        quantity: canon(l.quantity),
        before,
        after,
      };
      return [fields.length > 0 ? { ...change, fields } : change];
    });
}
