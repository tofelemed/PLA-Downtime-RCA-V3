import { Module } from '@nestjs/common';
import { DataRetentionJob } from './data-retention.job';
import { DataRetentionService } from './data-retention.service';

/** Data retention of the audit tables and raw partitions (DB-07); the cron runs where the scheduler runs. */
@Module({
  providers: [DataRetentionService, DataRetentionJob],
  exports: [DataRetentionService],
})
export class RetentionModule {}
