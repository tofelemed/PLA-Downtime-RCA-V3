import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEventController } from './production-event.controller';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { RCAModule } from '../rca/rca.module';
import { UnitDowntimeService } from './unit-downtime.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionEvent]), RCAModule],
  controllers: [ProductionEventController],
  providers: [ProductionEventService, UnitDowntimeService],
  exports: [ProductionEventService, UnitDowntimeService],
})
export class ProductionEventModule {}
