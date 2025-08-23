import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEventController } from './production-event.controller';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionEvent])],
  controllers: [ProductionEventController],
  providers: [ProductionEventService],
  exports: [ProductionEventService],
})
export class ProductionEventModule {} 