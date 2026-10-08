import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
import { EventCoding } from '../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../production-event/revisions/event-revision.entity';
import { EventReviewItemsV2Controller } from './event-review-items/event-review-items-v2.controller';
import { ProductionEventHistoryService } from './production-events/production-event-history.service';
import { EventReferencesValidator } from './production-events/event-references.validator';
import { ProductionEventsV2Controller } from './production-events/production-events-v2.controller';
import { ProductionEventsV2Service } from './production-events/production-events-v2.service';
import { ProductionEventsV2CommandService } from './production-events/production-events-v2-commands.service';

/**
 * Home of every `/api/v2` resource (see CONVENTIONS.md). Kept separate from the v1 feature modules so the
 * v2 Swagger document can be generated from this module alone.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionEvent,
      Unit,
      Asset,
      ReasonCode,
      ProductionPlan,
      EventRevision,
      EventCoding,
      EventReviewItem,
    ]),
    ProductionEventModule,
  ],
  controllers: [ProductionEventsV2Controller, EventReviewItemsV2Controller],
  providers: [
    ProductionEventsV2Service,
    ProductionEventHistoryService,
    ProductionEventsV2CommandService,
    EventReferencesValidator,
  ],
})
export class V2Module {}
