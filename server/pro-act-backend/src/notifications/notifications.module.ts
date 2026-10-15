import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloseModule } from '../close/close.module';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsService } from './notifications.service';
import { SlaEscalationJob } from './sla-escalation.job';
import { SlaEscalationNotifier } from './sla-escalation-notifier';

/** Providers that need a database (the OpenAPI snapshot stubs them). */
export const NOTIFICATION_SERVICES = [
  NotificationsService,
  SlaEscalationNotifier,
  SlaEscalationJob,
];

export const NOTIFICATION_ENTITIES = [UserNotification];

/**
 * In-app notifications (EXPERT_REVIEW Area 3): the per-user list with read marks, and the SLA escalation
 * producer with its periodic worker job (`SlaEscalationJob`; cron runs where the scheduler is on: worker /
 * all roles). Delivery is in-app only — the list plus a realtime hint; no e-mail or SMS infrastructure.
 */
@Module({
  imports: [TypeOrmModule.forFeature(NOTIFICATION_ENTITIES), CloseModule],
  providers: NOTIFICATION_SERVICES,
  exports: [NotificationsService, SlaEscalationNotifier],
})
export class NotificationsModule {}
