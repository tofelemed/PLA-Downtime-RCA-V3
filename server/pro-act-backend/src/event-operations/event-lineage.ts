import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { toLegacyStatus } from '../domain/events/legacy-status';
import { Interval } from '../domain/time/interval-algebra';
import { prepareUpdate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  changeMessage,
  EventChangeMessage,
} from '../production-event/revisions/event-change.notifier';
import { RevisionActor } from '../production-event/revisions/revision-actor';
import {
  appendCoding,
  appendRevision,
  codingFactsOf,
  nextRevisionNumber,
  reloadEvent,
  writeEvent,
} from '../production-event/revisions/revision-store';
import { EventRelation, EventRelationType } from './event-relation.entity';

/** Columns a derived event never inherits: identity, bookkeeping and the revision/lineage state. */
const NOT_INHERITED = [
  'id',
  'canonicalId',
  'occurrenceId',
  'createdAt',
  'updatedAt',
  'rowVersion',
  'durationSeconds',
  'currentSourceRevision',
  'currentCodingRevision',
  'retractedAt',
  'duplicateDeliveries',
  'userOverrides',
  'supersededByEventId',
] as const;

export interface DerivedEventInput {
  /** the event whose attributes and coding the new one carries */
  template: ProductionEvent;
  interval: Interval;
  /** values replacing the template's (occurrence, business id, amounts, merged coding) */
  columns: Partial<ProductionEvent>;
  actor: RevisionActor;
  reason: string;
}

/**
 * Inserts an event produced by a split or merge (DT09): template attributes and coding, its own
 * interval, states and legacy status re-derived by the write model, revision 1 of kind `system` and a
 * baseline coding revision 1. It has no source revision of its own: source evidence stays on the
 * superseded event.
 */
export async function insertDerivedEvent(
  manager: EntityManager,
  input: DerivedEventInput,
): Promise<ProductionEvent> {
  const id = randomUUID();
  const basis = { ...input.template, ...input.columns };
  const fields = prepareUpdate(basis, {
    startTime: input.interval.start,
    endTime: input.interval.end,
  });
  const repository = manager.getRepository(ProductionEvent);
  await repository.save(
    repository.create({
      ...inheritedColumns(input.template),
      ...input.columns,
      ...fields,
      id,
      canonicalId: id,
      currentSourceRevision: 0,
      currentCodingRevision: 1,
      userOverrides: {},
      duplicateDeliveries: 0,
      retractedAt: null,
      supersededByEventId: null,
    } as Partial<ProductionEvent>),
  );
  const saved = await reloadEvent(manager, id);
  await recordBirth(manager, saved, input);
  return saved;
}

/** Revision 1 (`system`, with the operation as reason) and the baseline coding revision 1. */
async function recordBirth(
  manager: EntityManager,
  event: ProductionEvent,
  provenance: { actor: RevisionActor; reason: string },
): Promise<void> {
  await appendRevision(manager, event, {
    revision: 1,
    kind: 'system',
    actor: provenance.actor,
    changeReason: provenance.reason,
  });
  await appendCoding(manager, event, {
    revision: 1,
    actor: provenance.actor,
    oldValues: {},
    newValues: codingFactsOf(event),
    reason: provenance.reason,
    overridesSourceRevision: null,
  });
}

/**
 * Marks a split parent or merge contributor `superseded` (accounting reads its replacements only;
 * v1 shows it as Cancelled) with a `system` revision. Nothing is deleted.
 */
export async function supersede(
  manager: EntityManager,
  event: ProductionEvent,
  input: {
    actor: RevisionActor;
    reason: string;
    supersededBy: string | null;
  },
): Promise<EventChangeMessage> {
  const updated = await writeEvent(manager, event.id, {
    physicalState: 'superseded',
    supersededByEventId: input.supersededBy,
    status: toLegacyStatus({
      physicalState: 'superseded',
      codingState: event.codingState,
      rcaState: event.rcaState,
    }),
  });
  const revision = await nextRevisionNumber(manager, event.id);
  await appendRevision(manager, updated, {
    revision,
    kind: 'system',
    actor: input.actor,
    changeReason: input.reason,
  });
  return changeMessage(event, updated, revision, 'system');
}

export interface RelationInput {
  tenantId: string;
  fromEventId: string;
  toEventId: string;
  relationType: EventRelationType;
  occurrenceId: string;
  actorId: string | null;
}

/** Records lineage rows (§14.2 `event_relations`). */
export async function relate(
  manager: EntityManager,
  relations: readonly RelationInput[],
): Promise<void> {
  const repository = manager.getRepository(EventRelation);
  await repository.save(
    relations.map((relation) =>
      repository.create({
        tenantId: relation.tenantId,
        fromEventId: relation.fromEventId,
        toEventId: relation.toEventId,
        relationType: relation.relationType,
        occurrenceId: relation.occurrenceId,
        confidence: null,
        approvedBy: null,
        createdBy: relation.actorId,
        updatedBy: relation.actorId,
      }),
    ),
  );
}

function inheritedColumns(template: ProductionEvent): Partial<ProductionEvent> {
  const copy: Partial<ProductionEvent> = { ...template };
  for (const key of NOT_INHERITED) delete copy[key];
  return copy;
}
