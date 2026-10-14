import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { evaluateTriggers } from '../../domain/rca/rca-triggers';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  activeHintRules,
  criticalAssetOf,
  cumulativeSecondsOf,
  openCaseOf,
  recentFailuresOf,
  triggerEventOf,
} from './trigger-inputs';
import { recordCandidates, TriggerResult } from './trigger-recorder';

export { RCA_RECOMMENDED } from './trigger-recorder';
export type { TriggerResult } from './trigger-recorder';

/**
 * RCA01 / D17 trigger service (plan 3.9 step 2) for tenants with `v2.rca` on: evaluates an event against
 * the `rca_policy` in force and the active `rca_trigger_hint` rules (pure `evaluateTriggers`), then records
 * each firing once under its idempotency key — a recommendation (`RCARecommended` on the outbox), a case
 * when the policy says `create`, or a link to the open case of the same problem (CA8). Open events fire
 * provisionally on elapsed time; their closure confirms the same evaluation; replays are suppressed
 * duplicates. It never codes, closes or attributes loss to an event (T42: advisory events only recommend).
 * Cost and lost-quantity triggers fire on approval (`RcaApprovedTriggerService`).
 */
@Injectable()
export class RcaTriggerService {
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
    const resolved = await this.policies.resolveRca(
      manager,
      { tenantId: input.tenantId, unitId: event.unitId },
      event.start,
    );
    const { policy } = resolved;
    const modeInput = { tenantId: input.tenantId, stored, event, policy };
    const candidates = evaluateTriggers(event, {
      now: input.now,
      policy,
      policyRef: { id: resolved.id, version: resolved.version },
      rules: await activeHintRules(manager, input.tenantId),
      recentFailures: await recentFailuresOf(manager, modeInput),
      cumulativeSeconds: await cumulativeSecondsOf(manager, {
        ...modeInput,
        now: input.now,
      }),
      criticalAsset: await criticalAssetOf(manager, {
        tenantId: input.tenantId,
        assetId: event.assetId,
        policy,
      }),
      openCaseId: await openCaseOf(manager, {
        tenantId: input.tenantId,
        stored,
        policy,
      }),
    });
    return recordCandidates(manager, {
      stored,
      candidates,
      policy,
      now: input.now,
    });
  }
}
