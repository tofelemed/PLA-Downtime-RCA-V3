import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { InboxService } from '../common/outbox/inbox.service';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import {
  EventChangeNotifier,
  isWorkflowOnly,
} from '../production-event/revisions/event-change.notifier';
import { IncidentGroupingService } from './incident-grouping.service';
import { StopReconciliationService } from './stop-reconciliation.service';
import { UnitImpactService } from './unit-impact.service';

const CONSUMER = 'stop-events';

/**
 * DT-04 / SME D5 triggers: every `EventChanged` / `EventRetracted` of a downtime event (manual entry, PI or
 * MQTT frame, user edit) first resolves its unit impact (plan 1.10 step 4: the unit impact rule of its
 * asset, unless a person stated it), then reconciles duplicates and regroups incidents of its unit around the affected
 * interval, once per message (inbox). Serialized with the state engine by the same per-unit advisory lock.
 * The writes of a merge publish messages too; reprocessing them finds nothing new (idempotent), so the
 * chain ends after one round.
 */
@Injectable()
export class StopEventsConsumer implements OnModuleInit {
  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly reconciliation: StopReconciliationService,
    private readonly incidents: IncidentGroupingService,
    private readonly notifier: EventChangeNotifier,
    private readonly impacts: UnitImpactService,
  ) {}

  onModuleInit(): void {
    for (const type of ['EventChanged', 'EventRetracted']) {
      this.bus.subscribe(type, async (message) => {
        await this.inbox.runOnce(
          {
            key: `${CONSUMER}:${message.id}`,
            tenantId: message.tenantId,
            consumer: CONSUMER,
            type: message.type,
          },
          (manager) => this.onEvent(manager, message),
        );
      });
    }
  }

  private async onEvent(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const payload = message.payload as {
      affectedFrom?: string;
      affectedTo?: string | null;
    };
    // verification labels move no timing or impact: nothing to reconcile or regroup
    if (!payload.affectedFrom || isWorkflowOnly(message.payload)) return;
    const rows = await manager.query<
      Array<{ unit_id: string; physical_type: string }>
    >(
      `SELECT "unit_id", "physical_type" FROM "production_events" WHERE "id" = $1 AND "tenant_id" = $2`,
      [message.aggregateId, message.tenantId],
    );
    if (rows[0]?.physical_type !== 'downtime') return;
    const scope = { tenantId: message.tenantId, unitId: rows[0].unit_id };
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `state-engine:${scope.tenantId}:${scope.unitId}`,
    ]);
    const window = {
      start: new Date(payload.affectedFrom),
      end: payload.affectedTo ? new Date(payload.affectedTo) : null,
    };
    const impacted = await this.impacts.resolveEvent(
      manager,
      message.tenantId,
      message.aggregateId,
    );
    const now = new Date();
    const messages = await this.reconciliation.reconcileUnit(
      manager,
      scope,
      window,
      now,
    );
    await this.incidents.regroupUnit(manager, scope, window, now);
    await this.notifier.recordIn(manager, [...impacted, ...messages]);
  }
}
