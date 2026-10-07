import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { OEESummary } from '../oee-summary/oee-summary.entity';
import { ProductionLoss } from '../production-loss/production-loss.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { RCA } from '../rca/rca.entity';
import { Task } from '../task/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OEESummary,
      ProductionLoss,
      ProductionEvent,
      AuditLog,
      RCA,
      Task,
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
