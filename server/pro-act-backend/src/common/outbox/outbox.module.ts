import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InProcessEventBus } from './in-process-event-bus';
import { InProcessOutboxTransport } from './in-process-outbox.transport';
import { InboxEntry } from './inbox-entry.entity';
import { InboxService } from './inbox.service';
import { OutboxMessage } from './outbox-message.entity';
import { OutboxRelayJob } from './outbox-relay.job';
import { OutboxRetentionJob } from './outbox-retention.job';
import { OutboxRetentionService } from './outbox-retention.service';
import { OutboxRelayService } from './outbox-relay.service';
import { OUTBOX_TRANSPORT } from './outbox-transport';

/**
 * Transactional outbox + consumer inbox (plan 1.5 step 5). Writers call `enqueueOutbox(manager, ...)`
 * inside their own transaction; the relay cron runs where the scheduler runs (worker/all) and publishes
 * through `OUTBOX_TRANSPORT` — the in-process bus until the Kafka transport of plan 1.9 is bound.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessage, InboxEntry])],
  providers: [
    InProcessEventBus,
    InProcessOutboxTransport,
    { provide: OUTBOX_TRANSPORT, useExisting: InProcessOutboxTransport },
    OutboxRelayService,
    OutboxRelayJob,
    OutboxRetentionService,
    OutboxRetentionJob,
    InboxService,
  ],
  exports: [InProcessEventBus, InboxService, OutboxRelayService],
})
export class OutboxModule {}
