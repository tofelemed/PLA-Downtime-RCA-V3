import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEventController } from './production-event.controller';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { RCAModule } from '../rca/rca.module';
import { UnitDowntimeService } from './unit-downtime.service';
import { EventCoding } from './revisions/event-coding.entity';
import { EventReviewItem } from './revisions/event-review-item.entity';
import { EventRevision } from './revisions/event-revision.entity';
import { EventChangeNotifier } from './revisions/event-change.notifier';
import { EventRevisionService } from './revisions/event-revision.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionEvent,
      EventRevision,
      EventCoding,
      EventReviewItem,
    ]),
    RCAModule,
  ],
  controllers: [ProductionEventController],
  providers: [
    ProductionEventService,
    UnitDowntimeService,
    EventRevisionService,
    EventChangeNotifier,
  ],
  exports: [ProductionEventService, UnitDowntimeService, EventRevisionService],
})
export class ProductionEventModule {}
