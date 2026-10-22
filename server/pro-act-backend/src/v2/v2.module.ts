import { ApprovalInboxService } from './approvals/approval-inbox.service';
import { ApprovalChangesService } from './approvals/changes/approval-changes.service';
import { ApprovalInboxV2Controller } from './approvals/approval-inbox-v2.controller';
import { EquipmentReadinessV2Controller } from './equipment-setup/equipment-readiness-v2.controller';
import { EQUIPMENT_READINESS_SERVICES } from './equipment-setup/readiness-providers';
import { MqttPreviewV2Controller } from './intake/mqtt-preview-v2.controller';
import { MqttPreviewV2Service } from './intake/mqtt-preview-v2.service';
import { Module } from '@nestjs/common';
import { RcaCaseModule } from '../rca-case/rca-case.module';
import { RcaKnowledgeModule } from '../rca-knowledge-base/rca-knowledge.module';
import { RcaKnowledgeV2Controller } from './rca-knowledge/rca-knowledge-v2.controller';
import { EventRcaLinkV2Controller } from './rca/event-rca-link-v2.controller';
import { RcaActionsV2Controller } from './rca/rca-actions-v2.controller';
import { RcaCasesV2Controller } from './rca/rca-cases-v2.controller';
import { RcaHistoryV2Controller } from './rca/rca-history-v2.controller';
import { RcaCaseCausesV2Controller } from './rca/rca-case-causes-v2.controller';
import { RcaCauseReportV2Controller } from './reports/rca-cause-report-v2.controller';
import { RcaPortfolioV2Controller } from './reports/rca-portfolio-v2.controller';
import { RcaLinksV2Controller } from './rca/rca-links-v2.controller';
import { RcaOccurrencesV2Controller } from './rca/rca-occurrences-v2.controller';
import { RcaCaseWorkspaceV2Controller } from './rca/rca-case-workspace-v2.controller';
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
import { StopVerificationV2Controller } from './production-events/stop-verification-v2.controller';
import { StopVerificationService } from './production-events/stop-verification.service';
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
import { TransitionStandardsV2Controller } from './profiles/transition-standards-v2.controller';
import { TransitionStandardsV2Service } from './profiles/transition-standards-v2.service';
import { GradeTransitionStandard } from '../profiles/entities/transition-standard.entity';
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
import { ProductionPlanReviewV2Controller } from './plans/production-plan-review-v2.controller';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { PeriodsModule } from '../periods/periods.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { PeriodAccountingV2Controller } from './accounting/period-accounting-v2.controller';
import { PeriodAccountingV2Service } from './accounting/period-accounting-v2.service';
import { EventAttributedLossesV2Controller } from './accounting/event-attributed-losses-v2.controller';
import { LossAttributionV2Service } from './accounting/loss-attribution-v2.service';
import { LossLinesV2Controller } from './accounting/loss-lines-v2.controller';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { ReconciliationV2Controller } from './reconciliation/reconciliation-v2.controller';
import { ReconciliationExceptionsV2Controller } from './reconciliation/exceptions-v2.controller';
import { ReconciliationExceptionsService } from './reconciliation/exceptions-v2.service';
import { ChangeProposalsV2Controller } from './reconciliation/change-proposals-v2.controller';
import { ReconciliationV2Service } from './reconciliation/reconciliation-v2.service';
import { ActualsAdjustmentsV2Controller } from './periods/actuals-adjustments-v2.controller';
import { QualityDispositionsModule } from '../quality-dispositions/quality-dispositions.module';
import { LotDispositionsV2Controller } from './quality-dispositions/lot-dispositions-v2.controller';
import { LotDispositionsV2Service } from './quality-dispositions/lot-dispositions-v2.service';
import { UncertaintyModule } from '../uncertainty/uncertainty.module';
import { PlantModelModule } from '../plant-model/plant-model.module';
import { BufferLevelsV2Controller } from './plant-model/buffer-levels-v2.controller';
import { FlowRoutesV2Controller } from './plant-model/flow-routes-v2.controller';
import { PlantFlowV2Service } from './plant-model/plant-flow-v2.service';
import { UnitImpactRulesV2Controller } from './plant-model/unit-impact-rules-v2.controller';
import { UnitImpactRulesV2Service } from './plant-model/unit-impact-rules-v2.service';
import { SiteLossV2Controller } from './plant-model/site-loss-v2.controller';
import { SiteLossV2Service } from './plant-model/site-loss-v2.service';
import { StreamRunsV2Controller } from './plant-model/stream-runs-v2.controller';
import { UnitStreamsV2Controller } from './plant-model/unit-streams-v2.controller';
import { UnitStreamsV2Service } from './plant-model/unit-streams-v2.service';
import { UncertaintyBudgetsV2Controller } from './uncertainty/uncertainty-budgets-v2.controller';
import { UncertaintyBudgetsV2Service } from './uncertainty/uncertainty-budgets-v2.service';
import { SourceAuthorityV2Controller } from './source-authority/source-authority-v2.controller';
import { SourceAuthorityDecisionsService } from './source-authority/source-authority-decisions.service';
import { SourceAuthorityV2Service } from './source-authority/source-authority-v2.service';
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
import { DemandStatusesV2Controller } from './valuation/demand-statuses-v2.controller';
import { FxRatesV2Controller } from './valuation/fx-rates-v2.controller';
import { FinanceTextCorrectionsV2Controller } from './valuation/finance-text-corrections-v2.controller';
import { ValuationPoliciesV2Controller } from './valuation/valuation-policies-v2.controller';
import { BadActorReportV2Controller } from './reports/bad-actor-v2.controller';
import { BadActorReportV2Service } from './reports/bad-actor-v2.service';
import { CapacityGapReportV2Controller } from './reports/capacity-gap-v2.controller';
import { CapacityGapReportV2Service } from './reports/capacity-gap-v2.service';
import { OpsReportsV2Controller } from './ops-reports/ops-reports-v2.controller';
import { OpsReportsV2Service } from './ops-reports/ops-reports-v2.service';
import { ShiftNotesV2Controller } from './ops-reports/shift-notes-v2.controller';
import { ReportExportsV2Controller } from './ops-reports/export/report-exports-v2.controller';
import { ReportExportService } from './ops-reports/export/report-export.service';
import { LossValueReportV2Controller } from './reports/loss-value-v2.controller';
import { LossValueReportV2Service } from './reports/loss-value-v2.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { FeatureFlagsV2Controller } from './feature-flags/feature-flags-v2.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { SessionBootstrapV2Controller } from './session/session-bootstrap-v2.controller';
import { SessionBootstrapV2Service } from './session/session-bootstrap-v2.service';
import { RulesModule } from '../rules/rules.module';
import { RulesV2Controller } from './rules/rules-v2.controller';
import { MasterDataV2Module } from './master-data/master-data-v2.module';
import { ReliabilityV2Module } from './reliability/reliability-v2.module';
import { StopEventsV2Module } from './stop-events/stop-events-v2.module';
import { CloseV2Module } from './close/close-v2.module';
import { NotificationsV2Module } from './notifications/notifications-v2.module';
import { SitesV2Module } from './sites/sites-v2.module';
import {
  PeriodSummariesV2Controller,
  WaterfallReportV2Controller,
} from './period-overview/period-overview-v2.controller';
import { PeriodOverviewService } from './period-overview/period-overview.service';
import { PlaReportsV2Controller } from './pla-reports/pla-reports-v2.controller';
import { PlaReportsV2Service } from './pla-reports/pla-reports-v2.service';
import { ActivitySummaryV2Controller } from './activity-summary/activity-summary-v2.controller';
import { ActivitySummaryV2Service } from './activity-summary/activity-summary-v2.service';
import {
  AdministrationV2Module,
  ADMINISTRATION_V2_CONTROLLERS,
} from './administration/administration-v2.module';
import { RcaPoliciesV2Controller } from './rca-policies/rca-policies-v2.controller';
import { RcaPoliciesV2Service } from './rca-policies/rca-policies-v2.service';

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
      GradeTransitionStandard,
      PlanVersion,
      PlanPeriod,
      PlanScenario,
      ProductionPeriod,
      CalculationRun,
      AccountingPolicy,
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
    QualityDispositionsModule,
    UncertaintyModule,
    PlantModelModule,
    AccountingModule,
    ReconciliationModule,
    ExportsModule,
    ValuationModule,
    FeatureFlagsModule,
    RulesModule,
    RcaCaseModule,
    RcaKnowledgeModule,
    AdministrationV2Module,
    MasterDataV2Module,
    ReliabilityV2Module,
    StopEventsV2Module,
    CloseV2Module,
    NotificationsV2Module,
    SitesV2Module,
    NotificationsModule,
  ],
  controllers: [
    ApprovalInboxV2Controller,
    EquipmentReadinessV2Controller,
    ProductionEventOperationsV2Controller,
    StopVerificationV2Controller,
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
    MqttPreviewV2Controller,
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
    TransitionStandardsV2Controller,
    RateImportsV2Controller,
    ProductionPlansV2Controller,
    ProductionPlanReviewV2Controller,
    PlanScenariosV2Controller,
    PlanGenerationJobsV2Controller,
    ProductionPeriodsV2Controller,
    ActualsAdjustmentsV2Controller,
    LotDispositionsV2Controller,
    UncertaintyBudgetsV2Controller,
    UnitStreamsV2Controller,
    StreamRunsV2Controller,
    FlowRoutesV2Controller,
    UnitImpactRulesV2Controller,
    BufferLevelsV2Controller,
    SiteLossV2Controller,
    SourceAuthorityV2Controller,
    ExternalReportsV2Controller,
    ActualsJobsV2Controller,
    PeriodAccountingV2Controller,
    EventAttributedLossesV2Controller,
    LossLinesV2Controller,
    ReconciliationV2Controller,
    ReconciliationExceptionsV2Controller,
    ChangeProposalsV2Controller,
    ExportsV2Controller,
    DeliveriesV2Controller,
    KpiReportsV2Controller,
    FxRatesV2Controller,
    DemandStatusesV2Controller,
    FinanceTextCorrectionsV2Controller,
    ValuationPoliciesV2Controller,
    LossValueReportV2Controller,
    BadActorReportV2Controller,
    CapacityGapReportV2Controller,
    OpsReportsV2Controller,
    ShiftNotesV2Controller,
    ReportExportsV2Controller,
    FeatureFlagsV2Controller,
    SessionBootstrapV2Controller,
    RulesV2Controller,
    RcaCasesV2Controller,
    RcaHistoryV2Controller,
    RcaCaseCausesV2Controller,
    RcaCauseReportV2Controller,
    RcaPortfolioV2Controller,
    RcaLinksV2Controller,
    RcaOccurrencesV2Controller,
    RcaCaseWorkspaceV2Controller,
    EventRcaLinkV2Controller,
    RcaActionsV2Controller,
    RcaKnowledgeV2Controller,
    PeriodSummariesV2Controller,
    WaterfallReportV2Controller,
    PlaReportsV2Controller,
    ActivitySummaryV2Controller,
    ...ADMINISTRATION_V2_CONTROLLERS,
    RcaPoliciesV2Controller,
  ],
  providers: [
    SessionBootstrapV2Service,
    ApprovalInboxService,
    ApprovalChangesService,
    ...EQUIPMENT_READINESS_SERVICES,
    ProductionEventsV2Service,
    ProductionEventHistoryService,
    ProductionEventsV2CommandService,
    ProductionEventOperationsV2Service,
    StopVerificationService,
    EventReferencesValidator,
    SourceMappingsV2Service,
    AttributeMappingsV2Service,
    AttributeMappingPreviewService,
    IntakeQueriesV2Service,
    MqttPreviewV2Service,
    SignalsV2Service,
    CalendarsV2Service,
    ProfilesV2Service,
    TransitionStandardsV2Service,
    PlansV2Service,
    PeriodsV2Service,
    LotDispositionsV2Service,
    UncertaintyBudgetsV2Service,
    UnitStreamsV2Service,
    PlantFlowV2Service,
    UnitImpactRulesV2Service,
    SiteLossV2Service,
    SourceAuthorityV2Service,
    SourceAuthorityDecisionsService,
    PeriodAccountingV2Service,
    LossAttributionV2Service,
    ReconciliationV2Service,
    ReconciliationExceptionsService,
    KpiReportsV2Service,
    LossValueReportV2Service,
    BadActorReportV2Service,
    CapacityGapReportV2Service,
    OpsReportsV2Service,
    ReportExportService,
    PeriodOverviewService,
    PlaReportsV2Service,
    ActivitySummaryV2Service,
    RcaPoliciesV2Service,
  ],
})
export class V2Module {}
