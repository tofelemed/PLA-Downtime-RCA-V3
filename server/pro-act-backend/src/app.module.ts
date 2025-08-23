import { Module, MiddlewareConsumer, RequestMethod, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '1433', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // Use migrations or run your SQL script manually
      options: {
        encrypt: false, // Set to true if using Azure SQL or require encryption
      },
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
  ],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
