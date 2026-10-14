import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { TriggerCandidate } from '../../domain/rca/rca-triggers';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { SYSTEM_ACTOR } from '../../production-event/revisions/revision-actor';
import { RcaCaseLink } from '../../rca/entities/rca-case-link.entity';
import { RCA } from '../../rca/rca.entity';
import { moveEventRcaState } from '../event-rca-pointer';
import { eventEvidencePackage } from '../evidence-package';

export const TRIGGER_WORDS: Readonly<Record<string, string>> = {
  duration: 'long unplanned stop',
  repeat: 'repeated same-mode failure',
  cumulative: 'cumulative same-mode downtime (bad actor)',
  consequence: 'safety / critical consequence',
  cost: 'approved economic impact over the money limit',
  quantity: 'approved lost quantity over the daily-plan share',
  rule: 'RCA trigger rule',
};

/**
 * Links an event to a case by a trigger (RCA02 evidence package, CA8 same-problem repeats); a link that
 * already exists is kept as it is. Returns whether a link was written.
 */
export async function linkEventToCase(
  manager: EntityManager,
  input: {
    event: ProductionEvent;
    rcaId: string;
    candidate: TriggerCandidate;
    now: Date;
  },
): Promise<boolean> {
  const { event } = input;
  const tenantId = event.tenantId ?? '';
  const repository = manager.getRepository(RcaCaseLink);
  const existing = await repository.findOneBy({
    rcaId: input.rcaId,
    linkType: 'event',
    targetId: event.id,
  });
  if (existing) return false;
  const evidence = await eventEvidencePackage(
    manager,
    tenantId,
    event,
    input.now,
  );
  await repository.save(
    repository.create({
      tenantId,
      rcaId: input.rcaId,
      linkType: 'event',
      targetId: event.id,
      targetRevision: event.rowVersion,
      unitId: event.unitId,
      source: 'trigger',
      linkedBy: null,
      linkedAt: input.now,
      reason: input.candidate.idempotencyKey,
      evidence: { ...evidence },
    }),
  );
  await moveEventRcaState(manager, {
    eventId: event.id,
    tenantId,
    rcaId: input.rcaId,
    state: 'linked',
    actor: SYSTEM_ACTOR,
  });
  return true;
}

/**
 * Opens a Draft case for a trigger under policy `autoCreate: create` (RCA02): the event is linked with
 * its evidence package; the case states why it was opened and never carries a root cause.
 */
export async function openTriggeredCase(
  manager: EntityManager,
  input: { event: ProductionEvent; candidate: TriggerCandidate; now: Date },
): Promise<string> {
  const { event, candidate } = input;
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
      priority: candidate.trigger === 'consequence' ? 'Critical' : 'Medium',
      tenantId: event.tenantId ?? '',
      unitId: event.unitId,
      assetId: event.assetId ?? null,
      createdBy: null,
    }),
  );
  await linkEventToCase(manager, {
    event,
    rcaId: rca.id,
    candidate,
    now: input.now,
  });
  return rca.id;
}
