import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { InboxService } from '../common/outbox/inbox.service';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import { PLAN_VERSION_APPROVED } from '../plans/plan-events';
import { ActualsJobsService } from './actuals-jobs.service';
import { ProductionPeriod } from './entities/production-period.entity';
import {
  PERIOD_RECALCULATE_REQUESTED,
  RecalculationPayload,
  requestRecalculation,
} from './period-recalc';
import { SliceResolverService } from './slice-resolver.service';

const CONSUMER = 'period-actuals';

/**
 * Recalculation triggers of plan 2.4 step 5, consumed once each through the inbox (`runOnce`):
 * - `EventChanged` / `EventRetracted` of a production output event → `PeriodRecalculateRequested` for its
 *   unit and affected interval (other event types are loss explanations: actuals are not touched, T44);
 * - `PlanVersionApproved` in the accounting-baseline scenario → slices of the unit's not-reconciled
 *   periods in the version window are re-resolved and changed periods recalculated (restatement of
 *   reconciled periods is 2.8: `period_change_proposals`);
 * - `PeriodRecalculateRequested` → one queued recompute job per overlapping period.
 */
@Injectable()
export class PeriodRecalcConsumer implements OnModuleInit {
  private readonly logger = new Logger(PeriodRecalcConsumer.name);

  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly jobs: ActualsJobsService,
    private readonly slices: SliceResolverService,
  ) {}

  onModuleInit(): void {
    for (const type of ['EventChanged', 'EventRetracted']) {
      this.bus.subscribe(type, (message) =>
        this.once(message, (m) => this.onEvent(m, message)),
      );
    }
    this.bus.subscribe(PLAN_VERSION_APPROVED, (message) =>
      this.once(message, (m) => this.onPlanApproved(m, message)),
    );
    this.bus.subscribe(PERIOD_RECALCULATE_REQUESTED, (message) =>
      this.once(message, (m) => this.onRecalculate(m, message)),
    );
  }

  private async once(
    message: PublishedMessage,
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.inbox.runOnce(
      {
        key: `${CONSUMER}:${message.id}`,
        tenantId: message.tenantId,
        consumer: CONSUMER,
        type: message.type,
      },
      work,
    );
  }

  private async onEvent(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const rows: Array<{ unit_id: string; physical_type: string }> =
      await manager.query(
        `SELECT "unit_id", "physical_type" FROM "production_events" WHERE "id" = $1`,
        [message.aggregateId],
      );
    const event = rows[0];
    if (!event || event.physical_type !== 'production_output') return;
    const payload = message.payload as {
      affectedFrom?: string;
      affectedTo?: string | null;
    };
    if (!payload.affectedFrom) return;
    await requestRecalculation(manager, {
      tenantId: message.tenantId,
      unitIds: [event.unit_id],
      from: new Date(payload.affectedFrom),
      to: payload.affectedTo ? new Date(payload.affectedTo) : null,
      reason:
        message.type === 'EventRetracted'
          ? 'output_event_retracted'
          : 'output_event_changed',
      scopeUnitIds: null,
      requestedBy: null,
    });
  }

  private async onPlanApproved(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const baseline = baselineOf(message);
    if (!baseline) return;
    const open = await periodsIn(manager, baseline, false);
    const changed = await this.slices.resolve(manager, open);
    if (changed.length > 0) {
      await this.jobs.enqueueIds(
        manager,
        message.tenantId,
        changed,
        'plan_baseline_changed',
      );
    }
    const reconciled = await periodsIn(manager, baseline, true);
    if (baseline.restatementRequired && reconciled.length > 0) {
      this.logger.warn(
        `Plan version ${message.aggregateId} superseded a baseline used by ${reconciled.length} reconciled period(s); restatement proposals come with 2.8`,
      );
    }
  }

  private async onRecalculate(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const payload = message.payload as unknown as RecalculationPayload;
    await this.jobs.enqueue(manager, {
      tenantId: message.tenantId,
      unitIds: payload.unitIds,
      from: new Date(payload.from),
      to: payload.to ? new Date(payload.to) : null,
      trigger: payload.reason,
      scopeUnitIds: payload.scopeUnitIds,
      requestedBy: payload.requestedBy,
    });
  }
}

interface BaselineChange {
  tenantId: string;
  unitId: string;
  from: Date;
  to: Date;
  restatementRequired: boolean;
}

/** The unit and window of a `PlanVersionApproved` in the accounting-baseline scenario, else null. */
function baselineOf(message: PublishedMessage): BaselineChange | null {
  const payload = message.payload as {
    isAccountingBaseline?: boolean;
    unitId?: string;
    validFrom?: string;
    validTo?: string;
    restatementRequired?: boolean;
  };
  const { unitId, validFrom, validTo } = payload;
  if (!payload.isAccountingBaseline || !unitId || !validFrom || !validTo) {
    return null;
  }
  return {
    tenantId: message.tenantId,
    unitId,
    from: new Date(validFrom),
    to: new Date(validTo),
    restatementRequired: payload.restatementRequired === true,
  };
}

function periodsIn(
  manager: EntityManager,
  change: BaselineChange,
  reconciled: boolean,
): Promise<ProductionPeriod[]> {
  return manager
    .getRepository(ProductionPeriod)
    .createQueryBuilder('p')
    .where('p.tenantId = :tenantId AND p.unitId = :unitId', {
      tenantId: change.tenantId,
      unitId: change.unitId,
    })
    .andWhere('p.utcStart < :to AND p.utcEnd > :from', {
      from: change.from,
      to: change.to,
    })
    .andWhere(
      reconciled
        ? `p.stateReadiness = 'reconciled'`
        : `p.stateReadiness <> 'reconciled'`,
    )
    .getMany();
}
