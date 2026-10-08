import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware';
import { throttlerOptionsFromEnv } from './common/throttling/throttler.config';
import { UserIpThrottlerGuard } from './common/throttling/user-ip-throttler.guard';
import { V2Module } from './v2/v2.module';
import { SchedulerModule } from './common/scheduling/scheduler.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationModule } from './organization/organization.module';
import { TenantModule } from './tenant/tenant.module';
import { UnitModule } from './unit/unit.module';
import { AssetModule } from './asset/asset.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ImpactCodeModule } from './impact-code/impact-code.module';
import { OEECodeModule } from './oee-code/oee-code.module';
import { RCACauseCodeModule } from './rca-cause-code/rca-cause-code.module';
import { VerificationStatusCodeModule } from './verification-status-code/verification-status-code.module';
import { RolesModule } from './roles/roles.module';
import { ProductModule } from './product/product.module';
import { ProductionPlanTemplateModule } from './production-plan-template/production-plan-template.module';
import { ProductionPlanModule } from './production-plan/production-plan.module';
import { ProductionEventModule } from './production-event/production-event.module';
import { RCAModule } from './rca/rca.module';
import { RCARecommendationModule } from './rca-recommendation/rca-recommendation.module';
import { RCATemplateModule } from './rca-template/rca-template.module';
import { ReasonCodeModule } from './reason-code/reason-code.module';
import { TaskModule } from './task/task.module';
import { DashboardConfigurationModule } from './dashboard-configuration/dashboard-configuration.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { LogicTreeNodeModule } from './logic-tree-node/logic-tree-node.module';
import { EvidenceCategoryModule } from './evidence-category/evidence-category.module';
import { EvidenceLocationModule } from './evidence-location/evidence-location.module';
import { ProductionLossModule } from './production-loss/production-loss.module';
import { OEESummaryModule } from './oee-summary/oee-summary.module';
import { ReconcileFormModule } from './reconcile-form/reconcile-form.module';
import { LossCategoryModule } from './loss-category/loss-category.module';
import { UnmappedEventModule } from './unmapped-event/unmapped-event.module';
import { RCAEvidenceModule } from './rca-evidence/rca-evidence.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReportingModule } from './reporting/reporting.module';
import { IntegrationModule } from './integration/integration.module';
import { HealthModule } from './health/health.module';
import { ConnectivityModule } from './connectivity/connectivity.module';
import { PIProxyModule } from './pi-proxy/pi-proxy.module';
import { RCATriggerConfigModule } from './rca-trigger-config/rca-trigger-config.module';
import { RCAKnowledgeBaseModule } from './rca-knowledge-base/rca-knowledge-base.module';
import { RCAAnalysisConfigModule } from './rca-analysis-config/rca-analysis-config.module';
import { RCAAnalysisMethodologyModule } from './rca-analysis-methodology/rca-analysis-methodology.module';
import { FiveWhyAnalysisModule } from './five-why-analysis/five-why-analysis.module';
import { FishboneDiagramModule } from './fishbone-diagram/fishbone-diagram.module';
import { FMEAAnalysisModule } from './fmea-analysis/fmea-analysis.module';
import { FaultTreeAnalysisModule } from './fault-tree-analysis/fault-tree-analysis.module';
import { BarrierAnalysisModule } from './barrier-analysis/barrier-analysis.module';
import { ChangeAnalysisModule } from './change-analysis/change-analysis.module';
import { PIConnectionModule } from './pi-connection/pi-connection.module';
import { PIAfElementModule } from './pi-af-element/pi-af-element.module';
import { AfBindingModule } from './af-binding/af-binding.module';
import { PIEventModule } from './pi-event/pi-event.module';
import { PIMappingModule } from './pi-mapping/pi-mapping.module';
import { PISyncWatermarkModule } from './pi-sync-watermark/pi-sync-watermark.module';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { HistorianTagModule } from './historian-tag/historian-tag.module';
import { DataSourceModule } from './data-source/data-source.module';
import { CustomAttributeDefinitionModule } from './custom-attribute-definition/custom-attribute-definition.module';
import { CustomAttributeValueModule } from './custom-attribute-value/custom-attribute-value.module';
import { HistorianHistoryModule } from './historian-history/historian-history.module';
import { HierarchyMappingModule } from './hierarchy-mapping/hierarchy-mapping.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { StreamingModule } from './streaming/streaming.module';
import { dataSourceOptions } from './database/data-source';
import { registerPgTypeParsers } from './database/pg-type-parsers';
import { AccessModule } from './auth/access/access.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { ScopeGuard } from './auth/guards/scope.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
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
    // Global rate limit (429 + Retry-After); per user when authenticated, per IP otherwise
    ThrottlerModule.forRoot(throttlerOptionsFromEnv()),
    // Cron providers are live only in PROCESS_ROLE=worker|all; the api role is HTTP-only
    SchedulerModule.register(),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      // Pending migrations are applied on boot; set DB_MIGRATIONS_RUN=false where a release step runs them
      migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
    }),
    AuthModule,
    UsersModule,
    OrganizationModule,
    TenantModule,
    UnitModule,
    AssetModule,
    AuditLogModule,
    ImpactCodeModule,
    OEECodeModule,
    RCACauseCodeModule,
    VerificationStatusCodeModule,
    RolesModule,
    ProductModule,
    ProductionPlanTemplateModule,
    ProductionPlanModule,
    ProductionEventModule,
    RCAModule,
    RCARecommendationModule,
    RCAEvidenceModule,
    RCATemplateModule,
    ReasonCodeModule,
    TaskModule,
    DashboardConfigurationModule,
    AppSettingsModule,
    LogicTreeNodeModule,
    EvidenceCategoryModule,
    EvidenceLocationModule,
    ProductionLossModule,
    OEESummaryModule,
    ReconcileFormModule,
    LossCategoryModule,
    UnmappedEventModule,
    RealtimeModule,
    ReportingModule,
    IntegrationModule,
    HealthModule,
    ConnectivityModule,
    PIProxyModule,
    // New Modules - Analysis & RCA Tools
    RCATriggerConfigModule,
    RCAKnowledgeBaseModule,
    RCAAnalysisConfigModule,
    RCAAnalysisMethodologyModule,
    FiveWhyAnalysisModule,
    FishboneDiagramModule,
    FMEAAnalysisModule,
    FaultTreeAnalysisModule,
    BarrierAnalysisModule,
    ChangeAnalysisModule,
    // PI Integration Modules
    PIConnectionModule,
    PIAfElementModule,
    AfBindingModule,
    PIEventModule,
    PIMappingModule,
    PISyncWatermarkModule,
    PISyncJobModule,
    HistorianTagModule,
    // Custom Attributes & Integration
    DataSourceModule,
    CustomAttributeDefinitionModule,
    CustomAttributeValueModule,
    HistorianHistoryModule,
    HierarchyMappingModule,
    StreamingModule,
    // /api/v2 resources (src/v2/CONVENTIONS.md)
    V2Module,
  ],
  // Global guard chain, in order: rate limit → authentication (@Public / @PublicIf skip it)
  // → @Roles → @ScopeParam. Every route is protected unless it opts out explicitly.
  providers: [
    { provide: APP_GUARD, useClass: UserIpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
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
