import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PISyncJob } from './pi-sync-job.entity';
import { PISyncSchedulerService } from './pi-sync-scheduler.service';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PISyncJob, PISyncWatermark, PIConnection]),
    IntegrationModule,
  ],
  providers: [PISyncSchedulerService],
  exports: [PISyncSchedulerService],
})
export class PISyncJobModule {}
