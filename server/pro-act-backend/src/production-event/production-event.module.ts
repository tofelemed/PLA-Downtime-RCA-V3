import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEventController } from './production-event.controller';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { CalendarModule } from '../calendar/calendar.module';
import { UnitDowntimeService } from './unit-downtime.service';
import { EventCoding } from './revisions/event-coding.entity';
import { EventReviewItem } from './revisions/event-review-item.entity';
import { EventRevision } from './revisions/event-revision.entity';
import { EventChangeNotifier } from './revisions/event-change.notifier';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { DeclaredReviewService } from './revisions/declared-review.service';
import { EventRevisionService } from './revisions/event-revision.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionEvent,
      EventRevision,
      EventCoding,
      EventReviewItem,
    ]),
    CalendarModule,
  ],
  controllers: [ProductionEventController],
  providers: [
    ProductionEventService,
    UnitDowntimeService,
    EventRevisionService,
    EventChangeNotifier,
    DeclaredReviewService,
    AccountingPoliciesService,
  ],
  exports: [
    ProductionEventService,
    UnitDowntimeService,
    EventRevisionService,
    EventChangeNotifier,
  ],
})
export class ProductionEventModule {}
