import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../common/outbox/outbox.module';
import { ProductionEventModule } from '../production-event/production-event.module';
import { AdapterRegistry } from './adapters/adapter-registry';
import { IntegrationConnectionService } from './connections/integration-connection.service';
import { IngestionException } from './entities/ingestion-exception.entity';
import { IngestionJobTransition } from './entities/ingestion-job-transition.entity';
import { IngestionJob } from './entities/ingestion-job.entity';
import { IntegrationConnection } from './entities/integration-connection.entity';
import { RawIdentity } from './entities/raw-identity.entity';
import { RawObservation } from './entities/raw-observation.entity';
import { ReplayRun } from './entities/replay-run.entity';
import { Secret } from './entities/secret.entity';
import { SourceObject } from './entities/source-object.entity';
import { IngestionExceptionsService } from './exceptions/ingestion-exceptions.service';
import { IntakeService } from './intake.service';
import { IngestionJobsService } from './jobs/ingestion-jobs.service';
import { JobRunnerJob } from './jobs/job-runner.job';
import { JobRunnerService } from './jobs/job-runner.service';
import { NormalizationHandlerRegistry } from './normalization/normalization-handler';
import { NormalizationService } from './normalization/normalization.service';
import { RetractionHandler } from './normalization/retraction.handler';
import { RawPartitionsService } from './partitions/raw-partitions.service';
import { ReplayExecutor } from './replay/replay-executor';
import { ReplayRunnerJob } from './replay/replay-runner.job';
import { ReplayService } from './replay/replay.service';

/**
 * Durable intake core of plan 1.5 (spec FND01–FND04, ING02, ING05, ING07): the source-neutral pipeline
 * every connector plugs into. Connector modules register their adapter (`AdapterRegistry`) and their
 * normaliser (`NormalizationHandlerRegistry`) on init. The job runner, replay runner, outbox relay and
 * partition maintenance crons are live only where the scheduler runs (worker/all).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnection,
      Secret,
      IngestionJob,
      IngestionJobTransition,
      RawObservation,
      RawIdentity,
      SourceObject,
      IngestionException,
      ReplayRun,
    ]),
    OutboxModule,
    ProductionEventModule,
  ],
  providers: [
    AdapterRegistry,
    NormalizationHandlerRegistry,
    RawPartitionsService,
    IntakeService,
    NormalizationService,
    RetractionHandler,
    IntegrationConnectionService,
    IngestionJobsService,
    JobRunnerService,
    JobRunnerJob,
    ReplayExecutor,
    ReplayService,
    ReplayRunnerJob,
    IngestionExceptionsService,
  ],
  exports: [
    AdapterRegistry,
    NormalizationHandlerRegistry,
    IntakeService,
    NormalizationService,
    IntegrationConnectionService,
    IngestionJobsService,
    JobRunnerService,
    ReplayService,
    IngestionExceptionsService,
  ],
})
export class IntakeModule {}
