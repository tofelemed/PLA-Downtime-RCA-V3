import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware';
import { throttlerOptionsFromEnv } from './common/throttling/throttler.config';
import { UserIpThrottlerGuard } from './common/throttling/user-ip-throttler.guard';
import { V2Module } from './v2/v2.module';
import { MigrationCutoverModule } from './migration-cutover/migration-cutover.module';
import { SchedulerModule } from './common/scheduling/scheduler.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationModule } from './organization/organization.module';
import { TenantModule } from './tenant/tenant.module';
import { UnitModule } from './unit/unit.module';
import { AssetModule } from './asset/asset.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ProductModule } from './product/product.module';
import { ProductionPlanModule } from './production-plan/production-plan.module';
import { ProductionEventModule } from './production-event/production-event.module';
import { RCAModule } from './rca/rca.module';
import { TaskModule } from './task/task.module';
import { NotificationResolutionModule } from './notifications/notification-resolution.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ScopedRealtimeModule } from './realtime/scoped-realtime.module';
import { TenantSessionBinding } from './database/rls/tenant-session-binding';
import { IntegrationModule } from './integration/integration.module';
import { IntakeModule } from './intake/intake.module';
import { MqttAdapterModule } from './intake/adapters/mqtt/mqtt-adapter.module';
import { HealthModule } from './health/health.module';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { HierarchyMappingModule } from './hierarchy-mapping/hierarchy-mapping.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { runtimeDataSourceOptions } from './database/data-source';
import { registerPgTypeParsers } from './database/pg-type-parsers';
import { AccessModule } from './auth/access/access.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { ScopeGuard } from './auth/guards/scope.guard';
import { TenantBindingGuard } from './auth/guards/tenant-binding.guard';
import { WriteAccessGuard } from './auth/guards/write-access.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RetentionModule } from './common/retention/retention.module';
import * as dotenv from 'dotenv';
dotenv.config();

registerPgTypeParsers();

@Module({
  imports: [
    CommonModule,
    // Identity resolution, user scopes and the role/scope guards (WF05)
    AccessModule,
    // Idempotency-Key storage for @Idempotent() commands (API02)
    IdempotencyModule,
    // Audit-table and raw-partition retention (DB-07), disabled until windows are configured
    RetentionModule,
    // Global rate limit (429 + Retry-After); per user when authenticated, per IP otherwise
    ThrottlerModule.forRoot(throttlerOptionsFromEnv()),
    // Cron providers are live only in PROCESS_ROLE=worker|all; the api role is HTTP-only
    SchedulerModule.register(),
    // Pool, statement timeout and slow-query log (plan 3.11). Pending migrations are applied by main.ts
    // before the app starts (runMigrationsOnBoot; DB_MIGRATIONS_RUN=false where a release step runs them)
    TypeOrmModule.forRoot(runtimeDataSourceOptions()),
    AuthModule,
    UsersModule,
    OrganizationModule,
    TenantModule,
    UnitModule,
    AssetModule,
    AuditLogModule,
    ProductModule,
    ProductionPlanModule,
    ProductionEventModule,
    RCAModule,
    TaskModule,
    // shared work-item notifications resolved after domain messages (the `all` role relays the outbox here)
    NotificationResolutionModule,
    AppSettingsModule,
    RealtimeModule,
    // authenticated, tenant/unit-scoped channel fed from the outbox (plan 3.1)
    ScopedRealtimeModule,
    IntegrationModule,
    // durable intake core (plan 1.5): raw store, jobs, quarantine, replay, outbox/inbox
    IntakeModule,
    // MQTT source adapter (plan 1.8): config validation, duplicate-feed guard, connection test
    MqttAdapterModule,
    HealthModule,
    PISyncJobModule,
    HierarchyMappingModule,
    // /api/v2 resources (src/v2/CONVENTIONS.md)
    V2Module,
    // Plan 3.10: MIG05 v1 write freeze (423) for a tenant being cut over
    MigrationCutoverModule,
  ],
  // Global guard chain, in order: rate limit → authentication (@Public / @PublicIf skip it)
  // → @Roles → @ScopeParam → read-only roles → @TenantBound. Every route is protected unless it opts out explicitly.
  providers: [
    { provide: APP_GUARD, useClass: UserIpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_GUARD, useClass: WriteAccessGuard },
    { provide: APP_GUARD, useClass: TenantBindingGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    // Plan 3.11: per-connection tenant binding for row-level security (on unless DB_RLS_TENANT_BINDING=false)
    TenantSessionBinding,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        CorrelationIdMiddleware,
        RequestContextMiddleware,
        RequestLoggerMiddleware,
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
