import { EntityManager } from 'typeorm';
import { toLegacyStatus } from '../domain/events/legacy-status';
import {
  CAUSE_FIELDS,
  CauseValues,
} from '../domain/events/stop-reconciliation';
import { EventRelation } from '../event-operations/event-relation.entity';
import { relate, supersede } from '../event-operations/event-lineage';
import { prepareUpdate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  changeMessage,
  EventChangeMessage,
} from '../production-event/revisions/event-change.notifier';
import { RevisionActor } from '../production-event/revisions/revision-actor';
import {
  appendRevision,
  lockEvent,
  nextRevisionNumber,
  writeEvent,
} from '../production-event/revisions/revision-store';
import { applyUserChangeIn } from '../production-event/revisions/user-change';
import { moveOccurrence } from './derived-stop-writer';

const isLive = (event: ProductionEvent | null): event is ProductionEvent =>
  event !== null &&
  (event.physicalState === 'open' || event.physicalState === 'closed');

export interface MergeOutcome {
  /** cause values actually written onto the kept event */
  copied: CauseValues;
  evidenceOccurrenceId: string;
  messages: EventChangeMessage[];
}

/** Locks both events in id order (no deadlock with concurrent operations); null unless both are live. */
async function lockPair(
  manager: EntityManager,
  keptId: string,
  evidenceId: string,
): Promise<{ kept: ProductionEvent; evidence: ProductionEvent } | null> {
  const [first, second] = [keptId, evidenceId].sort();
  const locked = new Map<string, ProductionEvent | null>([
    [first, await lockEvent(manager, first)],
    [second, await lockEvent(manager, second)],
  ]);
  const kept = locked.get(keptId) ?? null;
  const evidence = locked.get(evidenceId) ?? null;
  return isLive(kept) && isLive(evidence) ? { kept, evidence } : null;
}

/** The cause values of `wanted` still empty on the event (never overwriting a value). */
function stillEmpty(event: ProductionEvent, wanted: CauseValues): CauseValues {
  const fields: CauseValues = {};
  for (const field of CAUSE_FIELDS) {
    const value = wanted[field];
    if (value != null && (event[field] ?? null) === null) fields[field] = value;
  }
  return fields;
}

/** Writes cause values as a system coding revision; the coding state moves forward with a reason. */
async function writeCause(
  manager: EntityManager,
  eventId: string,
  values: CauseValues,
  provenance: { actor: RevisionActor; reason: string },
): Promise<EventChangeMessage | null> {
  if (Object.keys(values).length === 0) return null;
  const outcome = await applyUserChangeIn(manager, {
    actor: provenance.actor,
    eventId,
    reason: provenance.reason,
    patch: (locked) => {
      const next = { ...locked, ...values } as ProductionEvent;
      const derived = prepareUpdate(next, {
        reasonCodeId: next.reasonCodeId ?? null,
      });
      return {
        ...values,
        codingState: derived.codingState,
        status: derived.status,
      } as Partial<ProductionEvent>;
    },
  });
  return outcome.message;
}

/**
 * DT-04 merge of one stop recorded twice: the evidence fills the kept event's empty cause fields (system
 * coding revision), becomes `superseded` by the kept event (system revision, v1 "Cancelled"), joins its
 * occurrence and gets a `correlated_with` relation (kept → evidence). Nothing is deleted; `undoMerge`
 * restores both. Null when either event is no longer live.
 */
export async function mergeDuplicate(
  manager: EntityManager,
  pair: { keptId: string; evidenceId: string; copied: CauseValues },
  provenance: { actor: RevisionActor; reason: string },
): Promise<MergeOutcome | null> {
  const locked = await lockPair(manager, pair.keptId, pair.evidenceId);
  if (!locked) return null;
  const { kept, evidence } = locked;
  const copied = stillEmpty(kept, pair.copied);
  const messages = [
    await writeCause(manager, kept.id, copied, provenance),
    await supersede(manager, evidence, {
      ...provenance,
      supersededBy: kept.id,
    }),
  ];
  await relate(manager, [
    {
      tenantId: kept.tenantId as string,
      fromEventId: kept.id,
      toEventId: evidence.id,
      relationType: 'correlated_with',
      occurrenceId: kept.occurrenceId,
      actorId: provenance.actor.id,
    },
  ]);
  await moveOccurrence(manager, evidence.id, kept.occurrenceId);
  return {
    copied,
    evidenceOccurrenceId: evidence.occurrenceId,
    messages: messages.filter((m): m is EventChangeMessage => m !== null),
  };
}

export interface UndoInput {
  keptId: string;
  evidenceId: string;
  copied: CauseValues;
  evidenceOccurrenceId: string | null;
}

/** Restores a superseded duplicate to open / closed with a system revision. */
async function restore(
  manager: EntityManager,
  evidence: ProductionEvent,
  provenance: { actor: RevisionActor; reason: string },
): Promise<EventChangeMessage> {
  const physicalState = evidence.endTime ? 'closed' : 'open';
  const updated = await writeEvent(manager, evidence.id, {
    physicalState,
    supersededByEventId: null,
    status: toLegacyStatus({
      physicalState,
      codingState: evidence.codingState,
      rcaState: evidence.rcaState,
    }),
  });
  const revision = await nextRevisionNumber(manager, evidence.id);
  await appendRevision(manager, updated, {
    revision,
    kind: 'system',
    actor: provenance.actor,
    changeReason: provenance.reason,
  });
  return changeMessage(evidence, updated, revision, 'system');
}

/** Copied cause values still unchanged on the kept event, cleared again. */
function stillCopied(kept: ProductionEvent, copied: CauseValues): CauseValues {
  const cleared: CauseValues = {};
  for (const field of CAUSE_FIELDS) {
    if (copied[field] != null && kept[field] === copied[field]) {
      cleared[field] = null;
    }
  }
  return cleared;
}

/**
 * Undo of a duplicate merge: the evidence is live again in its own occurrence, the relation is removed and
 * the cause values the merge copied are cleared where nobody changed them since. Null when the kept event
 * is no longer live or the evidence is not superseded by it (a later operation took over).
 */
export async function undoMerge(
  manager: EntityManager,
  input: UndoInput,
  provenance: { actor: RevisionActor; reason: string },
): Promise<EventChangeMessage[] | null> {
  const [first, second] = [input.keptId, input.evidenceId].sort();
  const rows = new Map([
    [first, await lockEvent(manager, first)],
    [second, await lockEvent(manager, second)],
  ]);
  const kept = rows.get(input.keptId) ?? null;
  const evidence = rows.get(input.evidenceId) ?? null;
  if (!isLive(kept) || !evidence) return null;
  if (
    evidence.physicalState !== 'superseded' ||
    evidence.supersededByEventId !== kept.id
  ) {
    return null;
  }
  const messages = [
    await restore(manager, evidence, provenance),
    await writeCause(
      manager,
      kept.id,
      stillCopied(kept, input.copied),
      provenance,
    ),
  ];
  await manager.getRepository(EventRelation).delete({
    tenantId: kept.tenantId as string,
    fromEventId: kept.id,
    toEventId: evidence.id,
    relationType: 'correlated_with',
  });
  if (input.evidenceOccurrenceId) {
    await moveOccurrence(manager, evidence.id, input.evidenceOccurrenceId);
  }
  return messages.filter((m): m is EventChangeMessage => m !== null);
}
