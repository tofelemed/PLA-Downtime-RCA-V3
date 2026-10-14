import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { evaluateApprovedTriggers } from '../../domain/rca/approved-triggers';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  approvedCauseEvents,
  approvedEventFigures,
  dailyPlanOf,
} from './approved-trigger-inputs';
import { criticalAssetOf, openCaseOf } from './trigger-inputs';
import { recordCandidates, TriggerResult } from './trigger-recorder';

/**
 * D17 triggers on approved impact: when a period revision is approved or restated, every cause event of
 * its approved lines is checked against the money limit (approved contribution-margin value in the
 * policy currency; off while finance has not set it) and the share of the unit's daily planned quantity
 * (halved for critical assets). Each fires once per occurrence and policy version (a restatement does not
 * fire again); a same-problem firing links to the open case (CA8). Draft figures are never read.
 */
@Injectable()
export class RcaApprovedTriggerService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly flags: FeatureFlagsService,
  ) {}

  evaluate(
    input: { tenantId: string; periodId: string; revisionId: string },
    now = new Date(),
  ): Promise<TriggerResult[]> {
    return this.dataSource.transaction((manager) =>
      this.evaluateIn(manager, { ...input, now }),
    );
  }

  async evaluateIn(
    manager: EntityManager,
    input: {
      tenantId: string;
      periodId: string;
      revisionId: string;
      now: Date;
    },
  ): Promise<TriggerResult[]> {
    if (!(await this.flags.isEnabled(input.tenantId, 'v2.rca'))) return [];
    const eventIds = await approvedCauseEvents(manager, input);
    if (eventIds.length === 0) return [];
    const dailyPlan = await dailyPlanOf(manager, input);
    const results: TriggerResult[] = [];
    for (const eventId of eventIds) {
      results.push(
        ...(await this.evaluateEvent(manager, {
          ...input,
          eventId,
          dailyPlan,
        })),
      );
    }
    return results;
  }

  private async evaluateEvent(
    manager: EntityManager,
    input: {
      tenantId: string;
      eventId: string;
      now: Date;
      dailyPlan: Array<{ uom: string | null; quantity: string }>;
    },
  ): Promise<TriggerResult[]> {
    const stored = await manager
      .getRepository(ProductionEvent)
      .findOneBy({ id: input.eventId, tenantId: input.tenantId });
    if (!stored || !['open', 'closed'].includes(stored.physicalState))
      return [];
    const resolved = await this.policies.resolveRca(
      manager,
      { tenantId: input.tenantId, unitId: stored.unitId },
      stored.startTime,
    );
    const { policy } = resolved;
    const figures = await approvedEventFigures(manager, input);
    const candidates = evaluateApprovedTriggers(
      {
        eventId: stored.id,
        occurrenceId: stored.occurrenceId ?? null,
        ...figures,
        dailyPlan: input.dailyPlan,
        criticalAsset: await criticalAssetOf(manager, {
          tenantId: input.tenantId,
          assetId: stored.assetId ?? null,
          policy,
        }),
        advisory: stored.physicalType === 'advisory',
        openCaseId: await openCaseOf(manager, {
          tenantId: input.tenantId,
          stored,
          policy,
        }),
      },
      { policy, policyRef: { id: resolved.id, version: resolved.version } },
    );
    return recordCandidates(manager, {
      stored,
      candidates,
      policy,
      now: input.now,
    });
  }
}
