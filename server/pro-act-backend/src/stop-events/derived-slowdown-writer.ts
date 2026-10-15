import { EntityManager } from 'typeorm';
import { DerivedSlowdown } from '../domain/reliability/derived-slowdowns';
import {
  DerivedWrite,
  DerivedWritePlan,
  EngineOwnedEvent,
} from '../domain/reliability/derived-stop-writes';
import { prepareCreate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import { SYSTEM_ACTOR } from '../production-event/revisions/revision-actor';
import {
  applySourceIn,
  retractIn,
} from '../production-event/revisions/source-revision';
import { applyUserChangeIn } from '../production-event/revisions/user-change';
import {
  derivedEventIdPrefix,
  sourceFacts,
  STATE_ENGINE_SOURCE,
  UnitScope,
} from './derived-stop-writer';

/** Key prefix of the engine's reduced-rate slowdowns (`state:<unit>:reduced_rate@<start ms>`). */
export const SLOWDOWN_KEY_PREFIX = 'reduced_rate@';

export const isSlowdownKey = (owned: EngineOwnedEvent) =>
  owned.key.startsWith(SLOWDOWN_KEY_PREFIX);

type SlowdownWrite = DerivedWrite<DerivedSlowdown> & { id: string };

/** A rated slowdown is a derate of its fraction; an unrated one is recorded unquantified (`measured`). */
const impactOf = (slowdown: DerivedSlowdown) =>
  slowdown.fraction === null
    ? { impactMode: 'measured' as const, impactFraction: null }
    : {
        impactMode: 'fractional' as const,
        impactFraction: Number(slowdown.fraction),
      };

async function createSlowdown(
  manager: EntityManager,
  revisions: EventRevisionService,
  scope: UnitScope,
  write: SlowdownWrite,
): Promise<EventChangeMessage | null> {
  const impact = impactOf(write.stop);
  const fields = prepareCreate({
    ...sourceFacts(write),
    source: STATE_ENGINE_SOURCE,
    classification: {
      physicalType: 'slowdown',
      scheduleClass: 'unplanned',
      oeeComponent: 'performance',
      impactMode: impact.impactMode,
    },
  });
  const repository = manager.getRepository(ProductionEvent);
  const saved = await repository.save(
    repository.create({
      ...fields,
      impactFraction: impact.impactFraction,
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

/** A changed measured fraction is written unless a person stated the impact (their override wins). */
async function updateFraction(
  manager: EntityManager,
  write: SlowdownWrite,
  owned: EngineOwnedEvent | undefined,
): Promise<EventChangeMessage | null> {
  if (!owned || owned.impactBasis === 'stated') return null;
  const impact = impactOf(write.stop);
  const stored = owned.impactFraction ?? null;
  const wanted =
    impact.impactFraction === null ? null : String(impact.impactFraction);
  if (
    (stored === null ? null : Number(stored)) ===
    (wanted === null ? null : Number(wanted))
  )
    return null;
  const outcome = await applyUserChangeIn(manager, {
    actor: SYSTEM_ACTOR,
    eventId: write.id,
    reason: 'state engine: measured reduced-rate fraction',
    patch: impact,
  });
  return outcome.message;
}

/**
 * Applies a slowdown write plan (plan 1.10 reduced-rate segments) like the stop plan: new slowdown events
 * (`physical_type = slowdown`, OEE performance, the measured fraction as a derate) with revision 1, changed
 * ends / descriptions as source revisions plus the new fraction, gone keys retracted.
 */
export async function applySlowdownWrites(
  manager: EntityManager,
  revisions: EventRevisionService,
  input: {
    scope: UnitScope;
    plan: DerivedWritePlan<DerivedSlowdown>;
    owned: readonly EngineOwnedEvent[];
  },
): Promise<EventChangeMessage[]> {
  const { scope, plan } = input;
  const byId = new Map(input.owned.map((o) => [o.id, o]));
  const messages: Array<EventChangeMessage | null> = [];
  for (const write of plan.create) {
    messages.push(await createSlowdown(manager, revisions, scope, write));
  }
  for (const write of plan.update) {
    const outcome = await applySourceIn(manager, write.id, sourceFacts(write), {
      actorKind: 'system',
      reason: 'state engine reprocessing',
    });
    messages.push(outcome.message);
    messages.push(await updateFraction(manager, write, byId.get(write.id)));
  }
  for (const id of plan.retract) {
    const outcome = await retractIn(manager, id, {
      actor: SYSTEM_ACTOR,
      reason:
        'state engine: the reduced rate is no longer in the state timeline (late or corrected samples)',
    });
    messages.push(outcome.message);
  }
  return messages.filter((m): m is EventChangeMessage => m !== null);
}
