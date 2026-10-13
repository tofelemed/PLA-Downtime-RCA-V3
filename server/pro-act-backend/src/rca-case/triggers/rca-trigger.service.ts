import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { enqueueOutbox } from '../../common/outbox/outbox-writer';
import {
  decideTrigger,
  evaluateTriggers,
  TriggerCandidate,
  TriggerOutcome,
} from '../../domain/rca/rca-triggers';
import { RcaPolicy } from '../../domain/rca/rca-policy';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { RcaTriggerEvaluation } from '../../rca/entities/rca-trigger-evaluation.entity';
import { openTriggeredCase } from './triggered-case';
import {
  activeHintRules,
  openCaseOnAssetOf,
  recentFailuresOf,
  triggerEventOf,
} from './trigger-inputs';

export const RCA_RECOMMENDED = 'RCARecommended';

export interface TriggerResult {
  idempotencyKey: string;
  trigger: string;
  outcome: TriggerOutcome;
  provisional: boolean;
  /** a provisional evaluation became confirmed by this run */
  confirmed: boolean;
}

/**
 * RCA01 trigger service (plan 3.9 step 2) for tenants with `v2.rca` on: evaluates an event against the
 * D13 `rca_policy` in force and the active `rca_trigger_hint` rules (pure `evaluateTriggers`), then
 * records each firing once under its idempotency key — a recommendation (`RCARecommended` on the
 * outbox) or, when the policy says `create`, a case with the event linked. Open events fire provisionally
 * on elapsed time; their closure confirms the same evaluation; replays are suppressed duplicates. It
 * never codes, closes or attributes loss to an event (T42: advisory events can only be recommended).
 */
@Injectable()
export class RcaTriggerService {
  private readonly logger = new Logger(RcaTriggerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /** Evaluates one event in its own transaction (sweep, tests). */
  evaluate(
    tenantId: string,
    eventId: string,
    now = new Date(),
  ): Promise<TriggerResult[]> {
    return this.dataSource.transaction((manager) =>
      this.evaluateIn(manager, { tenantId, eventId, now }),
    );
  }

  async evaluateIn(
    manager: EntityManager,
    input: { tenantId: string; eventId: string; now: Date },
  ): Promise<TriggerResult[]> {
    if (!(await this.flags.isEnabled(input.tenantId, 'v2.rca'))) return [];
    const stored = await manager
      .getRepository(ProductionEvent)
      .findOneBy({ id: input.eventId, tenantId: input.tenantId });
    if (!stored) return [];
    const event = triggerEventOf(stored);
    const scope = { tenantId: input.tenantId, unitId: event.unitId };
    const resolved = await this.policies.resolveRca(
      manager,
      scope,
      event.start,
    );
    const candidates = evaluateTriggers(event, {
      now: input.now,
      policy: resolved.policy,
      policyRef: { id: resolved.id, version: resolved.version },
      rules: await activeHintRules(manager, input.tenantId),
      recentFailures: await recentFailuresOf(manager, {
        tenantId: input.tenantId,
        event,
        policy: resolved.policy,
      }),
      openCaseOnAsset: await openCaseOnAssetOf(manager, {
        tenantId: input.tenantId,
        assetId: event.assetId,
      }),
    });
    const results: TriggerResult[] = [];
    for (const candidate of candidates) {
      results.push(
        await this.record(manager, {
          stored,
          candidate,
          policy: resolved.policy,
          now: input.now,
        }),
      );
    }
    return results;
  }

  private async record(
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
      return { ...base, outcome: decision.outcome, confirmed: true };
    }
    if (decision.action === 'skip')
      return { ...base, outcome: decision.outcome, confirmed: false };
    const rcaId =
      decision.outcome === 'case_created'
        ? await openTriggeredCase(manager, {
            event: stored,
            candidate,
            now: input.now,
          })
        : null;
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
    if (!rcaId) await this.announce(manager, saved);
    this.logger.log(
      `RCA trigger ${candidate.idempotencyKey}: ${decision.outcome}`,
    );
    return { ...base, outcome: decision.outcome, confirmed: false };
  }

  /** `RCARecommended` (spec §15.4) on the outbox: badges refresh through the realtime feed. */
  private async announce(
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
}
