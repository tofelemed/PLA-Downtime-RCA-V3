import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeLibraryModule } from '../code-library/code-library.module';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { BulkCodeService } from './bulk-code.service';
import { BulkJob } from './bulk-job.entity';
import { BulkJobProcessor } from './bulk-job.processor';
import { BulkJobService } from './bulk-job.service';
import { EventCommandService } from './event-command.service';
import { EventRelation } from './event-relation.entity';

/**
 * Event operations of plan 1.4 (split, merge, close, bulk coding) and the bulk job worker. Imported by
 * the v2 API and by the worker process (the processor's cron is live only where the scheduler runs).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProductionEvent, EventRelation, BulkJob]),
    ProductionEventModule,
    CodeLibraryModule,
  ],
  providers: [
    EventCommandService,
    BulkCodeService,
    BulkJobService,
    BulkJobProcessor,
  ],
  exports: [EventCommandService, BulkCodeService, BulkJobService],
})
export class EventOperationsModule {}
