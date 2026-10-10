import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { TriggerCandidate } from '../../domain/rca/rca-triggers';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { SYSTEM_ACTOR } from '../../production-event/revisions/revision-actor';
import { RcaCaseLink } from '../../rca/entities/rca-case-link.entity';
import { RCA } from '../../rca/rca.entity';
import { moveEventRcaState } from '../event-rca-pointer';
import { eventEvidencePackage } from '../evidence-package';

const TRIGGER_WORDS: Readonly<Record<string, string>> = {
  duration: 'long unplanned stop',
  repeat: 'repeated functional failure',
  rule: 'RCA trigger rule',
};

/**
 * Opens a Draft case for a trigger under policy `autoCreate: create` (RCA02): the event is linked with
 * its evidence package; the case states why it was opened and never carries a root cause.
 */
export async function openTriggeredCase(
  manager: EntityManager,
  input: { event: ProductionEvent; candidate: TriggerCandidate; now: Date },
): Promise<string> {
  const { event, candidate } = input;
  const tenantId = event.tenantId ?? '';
  const why = TRIGGER_WORDS[candidate.trigger] ?? candidate.trigger;
  const rca = await manager.getRepository(RCA).save(
    manager.getRepository(RCA).create({
      id: randomUUID(),
      title: `RCA: ${why} (${event.eventType ?? event.physicalType})`.slice(
        0,
        255,
      ),
      description:
        `Opened automatically by ${candidate.source.kind} version ${candidate.source.version} ` +
        `(${candidate.idempotencyKey})${candidate.provisional ? ' while the event was still open (provisional)' : ''}. ` +
        'No root cause is proposed.',
      status: 'Draft',
      priority: 'Medium',
      tenantId,
      unitId: event.unitId,
      assetId: event.assetId ?? null,
    }),
  );
  const evidence = await eventEvidencePackage(
    manager,
    tenantId,
    event,
    input.now,
  );
  await manager.getRepository(RcaCaseLink).save(
    manager.getRepository(RcaCaseLink).create({
      tenantId,
      rcaId: rca.id,
      linkType: 'event',
      targetId: event.id,
      targetRevision: event.rowVersion,
      unitId: event.unitId,
      source: 'trigger',
      linkedBy: null,
      linkedAt: input.now,
      reason: candidate.idempotencyKey,
      evidence: { ...evidence },
    }),
  );
  await moveEventRcaState(manager, {
    eventId: event.id,
    tenantId,
    rcaId: rca.id,
    state: 'linked',
    actor: SYSTEM_ACTOR,
  });
  return rca.id;
}
