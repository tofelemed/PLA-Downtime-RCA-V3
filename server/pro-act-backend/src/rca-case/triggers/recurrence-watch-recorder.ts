import { EntityManager } from 'typeorm';
import { LatestIncident } from '../effectiveness-exposure';
import {
  REEVALUATE_TRIGGER,
  RecurrenceWatchResult,
} from '../../domain/rca/recurrence-watch';
import { RcaTriggerEvaluation } from '../../rca/entities/rca-trigger-evaluation.entity';
import { announce } from './trigger-recorder';

/** One recommendation per case, watch version and watch window (the window starts at the closure). */
export const reevaluateKey = (
  version: string,
  rcaId: string,
  closedAt: Date,
): string => `watch:${version}:${rcaId}:${closedAt.toISOString()}`;

export interface ReevaluationInput {
  tenantId: string;
  rcaId: string;
  closedAt: Date;
  policy: { id: string; version: number };
  incident: LatestIncident;
  result: RecurrenceWatchResult;
  now: Date;
}

/**
 * D-T3: records the `reevaluate` recommendation of a closed case (open, linked to the case, naming the
 * latest recurrence) and announces it on the outbox like every recommendation. Idempotent: the unique
 * idempotency key (checked under a row lock, unique per tenant) makes a second firing of the same case and
 * window a no-op (returns false). It never
 * changes the case; a person reopens it or dismisses the recommendation.
 */
export async function recordReevaluation(
  manager: EntityManager,
  input: ReevaluationInput,
): Promise<boolean> {
  const { result, incident } = input;
  const repository = manager.getRepository(RcaTriggerEvaluation);
  const idempotencyKey = reevaluateKey(
    result.version,
    input.rcaId,
    input.closedAt,
  );
  const existing = await repository
    .createQueryBuilder('t')
    .setLock('pessimistic_write')
    .where('t.tenantId = :tenantId AND t.idempotencyKey = :key', {
      tenantId: input.tenantId,
      key: idempotencyKey,
    })
    .getOne();
  if (existing) return false;
  const saved = await repository.save(
    repository.create({
      tenantId: input.tenantId,
      idempotencyKey,
      sourceKind: 'policy',
      sourceId: input.policy.id,
      sourceVersion: input.policy.version,
      trigger: REEVALUATE_TRIGGER,
      eventId: incident.eventId,
      occurrenceId: incident.occurrenceId,
      unitId: incident.unitId,
      firedOn: 'after_closure',
      provisional: false,
      outcome: 'recommended',
      state: 'open',
      rcaId: input.rcaId,
      detail: { ...result, closedAt: input.closedAt.toISOString() },
      firedAt: input.now,
      confirmedAt: input.now,
    }),
  );
  await announce(manager, saved);
  return true;
}

/** Reopening the case is the person's answer to its open `reevaluate` recommendations: they are accepted. */
export async function acceptReevaluations(
  manager: EntityManager,
  input: { tenantId: string; rcaId: string; userId: string | null; now: Date },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .update(RcaTriggerEvaluation)
    .set({
      state: 'accepted',
      resolvedBy: input.userId,
      resolvedAt: input.now,
    })
    .where(
      '"tenant_id" = :tenantId AND "rca_id" = :rcaId AND "trigger" = :trigger AND "state" = :state',
      {
        tenantId: input.tenantId,
        rcaId: input.rcaId,
        trigger: REEVALUATE_TRIGGER,
        state: 'open',
      },
    )
    .execute();
}
