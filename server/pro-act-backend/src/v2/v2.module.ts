import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
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
    ]),
    ProductionEventModule,
  ],
  controllers: [ProductionEventsV2Controller],
  providers: [
    ProductionEventsV2Service,
    ProductionEventsV2CommandService,
    EventReferencesValidator,
  ],
})
export class V2Module {}
