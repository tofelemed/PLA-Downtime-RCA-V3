import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { SchedulerModule } from './common/scheduling/scheduler.module';
import { dataSourceOptions } from './database/data-source';
import { registerPgTypeParsers } from './database/pg-type-parsers';
import { WorkerHealthServer } from './health/worker-health.server';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { RealtimeModule } from './realtime/realtime.module';

registerPgTypeParsers();

/**
 * Root module of the worker process (PROCESS_ROLE=worker, entry src/worker.ts).
 *
 * Same domain code as the API, limited to the modules the schedulers need, and no HTTP layer:
 * the process is a Nest application context, so the controllers these modules declare are never
 * routed. Health probes come from WorkerHealthServer on WORKER_PORT.
 */
@Module({
  imports: [
    CommonModule,
    // The event services inject the global RealtimeGateway; with no socket server in this
    // process its broadcasts are no-ops (browser pushes for worker-created events need the
    // event bus planned for a later phase).
    RealtimeModule,
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      // The API process applies migrations on boot; the worker must never race it.
      migrationsRun: false,
    }),
    SchedulerModule.register('worker'),
    PISyncJobModule,
  ],
  providers: [WorkerHealthServer],
})
export class WorkerModule {}
