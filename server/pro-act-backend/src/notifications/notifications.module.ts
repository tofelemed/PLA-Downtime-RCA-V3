import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloseModule } from '../close/close.module';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsService } from './notifications.service';
import { SlaEscalationJob } from './sla-escalation.job';
import { SlaEscalationNotifier } from './sla-escalation-notifier';
import { WorkItemResolutionJob } from './work-item-resolution.job';
import { WorkItemResolver } from './work-item-resolver';
import { WorkReminderJob } from './work-reminder.job';
import { WorkReminderNotifier } from './work-reminder-notifier';

/** Providers that need a database (the OpenAPI snapshot stubs them). */
export const NOTIFICATION_SERVICES = [
  NotificationsService,
  SlaEscalationNotifier,
  SlaEscalationJob,
  WorkReminderNotifier,
  WorkReminderJob,
  WorkItemResolver,
  WorkItemResolutionJob,
];

export const NOTIFICATION_ENTITIES = [UserNotification];

/**
 * In-app notifications (EXPERT_REVIEW Area 3): the per-user list with read marks, and the SLA escalation
 * producer with its periodic worker job (`SlaEscalationJob`; cron runs where the scheduler is on: worker /
 * all roles), and the work / downtime reminders (`WorkReminderJob`, item 6),
 * and the shared work-item resolution (`WorkItemResolver` with its one-minute sweep;
 * the event-driven trigger lives in `NotificationResolutionModule`). Delivery is in-app only — the list plus a realtime hint; no e-mail or SMS infrastructure.
 */
@Module({
  imports: [TypeOrmModule.forFeature(NOTIFICATION_ENTITIES), CloseModule],
  providers: NOTIFICATION_SERVICES,
  exports: [NotificationsService, SlaEscalationNotifier, WorkItemResolver],
})
export class NotificationsModule {}
