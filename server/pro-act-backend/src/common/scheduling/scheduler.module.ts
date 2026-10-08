import { DynamicModule, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { getProcessRole, ProcessRole, runsSchedulers } from './process-role';

/**
 * Role-aware wrapper around @nestjs/schedule.
 *
 * `@Cron`, `@Interval` and `@Timeout` only attach metadata to a method; it is ScheduleModule's
 * explorer (run on module init) that turns the metadata into live jobs. Leaving ScheduleModule
 * out of the API process therefore makes every scheduled provider inert without touching the
 * providers themselves (asserted by scheduler.module.spec.ts). SchedulerRegistry is only
 * injectable in processes that run schedulers.
 */
@Module({})
export class SchedulerModule {
  static register(role: ProcessRole = getProcessRole()): DynamicModule {
    return {
      module: SchedulerModule,
      imports: runsSchedulers(role) ? [ScheduleModule.forRoot()] : [],
    };
  }
}
