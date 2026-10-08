import { BulkJob } from '../../event-operations/bulk-job.entity';
import {
  EventRelation,
  EventRelationType,
} from '../../event-operations/event-relation.entity';
import { OperationOutcome } from '../../event-operations/operation-support';
import { ProductionEventV2View } from './production-event-v2.view';

/** Lineage row (§14.2 `event_relations`): `split_child_of` child → parent, `merged_from` merged → contributor. */
export interface EventRelationView {
  id: string;
  relationType: EventRelationType;
  fromEventId: string;
  toEventId: string;
  occurrenceId: string | null;
  /** decimal string 0..1 for inferred relations */
  confidence: string | null;
  approvedBy: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** Body of split / merge / close: what changed plus the resulting events (created, then updated). */
export interface EventOperationView extends OperationOutcome {
  events: ProductionEventV2View[];
}

/** `GET /api/v2/jobs/{id}` (API04). */
export interface BulkJobView {
  id: string;
  kind: BulkJob['kind'];
  state: BulkJob['state'];
  total: number;
  processed: number;
  failed: number;
  chunks: BulkJob['chunks'];
  requestedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export function toEventRelationView(row: EventRelation): EventRelationView {
  return {
    id: row.id,
    relationType: row.relationType,
    fromEventId: row.fromEventId,
    toEventId: row.toEventId,
    occurrenceId: row.occurrenceId ?? null,
    confidence: row.confidence ?? null,
    approvedBy: row.approvedBy ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function toBulkJobView(job: BulkJob): BulkJobView {
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    total: job.total,
    processed: job.processed,
    failed: job.failed,
    chunks: job.chunks,
    requestedBy: job.requestedBy ?? null,
    createdAt: new Date(job.createdAt).toISOString(),
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
  };
}
