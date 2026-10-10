import { Module } from '@nestjs/common';
import { RcaCaseModule } from '../rca-case/rca-case.module';
import { EventRcaLinkV2Controller } from './rca/event-rca-link-v2.controller';
import { RcaActionsV2Controller } from './rca/rca-actions-v2.controller';
import { RcaCasesV2Controller } from './rca/rca-cases-v2.controller';
import { RcaLinksV2Controller } from './rca/rca-links-v2.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
import { Product } from '../product/product.entity';
import { EventCoding } from '../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../production-event/revisions/event-revision.entity';
import { EventReviewItemsV2Controller } from './event-review-items/event-review-items-v2.controller';
import { ProductionEventHistoryService } from './production-events/production-event-history.service';
import { EventReferencesValidator } from './production-events/event-references.validator';
import { ProductionEventsV2Controller } from './production-events/production-events-v2.controller';
import { ProductionEventsV2Service } from './production-events/production-events-v2.service';
import { ProductionEventsV2CommandService } from './production-events/production-events-v2-commands.service';
import { AttributeMappingVersion } from '../attribute-mapping/attribute-mapping-version.entity';
import { AttributeMappingModule } from '../attribute-mapping/attribute-mapping.module';
import { CodeLibraryModule } from '../code-library/code-library.module';
import { SourceMapping } from '../source-mapping/source-mapping.entity';
import { SourceMappingModule } from '../source-mapping/source-mapping.module';
import { AttributeMappingsV2Controller } from './attribute-mappings/attribute-mappings-v2.controller';
import { AttributeMappingsV2Service } from './attribute-mappings/attribute-mappings-v2.service';
import { AttributeMappingPreviewService } from './attribute-mappings/attribute-mapping-preview.service';
import { CodeMappingRulesV2Controller } from './code-libraries/code-mapping-rules-v2.controller';
import { FailureCodeGroupsV2Controller } from './code-libraries/failure-code-groups-v2.controller';
import { ImpactCodesV2Controller } from './code-libraries/impact-codes-v2.controller';
import { LossCategoryDefsV2Controller } from './code-libraries/loss-category-defs-v2.controller';
import { OeeCodesV2Controller } from './code-libraries/oee-codes-v2.controller';
import { ReasonCodesV2Controller } from './code-libraries/reason-codes-v2.controller';
import { SourceMappingsV2Controller } from './source-mappings/source-mappings-v2.controller';
import { SourceMappingsV2Service } from './source-mappings/source-mappings-v2.service';
import { EventRelation } from '../event-operations/event-relation.entity';
import { EventOperationsModule } from '../event-operations/event-operations.module';
import { JobsV2Controller } from './jobs/jobs-v2.controller';
import { ProductionEventOperationsV2Controller } from './production-events/production-event-operations-v2.controller';
import { ProductionEventOperationsV2Service } from './production-events/production-event-operations-v2.service';
import { IntakeModule } from '../intake/intake.module';
import { IngestionException } from '../intake/entities/ingestion-exception.entity';
import { IngestionJobTransition } from '../intake/entities/ingestion-job-transition.entity';
import { IngestionJob } from '../intake/entities/ingestion-job.entity';
import { IntegrationConnection } from '../intake/entities/integration-connection.entity';
import { ReplayRun } from '../intake/entities/replay-run.entity';
import { ConnectionsV2Controller } from './intake/connections-v2.controller';
import { IngestionExceptionsV2Controller } from './intake/ingestion-exceptions-v2.controller';
import { IngestionJobsV2Controller } from './intake/ingestion-jobs-v2.controller';
import { IntakeQueriesV2Service } from './intake/intake-queries-v2.service';
import { ReplayRunsV2Controller } from './intake/replay-runs-v2.controller';
import { Signal } from '../signals/entities/signal.entity';
import { SignalsModule } from '../signals/signals.module';
import { SignalsV2Controller } from './signals/signals-v2.controller';
import { SignalsV2Service } from './signals/signals-v2.service';
import { CalendarModule } from '../calendar/calendar.module';
import { CalendarVersion } from '../calendar/entities/calendar-version.entity';
import { CrewRotation } from '../calendar/entities/crew-rotation.entity';
import { Crew } from '../calendar/entities/crew.entity';
import { ShiftInstance } from '../calendar/entities/shift-instance.entity';
import { Site } from '../calendar/entities/site.entity';
import { CalendarScheduleV2Controller } from './calendars/calendar-schedule-v2.controller';
import { CalendarVersionsV2Controller } from './calendars/calendar-versions-v2.controller';
import { CalendarsV2Service } from './calendars/calendars-v2.service';
import { CrewsV2Controller } from './calendars/crews-v2.controller';
import { ProductionProfile } from '../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../profiles/entities/valuation-rate.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProfilesV2Controller } from './profiles/profiles-v2.controller';
import { ProfilesV2Service } from './profiles/profiles-v2.service';
import { RateImportsV2Controller } from './profiles/rate-imports-v2.controller';
import { RatesV2Controller } from './profiles/rates-v2.controller';
import { ValuationRatesV2Controller } from './profiles/valuation-rates-v2.controller';
import { PlanPeriod } from '../plans/entities/plan-period.entity';
import { PlanScenario } from '../plans/entities/plan-scenario.entity';
import { PlanVersion } from '../plans/entities/plan-version.entity';
import { PlansModule } from '../plans/plans.module';
import { PlanGenerationJobsV2Controller } from './plans/plan-generation-jobs-v2.controller';
import { PlanScenariosV2Controller } from './plans/plan-scenarios-v2.controller';
import { PlansV2Service } from './plans/plans-v2.service';
import { ProductionPlansV2Controller } from './plans/production-plans-v2.controller';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { PeriodsModule } from '../periods/periods.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { PeriodAccountingV2Controller } from './accounting/period-accounting-v2.controller';
import { PeriodAccountingV2Service } from './accounting/period-accounting-v2.service';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { ReconciliationV2Controller } from './reconciliation/reconciliation-v2.controller';
import { ChangeProposalsV2Controller } from './reconciliation/change-proposals-v2.controller';
import { ReconciliationV2Service } from './reconciliation/reconciliation-v2.service';
import { ActualsAdjustmentsV2Controller } from './periods/actuals-adjustments-v2.controller';
import { ActualsJobsV2Controller } from './periods/actuals-jobs-v2.controller';
import { ExternalReportsV2Controller } from './periods/external-reports-v2.controller';
import { PeriodsV2Service } from './periods/periods-v2.service';
import { ProductionPeriodsV2Controller } from './periods/production-periods-v2.controller';
import { ExportsModule } from '../exports/exports.module';
import { DeliveriesV2Controller } from './exports/deliveries-v2.controller';
import { ExportsV2Controller } from './exports/exports-v2.controller';
import { KpiReportsV2Controller } from './reports/kpi-reports-v2.controller';
import { KpiReportsV2Service } from './reports/kpi-reports-v2.service';
import { ValuationModule } from '../valuation/valuation.module';
import { FxRatesV2Controller } from './valuation/fx-rates-v2.controller';
import { ValuationPoliciesV2Controller } from './valuation/valuation-policies-v2.controller';
import { LossValueReportV2Controller } from './reports/loss-value-v2.controller';
import { LossValueReportV2Service } from './reports/loss-value-v2.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { FeatureFlagsV2Controller } from './feature-flags/feature-flags-v2.controller';
import { RulesModule } from '../rules/rules.module';
import { RulesV2Controller } from './rules/rules-v2.controller';
import { UnitsV2Controller } from './units/units-v2.controller';
import { UnitsV2Service } from './units/units-v2.service';
import { ProductsV2Controller } from './products/products-v2.controller';
import { ProductsV2Service } from './products/products-v2.service';
import {
  PeriodSummariesV2Controller,
  WaterfallReportV2Controller,
} from './period-overview/period-overview-v2.controller';
import { PeriodOverviewService } from './period-overview/period-overview.service';
import { PlaReportsV2Controller } from './pla-reports/pla-reports-v2.controller';
import { PlaReportsV2Service } from './pla-reports/pla-reports-v2.service';

/**
 * Home of every `/api/v2` resource (see CONVENTIONS.md). Kept separate from the v1 feature modules so the
 * v2 Swagger document can be generated from this module alone.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionEvent,
      Unit,
      Product,
      Asset,
      ReasonCode,
      ProductionPlan,
      EventRevision,
      EventCoding,
      EventReviewItem,
      SourceMapping,
      AttributeMappingVersion,
      EventRelation,
      IntegrationConnection,
      IngestionJob,
      IngestionJobTransition,
      IngestionException,
      ReplayRun,
      Signal,
      Site,
      CalendarVersion,
      ShiftInstance,
      Crew,
      CrewRotation,
      ProductionProfile,
      UnitProductRate,
      ValuationRate,
      PlanVersion,
      PlanPeriod,
      PlanScenario,
      ProductionPeriod,
      CalculationRun,
    ]),
    ProductionEventModule,
    CodeLibraryModule,
    SourceMappingModule,
    AttributeMappingModule,
    EventOperationsModule,
    IntakeModule,
    SignalsModule,
    CalendarModule,
    ProfilesModule,
    PlansModule,
    PeriodsModule,
    AccountingModule,
    ReconciliationModule,
    ExportsModule,
    ValuationModule,
    FeatureFlagsModule,
    RulesModule,
    RcaCaseModule,
  ],
  controllers: [
    ProductionEventOperationsV2Controller,
    ProductionEventsV2Controller,
    EventReviewItemsV2Controller,
    SourceMappingsV2Controller,
    AttributeMappingsV2Controller,
    ReasonCodesV2Controller,
    ImpactCodesV2Controller,
    OeeCodesV2Controller,
    FailureCodeGroupsV2Controller,
    LossCategoryDefsV2Controller,
    CodeMappingRulesV2Controller,
    JobsV2Controller,
    ConnectionsV2Controller,
    IngestionJobsV2Controller,
    IngestionExceptionsV2Controller,
    ReplayRunsV2Controller,
    SignalsV2Controller,
    CalendarVersionsV2Controller,
    CalendarScheduleV2Controller,
    CrewsV2Controller,
    ProfilesV2Controller,
    RatesV2Controller,
    ValuationRatesV2Controller,
    RateImportsV2Controller,
    ProductionPlansV2Controller,
    PlanScenariosV2Controller,
    PlanGenerationJobsV2Controller,
    ProductionPeriodsV2Controller,
    ActualsAdjustmentsV2Controller,
    ExternalReportsV2Controller,
    ActualsJobsV2Controller,
    PeriodAccountingV2Controller,
    ReconciliationV2Controller,
    ChangeProposalsV2Controller,
    ExportsV2Controller,
    DeliveriesV2Controller,
    KpiReportsV2Controller,
    FxRatesV2Controller,
    ValuationPoliciesV2Controller,
    LossValueReportV2Controller,
    FeatureFlagsV2Controller,
    RulesV2Controller,
    RcaCasesV2Controller,
    RcaLinksV2Controller,
    EventRcaLinkV2Controller,
    RcaActionsV2Controller,
    UnitsV2Controller,
    ProductsV2Controller,
    PeriodSummariesV2Controller,
    WaterfallReportV2Controller,
    PlaReportsV2Controller,
  ],
  providers: [
    ProductionEventsV2Service,
    ProductionEventHistoryService,
    ProductionEventsV2CommandService,
    ProductionEventOperationsV2Service,
    EventReferencesValidator,
    SourceMappingsV2Service,
    AttributeMappingsV2Service,
    AttributeMappingPreviewService,
    IntakeQueriesV2Service,
    SignalsV2Service,
    CalendarsV2Service,
    UnitsV2Service,
    ProductsV2Service,
    ProfilesV2Service,
    PlansV2Service,
    PeriodsV2Service,
    PeriodAccountingV2Service,
    ReconciliationV2Service,
    KpiReportsV2Service,
    LossValueReportV2Service,
    PeriodOverviewService,
    PlaReportsV2Service,
  ],
})
export class V2Module {}
