import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEventController } from './production-event.controller';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { RCAModule } from '../rca/rca.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionEvent]), RCAModule],
  controllers: [ProductionEventController],
  providers: [ProductionEventService],
  exports: [ProductionEventService],
})
export class ProductionEventModule {} 