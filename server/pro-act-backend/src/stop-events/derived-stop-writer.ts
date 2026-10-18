import { EntityManager } from 'typeorm';
import {
  DerivedItem,
  DerivedWrite,
  DerivedWritePlan,
  EngineOwnedEvent,
} from '../domain/reliability/derived-stop-writes';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import { SYSTEM_ACTOR } from '../production-event/revisions/revision-actor';
import {
  applySourceIn,
  retractIn,
} from '../production-event/revisions/source-revision';
import { ActiveCodingRule } from '../rules/rule-defaults';
import { engineCreateFields } from './derived-rule-defaults';

/** `production_events.source` of state-derived stops. */
export const STATE_ENGINE_SOURCE = 'State engine';

/** Business id prefix of a unit's derived stops: `state:<unit>:<state>@<start ms>`. */
export const derivedEventIdPrefix = (unitId: string) => `state:${unitId}:`;

export interface UnitScope {
  tenantId: string;
  unitId: string;
}

/** Where new engine events go: the unit, and the tenant's active `coding_default` rules (plan 3.8). */
export interface EngineTarget {
  scope: UnitScope;
  rules: readonly ActiveCodingRule[];
}

const ENGINE_OWNED_SQL = `SELECT e."id", e."event_id", e."physical_state", e."end_time", e."occurrence_id", e."description",
       e."impact_fraction", e."impact_basis"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."source_kind" = 'derived'
   AND e."event_id" LIKE $3 AND e."start_time" >= $4 AND e."start_time" < $5`;

interface OwnedRow {
  id: string;
  event_id: string;
  physical_state: string;
  end_time: Date | null;
  occurrence_id: string;
  description: string | null;
  impact_fraction: string | number | null;
  impact_basis: string;
}

/**
 * Events the engine wrote for the unit whose stop starts inside the window, in any physical state (a
 * superseded or retracted key is never written again). Split / merge results carry `#` in their business
 * id and are not the engine's (index tenant + unit + start).
 */
export async function loadEngineOwned(
  manager: EntityManager,
  scope: UnitScope,
  window: { start: Date; end: Date },
): Promise<EngineOwnedEvent[]> {
  const prefix = derivedEventIdPrefix(scope.unitId);
  const rows = await manager.query<OwnedRow[]>(ENGINE_OWNED_SQL, [
    scope.tenantId,
    scope.unitId,
    `${prefix}%`,
    window.start,
    window.end,
  ]);
  return rows
    .filter((row) => !row.event_id.includes('#'))
    .map((row) => ({
      id: row.id,
      key: row.event_id.slice(prefix.length),
      live: row.physical_state === 'open' || row.physical_state === 'closed',
      end: row.end_time ? new Date(row.end_time) : null,
      occurrenceId: row.occurrence_id,
      description: row.description,
      impactFraction:
        row.impact_fraction === null ? null : String(row.impact_fraction),
      impactBasis: row.impact_basis,
    }));
}

export const sourceFacts = (write: DerivedWrite<DerivedItem>) => ({
  startTime: write.stop.start,
  endTime: write.stop.end,
  eventType: 'ProductionLoss',
  description: write.description,
});

/**
 * Applies a derived-write plan in the caller's transaction: new events with revision 1 (`source`, system
 * actor), the baseline coding and the rule-filled open axes, changed ends / bounds as source revisions (a user override of the end
 * keeps the user's value and opens a review item), occurrence moves as system writes, and gone keys
 * retracted (tombstones). Returns the change messages for the outbox.
 */
export async function applyDerivedWrites(
  manager: EntityManager,
  revisions: EventRevisionService,
  input: EngineTarget & { plan: DerivedWritePlan },
): Promise<EventChangeMessage[]> {
  const { plan } = input;
  const messages: Array<EventChangeMessage | null> = [];
  for (const write of plan.create) {
    messages.push(await createDerived(manager, revisions, input, write));
  }
  for (const write of plan.update) {
    const outcome = await applySourceIn(manager, write.id, sourceFacts(write), {
      actorKind: 'system',
      reason: 'state engine reprocessing',
    });
    messages.push(outcome.message);
    await moveOccurrence(manager, write.id, write.occurrenceId);
  }
  for (const id of plan.retract) {
    const outcome = await retractIn(manager, id, {
      actor: SYSTEM_ACTOR,
      reason:
        'state engine: the stop is no longer in the state timeline (late or corrected samples)',
    });
    messages.push(outcome.message);
  }
  return messages.filter((m): m is EventChangeMessage => m !== null);
}

/**
 * Moves an event to another stop occurrence (bookkeeping of which events are one physical stop, like the
 * occurrence trigger on insert); no-op when it is already there.
 */
export async function moveOccurrence(
  manager: EntityManager,
  eventId: string,
  occurrenceId: string,
): Promise<void> {
  await manager.query(
    `UPDATE "production_events" SET "occurrence_id" = $2 WHERE "id" = $1 AND "occurrence_id" <> $2`,
    [eventId, occurrenceId],
  );
}

async function createDerived(
  manager: EntityManager,
  revisions: EventRevisionService,
  target: EngineTarget,
  write: DerivedWrite & { id: string },
): Promise<EventChangeMessage | null> {
  const { scope } = target;
  // the schedule class comes from the state mapping (an engine fact); the rest is open to the rules
  const { fields, columns } = engineCreateFields(target.rules, {
    unitId: scope.unitId,
    stated: ['scheduleClass'],
    input: {
      ...sourceFacts(write),
      source: STATE_ENGINE_SOURCE,
      classification: {
        physicalType: 'downtime',
        scheduleClass: write.stop.scheduleClass,
        oeeComponent: 'availability',
        impactMode: 'full_stop',
      },
    },
  });
  const repository = manager.getRepository(ProductionEvent);
  const saved = await repository.save(
    repository.create({
      ...fields,
      ...columns,
      id: write.id,
      canonicalId: write.id,
      occurrenceId: write.occurrenceId,
      tenantId: scope.tenantId,
      unitId: scope.unitId,
      eventId: `${derivedEventIdPrefix(scope.unitId)}${write.stop.key}`,
      eventType: 'ProductionLoss',
      source: STATE_ENGINE_SOURCE,
      description: write.description,
      sourceKind: 'derived',
      currentSourceRevision: 1,
      currentCodingRevision: 1,
    } as Partial<ProductionEvent>),
  );
  return revisions.recordCreated(saved, SYSTEM_ACTOR, manager);
}
