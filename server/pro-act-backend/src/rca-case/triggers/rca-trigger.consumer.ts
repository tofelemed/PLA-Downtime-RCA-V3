import { Injectable, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from '../../common/outbox/in-process-event-bus';
import { InboxService } from '../../common/outbox/inbox.service';
import { PublishedMessage } from '../../common/outbox/outbox-transport';
import { RcaTriggerService } from './rca-trigger.service';

const CONSUMER = 'rca-trigger';

/**
 * Re-evaluates the RCA triggers of an event on every `EventChanged` (create, edit, close; plan 3.9 step
 * 2), once per delivery through the inbox. Re-deliveries and replays hit the evaluation idempotency
 * keys and change nothing. Retractions are not evaluated (a retracted event never fires).
 */
@Injectable()
export class RcaTriggerConsumer implements OnModuleInit {
  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly triggers: RcaTriggerService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe('EventChanged', (message) => this.onChanged(message));
  }

  async onChanged(message: PublishedMessage): Promise<void> {
    await this.inbox.runOnce(
      {
        key: `${CONSUMER}:${message.id}`,
        tenantId: message.tenantId,
        consumer: CONSUMER,
        type: message.type,
      },
      (manager) =>
        this.triggers.evaluateIn(manager, {
          tenantId: message.tenantId,
          eventId: message.aggregateId,
          now: new Date(),
        }),
    );
  }
}
