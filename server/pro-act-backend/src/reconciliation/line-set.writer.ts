import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import {
  LineSetOrigin,
  ReconciliationLineSet,
} from './entities/reconciliation-line-set.entity';
import { ReconciliationLine } from './entities/reconciliation-line.entity';

const CHUNK = 500;

/** A line as written, without its set (the writer adds set, tenant, period and position). */
export type LineDraft = Omit<
  QueryDeepPartialEntity<ReconciliationLine>,
  'lineSetId' | 'tenantId' | 'periodId' | 'position'
>;

export interface LineSetDraft {
  revision: AccountingRevision;
  baseRunId: string;
  origin: LineSetOrigin;
  lines: readonly LineDraft[];
  actorId: string | null;
}

/**
 * Writes a reconciliation set (plan 2.8 step 2): a new numbered set and its lines, bulk-inserted in chunks,
 * then moves the revision's pointer — all with the caller's manager, so a failure anywhere leaves the
 * previous set current and the revision's row version (ETag) unchanged (T33).
 */
@Injectable()
export class LineSetWriter {
  async write(
    manager: EntityManager,
    draft: LineSetDraft,
  ): Promise<ReconciliationLineSet> {
    const { revision } = draft;
    const [{ next }] = await manager.query<Array<{ next: number }>>(
      `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "reconciliation_line_sets" WHERE "revision_id" = $1`,
      [revision.id],
    );
    const set = await manager.save(
      manager.create(ReconciliationLineSet, {
        tenantId: revision.tenantId,
        revisionId: revision.id,
        periodId: revision.periodId,
        version: next,
        baseRunId: draft.baseRunId,
        origin: draft.origin,
        createdBy: draft.actorId,
      }),
    );
    const rows = draft.lines.map(
      (line, position): QueryDeepPartialEntity<ReconciliationLine> => ({
        ...line,
        lineSetId: set.id,
        tenantId: revision.tenantId,
        periodId: revision.periodId,
        position,
        createdBy: draft.actorId,
      }),
    );
    await this.insertLines(manager, rows);
    return set;
  }

  /** Bulk insert in chunks of 500 (no N+1). */
  async insertLines(
    manager: EntityManager,
    rows: ReadonlyArray<QueryDeepPartialEntity<ReconciliationLine>>,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await manager.insert(ReconciliationLine, rows.slice(i, i + CHUNK));
    }
  }
}

/** A saved line carried into a new set (submit tolerance, revise copy). */
export function copyOf(line: ReconciliationLine): LineDraft {
  return {
    action: line.action,
    autoKey: line.autoKey,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: line.quantity === null ? null : String(line.quantity),
    baseQuantity: line.baseQuantity === null ? null : String(line.baseQuantity),
    uom: line.uom,
    basis: line.basis,
    reasonCodeId: line.reasonCodeId,
    impactCodeId: line.impactCodeId,
    evidence: line.evidence,
    adjustmentId: line.adjustmentId,
    missingCode: line.missingCode,
    missingEvent: line.missingEvent,
    reason: line.reason,
    comment: line.comment,
    authorId: line.authorId,
  };
}
