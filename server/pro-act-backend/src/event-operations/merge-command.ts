import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import {
  MergeCandidate,
  MergePlan,
  planMerge,
  sumAmounts,
} from '../domain/events/event-operations';
import { ProductionEvent } from '../production-event/production-event.entity';
import { changeMessage } from '../production-event/revisions/event-change.notifier';
import {
  actorFromContext,
  RevisionActor,
} from '../production-event/revisions/revision-actor';
import { insertDerivedEvent, relate, supersede } from './event-lineage';
import {
  assertOperable,
  assertVersions,
  derivedEventId,
  lockAllOrNotFound,
  OperationResult,
} from './operation-support';

/** User-layer fields that must agree across merge contributors (two different values conflict). */
const MERGE_CODING_FIELDS = [
  'reasonCodeId',
  'impactCodeId',
  'oeeCodeId',
  'oeeComponent',
  'impactMode',
  'impactFraction',
  'quantityUom',
  'rcaId',
] as const;

export interface MergeCommand {
  context: RequestContext;
  events: ReadonlyArray<{ eventId: string; expectedVersion: number }>;
  maxGapSeconds: number;
  overrideClassification: boolean;
  reason: string;
}

/**
 * DT09 merge: one event spanning the union of adjacent/overlapping events of one unit (within the gap
 * policy), coding from the earliest contributor (422 on conflicts), quantity and cost summed, the
 * earliest occurrence kept; contributors become `superseded` by it with `merged_from` lineage.
 */
export async function mergeIn(
  manager: EntityManager,
  command: MergeCommand,
): Promise<OperationResult> {
  const locked = await lockContributors(manager, command);
  const plan = planMerge(locked.map(toCandidate), {
    maxGapSeconds: command.maxGapSeconds,
    overrideClassification: command.overrideClassification,
  });
  const byId = new Map(locked.map((event) => [event.id, event]));
  const ordered = plan.ordered.map(({ id }) => byId.get(id) as ProductionEvent);
  const first = ordered[0];
  const actor = actorFromContext(command.context);
  const reason = `merge of ${ordered.map(({ id }) => id).join(', ')}: ${command.reason}`;
  const merged = await insertDerivedEvent(manager, {
    template: first,
    interval: plan.interval,
    columns: mergedColumns(plan, ordered),
    actor,
    reason,
  });
  await recordLineage(manager, merged, ordered, { actor, reason });
  return {
    outcome: {
      operation: 'merge',
      createdEventIds: [merged.id],
      supersededEventIds: ordered.map(({ id }) => id),
      updatedEventIds: [],
      occurrenceId: merged.occurrenceId,
    },
    messages: [changeMessage(merged, merged, 1, 'system')],
  };
}

async function lockContributors(
  manager: EntityManager,
  command: MergeCommand,
): Promise<ProductionEvent[]> {
  const ids = command.events.map(({ eventId }) => eventId);
  const locked = await lockAllOrNotFound(manager, command.context, ids);
  locked.forEach(assertOperable);
  assertVersions(
    locked,
    new Map(command.events.map((e) => [e.eventId, e.expectedVersion])),
  );
  return locked;
}

/** Merged coding, the earliest occurrence, summed quantity and cost (conserved across split/merge). */
function mergedColumns(
  plan: MergePlan,
  ordered: readonly ProductionEvent[],
): Partial<ProductionEvent> {
  return {
    ...plan.coding,
    occurrenceId: ordered[0].occurrenceId,
    eventId: derivedEventId(ordered[0].eventId, 'm'),
    quantity: sumAmounts(ordered.map(({ quantity }) => quantity)),
    cost: sumAmounts(ordered.map(({ cost }) => cost)),
  } as Partial<ProductionEvent>;
}

/** `merged_from` rows to every contributor; each contributor superseded by the merged event. */
async function recordLineage(
  manager: EntityManager,
  merged: ProductionEvent,
  contributors: readonly ProductionEvent[],
  provenance: { actor: RevisionActor; reason: string },
): Promise<void> {
  await relate(
    manager,
    contributors.map((contributor) => ({
      tenantId: merged.tenantUuid as string,
      fromEventId: merged.id,
      toEventId: contributor.id,
      relationType: 'merged_from' as const,
      occurrenceId: merged.occurrenceId,
      actorId: provenance.actor.id,
    })),
  );
  for (const contributor of contributors) {
    await supersede(manager, contributor, {
      ...provenance,
      supersededBy: merged.id,
    });
  }
}

function toCandidate(event: ProductionEvent): MergeCandidate {
  const coding: Record<string, string | number | null> = {};
  for (const field of MERGE_CODING_FIELDS) {
    coding[field] = event[field] ?? null;
  }
  return {
    id: event.id,
    unitId: event.unitId,
    interval: { start: event.startTime, end: event.endTime ?? null },
    classification: {
      physicalType: event.physicalType,
      scheduleClass: event.scheduleClass,
    },
    coding,
  };
}
