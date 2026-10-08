import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { Unit } from '../unit/unit.entity';
import { ProductionEventsV2Controller } from './production-events/production-events-v2.controller';
import { ProductionEventsV2Service } from './production-events/production-events-v2.service';
import { ProductionEventsV2CommandService } from './production-events/production-events-v2-commands.service';

/**
 * Home of every `/api/v2` resource (see CONVENTIONS.md). Kept separate from the v1 feature modules so the
 * v2 Swagger document can be generated from this module alone.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProductionEvent, Unit]),
    ProductionEventModule,
  ],
  controllers: [ProductionEventsV2Controller],
  providers: [ProductionEventsV2Service, ProductionEventsV2CommandService],
})
export class V2Module {}
