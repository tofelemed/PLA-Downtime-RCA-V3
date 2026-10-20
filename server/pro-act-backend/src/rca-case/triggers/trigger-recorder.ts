import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../../common/outbox/outbox-writer';
import {
  decideTrigger,
  TriggerCandidate,
  TriggerOutcome,
} from '../../domain/rca/rca-triggers';
import { RcaPolicy } from '../../domain/rca/rca-policy';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { RcaTriggerEvaluation } from '../../rca/entities/rca-trigger-evaluation.entity';
import { linkEventToCase, openTriggeredCase } from './triggered-case';

export const RCA_RECOMMENDED = 'RCARecommended';

export interface TriggerResult {
  idempotencyKey: string;
  trigger: string;
  outcome: TriggerOutcome;
  provisional: boolean;
  /** a provisional evaluation became confirmed by this run */
  confirmed: boolean;
  /** the case the firing created or linked the event to */
  rcaId?: string | null;
}

const logger = new Logger('RcaTriggerRecorder');

/** Production triggers that are about "the same problem" and so follow a case opened in the same round. */
const SAME_PROBLEM = new Set([
  'duration',
  'repeat',
  'cumulative',
  'cost',
  'quantity',
]);

/**
 * Records the candidates of one evaluation round under their idempotency keys. A case opened by the
 * first firing of the round takes the round's later same-problem firings (one problem, one case).
 */
export async function recordCandidates(
  manager: EntityManager,
  input: {
    stored: ProductionEvent;
    candidates: TriggerCandidate[];
    policy: RcaPolicy;
    now: Date;
  },
): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  let opened: string | null = null;
  for (const raw of input.candidates) {
    const candidate =
      opened &&
      !raw.linkToCaseId &&
      SAME_PROBLEM.has(raw.trigger) &&
      !raw.recommendOnly
        ? { ...raw, linkToCaseId: opened }
        : raw;
    const result = await recordCandidate(manager, { ...input, candidate });
    if (result.outcome === 'case_created' && result.rcaId)
      opened = result.rcaId;
    results.push(result);
  }
  return results;
}

async function caseFor(
  manager: EntityManager,
  input: { stored: ProductionEvent; candidate: TriggerCandidate; now: Date },
  outcome: TriggerOutcome,
): Promise<string | null> {
  const { candidate } = input;
  if (outcome === 'linked_to_case' && candidate.linkToCaseId) {
    await linkEventToCase(manager, {
      event: input.stored,
      rcaId: candidate.linkToCaseId,
      candidate,
      now: input.now,
    });
    return candidate.linkToCaseId;
  }
  if (outcome === 'case_created')
    return openTriggeredCase(manager, {
      event: input.stored,
      candidate,
      now: input.now,
    });
  return null;
}

/** One candidate: insert (recommend / create / link), confirm a provisional firing, or skip a duplicate. */
export async function recordCandidate(
  manager: EntityManager,
  input: {
    stored: ProductionEvent;
    candidate: TriggerCandidate;
    policy: RcaPolicy;
    now: Date;
  },
): Promise<TriggerResult> {
  const { stored, candidate } = input;
  const repository = manager.getRepository(RcaTriggerEvaluation);
  const existing = await repository
    .createQueryBuilder('t')
    .setLock('pessimistic_write')
    .where('t.tenantId = :tenantId AND t.idempotencyKey = :key', {
      tenantId: stored.tenantId,
      key: candidate.idempotencyKey,
    })
    .getOne();
  const decision = decideTrigger(candidate, input.policy, existing);
  const base = {
    idempotencyKey: candidate.idempotencyKey,
    trigger: candidate.trigger,
    provisional: candidate.provisional,
  };
  if (decision.action === 'confirm' && existing) {
    await repository.update(existing.id, {
      provisional: false,
      confirmedAt: input.now,
      rowVersion: existing.rowVersion + 1,
    });
    return {
      ...base,
      outcome: decision.outcome,
      confirmed: true,
      rcaId: existing.rcaId,
    };
  }
  if (decision.action === 'skip') {
    return {
      ...base,
      outcome: decision.outcome,
      confirmed: false,
      rcaId: existing?.rcaId ?? null,
    };
  }
  const rcaId = await caseFor(manager, input, decision.outcome);
  const saved = await repository.save(
    repository.create({
      tenantId: stored.tenantId,
      idempotencyKey: candidate.idempotencyKey,
      sourceKind: candidate.source.kind,
      sourceId: candidate.source.id,
      sourceVersion: candidate.source.version,
      trigger: candidate.trigger,
      eventId: stored.id,
      occurrenceId: stored.occurrenceId ?? null,
      unitId: stored.unitId,
      firedOn: candidate.firedOn,
      provisional: candidate.provisional,
      outcome: decision.outcome,
      state: rcaId ? 'accepted' : 'open',
      rcaId,
      detail: { ...candidate.detail, recommendOnly: candidate.recommendOnly },
      firedAt: input.now,
      confirmedAt: candidate.provisional ? null : input.now,
    }),
  );
  if (!rcaId) await announce(manager, saved);
  logger.log(`RCA trigger ${candidate.idempotencyKey}: ${decision.outcome}`);
  return { ...base, outcome: decision.outcome, confirmed: false, rcaId };
}

/** `RCARecommended` (spec §15.4) on the outbox: badges refresh through the realtime feed. */
export async function announce(
  manager: EntityManager,
  evaluation: RcaTriggerEvaluation,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: evaluation.tenantId,
      aggregateType: 'rca_recommendation',
      aggregateId: evaluation.id,
      type: RCA_RECOMMENDED,
      version: 1,
      payload: {
        tenantId: evaluation.tenantId,
        evaluationId: evaluation.id,
        eventId: evaluation.eventId,
        unitId: evaluation.unitId,
        trigger: evaluation.trigger,
        provisional: evaluation.provisional,
        source: {
          kind: evaluation.sourceKind,
          id: evaluation.sourceId,
          version: evaluation.sourceVersion,
        },
        firedAt: evaluation.firedAt.toISOString(),
      },
    },
  ]);
}
