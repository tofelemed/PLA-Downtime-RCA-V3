import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventsV2Controller } from './production-events/production-events-v2.controller';
import { ProductionEventsV2Service } from './production-events/production-events-v2.service';

/**
 * Home of every `/api/v2` resource (see CONVENTIONS.md). Kept separate from the v1 feature modules so the
 * v2 Swagger document can be generated from this module alone.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProductionEvent])],
  controllers: [ProductionEventsV2Controller],
  providers: [ProductionEventsV2Service],
})
export class V2Module {}
