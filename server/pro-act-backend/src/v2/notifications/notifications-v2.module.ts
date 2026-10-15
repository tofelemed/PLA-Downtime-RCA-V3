import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { NotificationsV2Controller } from './notifications-v2.controller';

/** In-app notifications on `/api/v2/notifications` (EXPERT_REVIEW Area 3); part of the v2 OpenAPI document. */
@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsV2Controller],
})
export class NotificationsV2Module {}
