# app.module.ts Update - All New Modules

## Add These Imports at Top of File

```typescript
// RCA & Analysis Modules (Created Today)
import { RCATriggerConfigModule } from './rca-trigger-config/rca-trigger-config.module';
import { RCAKnowledgeBaseModule } from './rca-knowledge-base/rca-knowledge-base.module';
import { RCAAnalysisConfigModule } from './rca-analysis-config/rca-analysis-config.module';
import { FiveWhyAnalysisModule } from './five-why-analysis/five-why-analysis.module';
import { FishboneDiagramModule } from './fishbone-diagram/fishbone-diagram.module';
import { FMEAAnalysisModule } from './fmea-analysis/fmea-analysis.module';

// Remaining Analysis Tools (To Be Created)
import { FaultTreeAnalysisModule } from './fault-tree-analysis/fault-tree-analysis.module';
import { BarrierAnalysisModule } from './barrier-analysis/barrier-analysis.module';
import { ChangeAnalysisModule } from './change-analysis/change-analysis.module';

// PI Integration Modules (To Be Created)
import { PIConnectionModule } from './pi-connection/pi-connection.module';
import { PIAfElementModule } from './pi-af-element/pi-af-element.module';
import { AfBindingModule } from './af-binding/af-binding.module';
import { PIEventModule } from './pi-event/pi-event.module';
import { PIMappingModule } from './pi-mapping/pi-mapping.module';
import { PISyncWatermarkModule } from './pi-sync-watermark/pi-sync-watermark.module';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { HistorianTagModule } from './historian-tag/historian-tag.module';

// Integration & Custom Modules (To Be Created)
import { DataSourceModule } from './data-source/data-source.module';
import { CustomAttributeDefinitionModule } from './custom-attribute-definition/custom-attribute-definition.module';
import { CustomAttributeValueModule } from './custom-attribute-value/custom-attribute-value.module';

// Special Historian Module (To Be Created)
import { HistorianHistoryModule } from './historian-history/historian-history.module';
```

## Add These to imports Array in @Module Decorator

```typescript
@Module({
  imports: [
    TypeOrmModule.forRoot({ /* existing config */ }),
    
    // Existing modules...
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
    
    // NEW MODULES - Add all of these ⭐
    RCATriggerConfigModule,
    RCAKnowledgeBaseModule,
    RCAAnalysisConfigModule,
    FiveWhyAnalysisModule,
    FishboneDiagramModule,
    FMEAAnalysisModule,
    
    // Uncomment as you create these modules:
    // FaultTreeAnalysisModule,
    // BarrierAnalysisModule,
    // ChangeAnalysisModule,
    // PIConnectionModule,
    // PIAfElementModule,
    // AfBindingModule,
    // PIEventModule,
    // PIMappingModule,
    // PISyncWatermarkModule,
    // PISyncJobModule,
    // HistorianTagModule,
    // DataSourceModule,
    // CustomAttributeDefinitionModule,
    // CustomAttributeValueModule,
    // HistorianHistoryModule,
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
```

## Testing

After updating `app.module.ts`:

```bash
# Restart server
npm run start:dev

# Check for errors in console
# If all modules imported correctly, server should start

# Access Swagger to verify new endpoints
http://localhost:3000/api
```

## Troubleshooting

### Module Not Found Error
- Verify module file exists at specified path
- Check module export in module.ts file
- Ensure consistent naming (kebab-case for folders)

### Compilation Errors
- Check all imports use correct paths
- Verify module class names match file names
- Ensure all dependencies injected properly

### Runtime Errors
- Check database connection
- Verify entities registered in TypeORM
- Check for circular dependencies

---

**Status**: Ready to update with first 6 modules  
**Remaining**: 12 modules to add as created

