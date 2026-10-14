import { Injectable, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from '../../common/outbox/in-process-event-bus';
import { InboxService } from '../../common/outbox/inbox.service';
import { PublishedMessage } from '../../common/outbox/outbox-transport';
import { RcaApprovedTriggerService } from './rca-approved-trigger.service';
import { RcaTriggerService } from './rca-trigger.service';

const CONSUMER = 'rca-trigger';
const APPROVAL_TYPES = ['PeriodApproved', 'PeriodRestated'] as const;

/**
 * Re-evaluates the RCA triggers of an event on every `EventChanged` (create, edit, close; plan 3.9 step
 * 2), and the approved-impact triggers (D17 money limit, share of the daily plan) on every period
 * approval or restatement, once per delivery through the inbox. Re-deliveries and replays hit the
 * evaluation idempotency keys and change nothing. Retractions are not evaluated.
 */
@Injectable()
export class RcaTriggerConsumer implements OnModuleInit {
  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly triggers: RcaTriggerService,
    private readonly approved: RcaApprovedTriggerService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe('EventChanged', (message) => this.onChanged(message));
    for (const type of APPROVAL_TYPES) {
      this.bus.subscribe(type, (message) => this.onApproved(message));
    }
  }

  async onChanged(message: PublishedMessage): Promise<void> {
    await this.inbox.runOnce(this.key(message), (manager) =>
      this.triggers.evaluateIn(manager, {
        tenantId: message.tenantId,
        eventId: message.aggregateId,
        now: new Date(),
      }),
    );
  }

  async onApproved(message: PublishedMessage): Promise<void> {
    const revisionId = message.payload.revisionId;
    if (typeof revisionId !== 'string') return;
    await this.inbox.runOnce(this.key(message), (manager) =>
      this.approved.evaluateIn(manager, {
        tenantId: message.tenantId,
        periodId: message.aggregateId,
        revisionId,
        now: new Date(),
      }),
    );
  }

  private key(message: PublishedMessage) {
    return {
      key: `${CONSUMER}:${message.id}`,
      tenantId: message.tenantId,
      consumer: CONSUMER,
      type: message.type,
    };
  }
}
