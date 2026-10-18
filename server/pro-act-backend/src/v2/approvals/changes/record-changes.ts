import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { RCA } from '../../../rca/rca.entity';
import { MonthClose } from '../../../close/entities/month-close.entity';
import { StopReconciliation } from '../../../stop-events/entities/stop-reconciliation.entity';
import { ProductionEvent } from '../../../production-event/production-event.entity';
import { ChangeRow, ChangeSource, FieldSpec } from './change-types';

async function rowsOf<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  tenantId: string,
  ids: readonly string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return manager
    .createQueryBuilder(entity, 'r')
    .where('r.tenantId = :tenantId', { tenantId })
    .andWhere('r.id IN (:...ids)', { ids })
    .getMany();
}

const RCA_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Case' },
  { key: 'status', label: 'Status' },
  { key: 'closureNote', label: 'Closure note' },
  { key: 'residualRisk', label: 'Residual risk' },
  { key: 'effectivenessVerdict', label: 'Effectiveness verdict' },
  { key: 'rootCause', label: 'Root cause' },
  { key: 'consequenceClass', label: 'Consequence class' },
  { key: 'closureRequestedBy', label: 'Closure requested by', ref: 'user' },
  { key: 'closureRequestedAt', label: 'Closure requested', format: 'instant' },
];

const MONTH_FIELDS: FieldSpec[] = [
  { key: 'monthKey', label: 'Month' },
  { key: 'state', label: 'Close state' },
  { key: 'firstDate', label: 'First day', format: 'date' },
  { key: 'endDate', label: 'Ends before', format: 'date' },
  { key: 'quantitiesClosedBy', label: 'Quantities closed by', ref: 'user' },
  { key: 'quantitiesClosedAt', label: 'Quantities closed', format: 'instant' },
  {
    key: 'materialityRequired',
    label: 'Materiality review required',
    format: 'boolean',
  },
  {
    key: 'materialityReviewedBy',
    label: 'Materiality reviewed by',
    ref: 'user',
  },
  {
    key: 'materialityReviewedAt',
    label: 'Materiality reviewed',
    format: 'instant',
  },
  { key: 'financeSignedOffBy', label: 'Finance signed off by', ref: 'user' },
  { key: 'financeSignedOffAt', label: 'Finance signed off', format: 'instant' },
  { key: 'reopenCount', label: 'Times reopened', format: 'number' },
  { key: 'comment', label: 'Comment' },
];

/** Content of records without a predecessor: the RCA case asking for closure, the month close step. */
export async function loadRecordChanges(
  manager: EntityManager,
  kind: 'rca-closure' | 'month',
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const rows: ObjectLiteral[] =
    kind === 'rca-closure'
      ? await rowsOf(manager, RCA, tenantId, ids)
      : await rowsOf(manager, MonthClose, tenantId, ids);
  const specs = kind === 'rca-closure' ? RCA_FIELDS : MONTH_FIELDS;
  return rows.map((row) => ({
    id: row.id as string,
    after: { ...row },
    before: null,
    specs,
    afterLabel: 'Pending',
  }));
}

const STOP_FIELDS: FieldSpec[] = [
  { key: 'startTime', label: 'Start', format: 'instant' },
  { key: 'endTime', label: 'End', format: 'instant' },
  { key: 'durationSeconds', label: 'Duration', format: 'duration' },
  { key: 'sourceKind', label: 'Recorded by' },
  { key: 'reasonCodeId', label: 'Reason', ref: 'reason-code' },
  { key: 'startDeltaSeconds', label: 'Starts apart', format: 'duration' },
  { key: 'endDeltaSeconds', label: 'Ends apart', format: 'duration' },
  { key: 'toleranceSeconds', label: 'Merge tolerance', format: 'duration' },
  { key: 'conflicts', label: 'Different cause fields' },
];

function stopRow(
  event: ProductionEvent | undefined,
  pair: StopReconciliation,
): ChangeRow {
  return {
    startTime: event?.startTime ?? null,
    endTime: event?.endTime ?? null,
    durationSeconds: event?.durationSeconds ?? null,
    sourceKind: event?.sourceKind ?? null,
    reasonCodeId: event?.reasonCodeId ?? null,
    startDeltaSeconds: pair.startDeltaSeconds,
    endDeltaSeconds: pair.endDeltaSeconds,
    toleranceSeconds: pair.toleranceSeconds,
    conflicts: pair.conflicts.length ? pair.conflicts.join(', ') : null,
  };
}

/** A suggested duplicate stop side by side with the stop that would be kept. */
export async function loadStopMergeChanges(
  manager: EntityManager,
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const pairs = await rowsOf(manager, StopReconciliation, tenantId, ids);
  const events = await rowsOf(manager, ProductionEvent, tenantId, [
    ...new Set(
      pairs.flatMap((pair) => [pair.keptEventId, pair.evidenceEventId]),
    ),
  ]);
  const byId = new Map(events.map((event) => [event.id, event]));
  return pairs.map((pair) => ({
    id: pair.id,
    before: stopRow(byId.get(pair.keptEventId), pair),
    after: stopRow(byId.get(pair.evidenceEventId), pair),
    specs: STOP_FIELDS,
    mode: 'compare',
    beforeLabel: 'Stop kept',
    afterLabel: 'Suggested duplicate',
  }));
}
