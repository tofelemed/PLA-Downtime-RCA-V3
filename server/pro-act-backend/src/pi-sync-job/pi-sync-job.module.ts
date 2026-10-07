import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PISyncJob } from './pi-sync-job.entity';
import { PISyncJobController } from './pi-sync-job.controller';
import { PISyncJobService } from './pi-sync-job.service';
import { PISyncSchedulerService } from './pi-sync-scheduler.service';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PISyncJob, PISyncWatermark, PIConnection]),
    IntegrationModule,
  ],
  controllers: [PISyncJobController],
  providers: [PISyncJobService, PISyncSchedulerService],
  exports: [PISyncJobService, PISyncSchedulerService],
})
export class PISyncJobModule {}
