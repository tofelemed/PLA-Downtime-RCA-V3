import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { reportTzdataProblems } from './common/startup/report-tzdata';
import { WorkerModule } from './worker.module';

/**
 * Worker process entry (`node dist/src/worker.js`, PROCESS_ROLE=worker): schedulers and jobs
 * only, no HTTP API. Shutdown hooks make SIGTERM/SIGINT run ShutdownCoordinator, which lets
 * in-flight jobs finish (bounded by SHUTDOWN_DRAIN_TIMEOUT_MS) before TypeORM disconnects.
 */
export async function bootstrapWorker(): Promise<void> {
  reportTzdataProblems();
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  new Logger('Worker').log(
    'Worker process started: schedulers active, HTTP API disabled',
  );
}

// main.ts imports bootstrapWorker for PROCESS_ROLE=worker; only run when this file is the entry.
if (require.main === module) {
  void bootstrapWorker();
}
