import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { toLegacyStatus } from '../../domain/events/legacy-status';
import { prepareUpdate } from '../event-write-model';
import { ProductionEvent } from '../production-event.entity';
import { EventChangeMessage, changeMessage } from './event-change.notifier';
import { EventCoding } from './event-coding.entity';
import {
  changedFields,
  completeFacts,
  EventFacts,
  normalizeFacts,
  SOURCE_FIELDS,
} from './event-facts';
import { EventReviewItem } from './event-review-item.entity';
import { ActorKind, EventRevision } from './event-revision.entity';
import { RevisionActor } from './revision-actor';
import {
  appendRevision,
  hasRevisionTenant,
  latestSourceRevision,
  lockEvent,
  nextRevisionNumber,
  writeEvent,
} from './revision-store';

/** Where a source delivery came from (ING06 provenance). */
export interface SourceProvenance {
  actorKind: Extract<ActorKind, 'connector' | 'system'>;
  /** the source's own version marker, e.g. the PI frame end time */
  sourceRevision?: string;
  reason?: string;
}

export type SourceOutcome = 'duplicate' | 'revised';

/** Result of a revision operation plus the message to publish after commit. */
export interface RevisionResult<T> {
  result: T;
  message: EventChangeMessage | null;
}

const CLASSIFICATION_KEYS = [
  'physicalType',
  'scheduleClass',
  'oeeComponent',
  'impactMode',
] as const;
const DATE_FIELDS: ReadonlySet<string> = new Set(['startTime', 'endTime']);

/**
 * ING01/ING06: identical content is a duplicate delivery (counted, no revision). Otherwise the changed
 * source fields without a user override are written, overridden ones open a review item, and a source
 * revision is recorded. Coding, RCA and workflow state are never reset (B5/I1).
 */
export async function applySourceIn(
  manager: EntityManager,
  eventId: string,
  rawFacts: Readonly<Record<string, unknown>>,
  provenance: SourceProvenance,
): Promise<RevisionResult<SourceOutcome>> {
  const existing = await lockTracked(manager, eventId);
  const facts = completeFacts(
    normalizeFacts(rawFacts, SOURCE_FIELDS),
    SOURCE_FIELDS,
  );
  const previous = await latestSourceRevision(manager, eventId);
  const changed = changedFields(previous?.sourceFacts ?? {}, facts);
  if (changed.length === 0) {
    await countDuplicate(manager, eventId);
    return { result: 'duplicate', message: null };
  }
  const overrides = existing.userOverrides ?? {};
  const accepted = changed.filter((field) => overrides[field] === undefined);
  const revision = await nextRevisionNumber(manager, eventId);
  const updated = await writeEvent(manager, eventId, {
    ...sourceColumns(existing, facts, accepted),
    currentSourceRevision: revision,
  });
  const stored = await appendRevision(manager, updated, {
    revision,
    kind: 'source',
    actor: { id: null, kind: provenance.actorKind },
    sourceFacts: facts,
    changeReason: provenance.reason,
    sourceRevision: provenance.sourceRevision,
  });
  const conflicts = changed.filter((field) => overrides[field] !== undefined);
  await openConflicts(manager, updated, stored, conflicts);
  return {
    result: 'revised',
    message: changeMessage(existing, updated, revision, 'source'),
  };
}

/**
 * Columns for source `fields` taken from `facts`, with interval, classification, states, legacy status
 * and duration re-derived by the write model from the stored row. Classification axes the user
 * overrode keep the user's value even when the source changes the event type.
 */
export function sourceColumns(
  existing: ProductionEvent,
  facts: EventFacts,
  fields: readonly string[],
): Partial<ProductionEvent> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = facts[field] ?? null;
    values[field] =
      DATE_FIELDS.has(field) && typeof value === 'string'
        ? new Date(value)
        : value;
  }
  const derived = prepareUpdate(existing, {
    startTime: values.startTime as Date | undefined,
    endTime: fields.includes('endTime')
      ? ((values.endTime as Date | null) ?? null)
      : undefined,
    eventType: values.eventType as string | null | undefined,
  });
  const overrides = existing.userOverrides ?? {};
  for (const key of CLASSIFICATION_KEYS) {
    if (overrides[key] !== undefined) {
      Object.assign(derived, { [key]: existing[key] });
    }
  }
  return { ...values, ...derived } as Partial<ProductionEvent>;
}

/** Tombstones an event (ING01): never deleted, `retracted` everywhere, legacy status 'Cancelled'. */
export async function retractIn(
  manager: EntityManager,
  eventId: string,
  provenance: { actor: RevisionActor; reason: string; sourceRevision?: string },
): Promise<RevisionResult<ProductionEvent>> {
  const existing = await lockTracked(manager, eventId);
  if (existing.physicalState === 'retracted') {
    return { result: existing, message: null };
  }
  const states = {
    physicalState: 'retracted' as const,
    codingState: existing.codingState,
    rcaState: existing.rcaState,
  };
  const updated = await writeEvent(manager, eventId, {
    physicalState: states.physicalState,
    retractedAt: new Date(),
    status: toLegacyStatus(states),
  });
  const revision = await nextRevisionNumber(manager, eventId);
  await appendRevision(manager, updated, {
    revision,
    kind: 'retraction',
    actor: provenance.actor,
    changeReason: provenance.reason,
    sourceRevision: provenance.sourceRevision,
  });
  return {
    result: updated,
    message: changeMessage(existing, updated, revision, 'retraction'),
  };
}

/** Raw UPDATE: a duplicate changes nothing a client sees, so `row_version` must not move. */
async function countDuplicate(
  manager: EntityManager,
  eventId: string,
): Promise<void> {
  await manager.query(
    `UPDATE "production_events" SET "duplicate_deliveries" = "duplicate_deliveries" + 1 WHERE "id" = $1`,
    [eventId],
  );
}

async function lockTracked(
  manager: EntityManager,
  eventId: string,
): Promise<ProductionEvent> {
  const existing = await lockEvent(manager, eventId);
  if (!existing) {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Event not found',
    });
  }
  if (!hasRevisionTenant(existing)) {
    throw new UnprocessableEntityException({
      code: 'EVENT_WITHOUT_TENANT',
      message: `Event ${eventId} has no uuid tenant and cannot be revised`,
    });
  }
  return existing;
}

/** §5.3: one open `source_vs_override_conflict` per overridden field the source changed. */
async function openConflicts(
  manager: EntityManager,
  event: ProductionEvent,
  sourceRevision: EventRevision,
  fields: readonly string[],
): Promise<void> {
  const overrides = event.userOverrides ?? {};
  const items = manager.getRepository(EventReviewItem);
  for (const field of fields) {
    const coding = await manager.getRepository(EventCoding).findOne({
      where: { eventId: event.id, revision: overrides[field] },
      select: { id: true },
    });
    await items.save(
      items.create({
        tenantId: sourceRevision.tenantId,
        eventId: event.id,
        kind: 'source_vs_override_conflict',
        field,
        sourceRevisionId: sourceRevision.id,
        codingRevisionId: coding?.id ?? null,
        state: 'open',
        createdBy: null,
        updatedBy: null,
      }),
    );
  }
}
