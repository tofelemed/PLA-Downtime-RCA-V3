import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { InboxService } from '../common/outbox/inbox.service';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import { UNIT_IMPACT_RULE_CHANGED } from '../plant-model/unit-impact-rules.service';
import { EventChangeNotifier } from '../production-event/revisions/event-change.notifier';
import { STANDBY_RUNS_CHANGED } from './standby-runs-changed';
import { UnitImpactService } from './unit-impact.service';

const CONSUMER = 'unit-impact';

const text = (payload: Record<string, unknown>, key: string): string => {
  const value = payload[key];
  if (typeof value !== 'string')
    throw new Error(`message payload has no ${key}`);
  return value;
};

const instantOrNull = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === 'string' ? new Date(value) : null;
};

const lockUnit = (manager: EntityManager, tenantId: string, unitId: string) =>
  manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `state-engine:${tenantId}:${unitId}`,
  ]);

/**
 * Plan 1.10 step 4 triggers besides event changes (`StopEventsConsumer`): an approved or retired unit
 * impact rule resolves its asset's stops over the rule's validity; recorded standby runs resolve the stops
 * of the assets whose rule names that standby. Once per message (inbox); serialized per unit with the
 * state engine. Changed events publish `EventChanged`, which recalculates their periods.
 */
@Injectable()
export class UnitImpactConsumer implements OnModuleInit {
  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly impacts: UnitImpactService,
    private readonly notifier: EventChangeNotifier,
  ) {}

  onModuleInit(): void {
    this.subscribe(UNIT_IMPACT_RULE_CHANGED, (manager, message) =>
      this.onRule(manager, message),
    );
    this.subscribe(STANDBY_RUNS_CHANGED, (manager, message) =>
      this.onStandby(manager, message),
    );
  }

  private subscribe(
    type: string,
    handle: (
      manager: EntityManager,
      message: PublishedMessage,
    ) => Promise<void>,
  ): void {
    this.bus.subscribe(type, async (message) => {
      await this.inbox.runOnce(
        {
          key: `${CONSUMER}:${message.id}`,
          tenantId: message.tenantId,
          consumer: CONSUMER,
          type: message.type,
        },
        (manager) => handle(manager, message),
      );
    });
  }

  private async onRule(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const payload = message.payload;
    const unitId = text(payload, 'unitId');
    await lockUnit(manager, message.tenantId, unitId);
    const messages = await this.impacts.resolveAsset(manager, {
      tenantId: message.tenantId,
      unitId,
      assetId: text(payload, 'assetId'),
      from: new Date(text(payload, 'effectiveFrom')),
      to: instantOrNull(payload, 'effectiveTo'),
    });
    await this.notifier.recordIn(manager, messages);
  }

  private async onStandby(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const payload = message.payload;
    const messages = await this.impacts.resolveStandby(manager, {
      tenantId: message.tenantId,
      standbyAssetId: text(payload, 'assetId'),
      from: new Date(text(payload, 'from')),
      to: instantOrNull(payload, 'to'),
    });
    await this.notifier.recordIn(manager, messages);
  }
}
