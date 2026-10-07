import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAController } from './rca.controller';
import { RCAService } from './rca.service';
import { RcaAutoCreateService } from './rca-auto-create.service';
import { RCA } from './rca.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RCATriggerConfigModule } from '../rca-trigger-config/rca-trigger-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RCA, ProductionEvent]),
    RCATriggerConfigModule,
  ],
  controllers: [RCAController],
  providers: [RCAService, RcaAutoCreateService],
  exports: [RCAService, RcaAutoCreateService],
})
export class RCAModule {} 