import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarModule } from './calendar/calendar.module';
import { CommonModule } from './common/common.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RetentionModule } from './common/retention/retention.module';
import { SchedulerModule } from './common/scheduling/scheduler.module';
import { runtimeDataSourceOptions } from './database/data-source';
import { EventOperationsModule } from './event-operations/event-operations.module';
import { IntakeModule } from './intake/intake.module';
import { MqttAdapterModule } from './intake/adapters/mqtt/mqtt-adapter.module';
import { IntegrationModule } from './integration/integration.module';
import { registerPgTypeParsers } from './database/pg-type-parsers';
import { WorkerHealthServer } from './health/worker-health.server';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { ProfilesModule } from './profiles/profiles.module';
import { PlansModule } from './plans/plans.module';
import { PeriodsModule } from './periods/periods.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { ExportsModule } from './exports/exports.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RcaCaseModule } from './rca-case/rca-case.module';
import { AuthTokensModule } from './auth/tokens/auth-tokens.module';
import { NotificationResolutionModule } from './notifications/notification-resolution.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StopEventsModule } from './stop-events/stop-events.module';

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
    // The API process applies migrations on boot; the worker must never race it (migrationsRun: false)
    TypeOrmModule.forRoot(runtimeDataSourceOptions()),
    SchedulerModule.register('worker'),
    PISyncJobModule,
    IdempotencyModule,
    // audit-table and raw-partition retention (DB-07), disabled until windows are configured
    RetentionModule,
    // bulk coding jobs above the atomic limit (plan 1.4, API04)
    EventOperationsModule,
    // durable intake (plan 1.5): job runner, replay runner, outbox relay, partition maintenance; the
    // PI adapter and normaliser come with IntegrationModule
    IntakeModule,
    IntegrationModule,
    // MQTT adapter (plan 1.8); the subscriber host joins with WP3 step 3
    MqttAdapterModule,
    // shift instances kept generated 90 days ahead (plan 2.1)
    CalendarModule,
    // budget / forecast / MPC rate imports (plan 2.2)
    ProfilesModule,
    // plan period generation jobs (plan 2.3)
    PlansModule,
    // period materialization, actuals jobs and recalculation triggers (plan 2.4)
    PeriodsModule,
    AccountingModule,
    ReconciliationModule,
    // export render jobs and expired-file purge (plan 2.9)
    ExportsModule,
    // RCA trigger consumer, open-event sweep and action verification (plan 3.9)
    RcaCaseModule,
    // hourly purge of expired refresh-token records (plan 3.11)
    AuthTokensModule,
    // SLA escalation and work / downtime reminder notifications, every 10 minutes (EXPERT_REVIEW Area 3, item 6)
    NotificationsModule,
    // shared work-item notifications resolved for every recipient after coding / period messages (owner 18 Oct)
    NotificationResolutionModule,
    // state-derived stop events, duplicate merges and repeat-stop incidents (plan 1.10, DT-04, SME D5)
    StopEventsModule,
  ],
  providers: [WorkerHealthServer],
})
export class WorkerModule {}
