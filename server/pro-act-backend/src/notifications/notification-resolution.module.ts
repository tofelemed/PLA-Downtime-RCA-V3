import { Module } from '@nestjs/common';
import { OutboxModule } from '../common/outbox/outbox.module';
import { NotificationsModule } from './notifications.module';
import { WorkItemResolutionConsumer } from './work-item-resolution.consumer';

/**
 * Event-driven resolution of shared work-item notifications (owner 18 Oct): subscribes to the domain messages
 * of the in-process outbox bus. Imported by the root modules of the processes that relay the outbox (API in
 * the `all` role, worker), kept apart from `NotificationsModule` so the HTTP-only module graph (and the
 * OpenAPI snapshot) needs no outbox.
 */
@Module({
  imports: [NotificationsModule, OutboxModule],
  providers: [WorkItemResolutionConsumer],
})
export class NotificationResolutionModule {}
