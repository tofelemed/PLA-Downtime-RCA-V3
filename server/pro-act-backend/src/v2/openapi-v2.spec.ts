import { RcaCaseModule } from '../rca-case/rca-case.module';
import { RcaKnowledgeSimilarService } from '../rca-knowledge-base/knowledge-similar.service';
import { RcaKnowledgeV2CommandsService } from '../rca-knowledge-base/knowledge-v2-commands.service';
import { RcaKnowledgeV2Service } from '../rca-knowledge-base/knowledge-v2.service';
import { RcaKnowledgeModule } from '../rca-knowledge-base/rca-knowledge.module';
import { RcaActionsService } from '../rca-case/rca-actions.service';
import { RcaAnalysesService } from '../rca-case/rca-analyses.service';
import { RcaAttachmentsService } from '../rca-case/rca-attachments.service';
import { RcaCaseCommandsService } from '../rca-case/rca-case-commands.service';
import { RcaCasesService } from '../rca-case/rca-cases.service';
import { RcaLinksService } from '../rca-case/rca-links.service';
import { RcaRecommendationsService } from '../rca-case/rca-recommendations.service';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock/clock';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { configureHttpApp } from '../common/http/configure-http-app';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { ProductionEventService } from '../production-event/production-event.service';
import { EventCoding } from '../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../production-event/revisions/event-revision.entity';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
import { Product } from '../product/product.entity';
import { AttributeMappingVersion } from '../attribute-mapping/attribute-mapping-version.entity';
import { AttributeMappingModule } from '../attribute-mapping/attribute-mapping.module';
import { AttributeMappingService } from '../attribute-mapping/attribute-mapping.service';
import { CodeDefaultsService } from '../code-library/code-defaults.service';
import { CodeLibraryCommandService } from '../code-library/code-library-commands.service';
import { CodeLibraryModule } from '../code-library/code-library.module';
import { CodeLibraryService } from '../code-library/code-library.service';
import { CodeMappingRuleService } from '../code-library/code-mapping-rule.service';
import { SourceMapping } from '../source-mapping/source-mapping.entity';
import { SourceMappingModule } from '../source-mapping/source-mapping.module';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { BulkCodeService } from '../event-operations/bulk-code.service';
import { BulkJobService } from '../event-operations/bulk-job.service';
import { EventCommandService } from '../event-operations/event-command.service';
import { EventOperationsModule } from '../event-operations/event-operations.module';
import { EventRelation } from '../event-operations/event-relation.entity';
import { IntegrationConnectionService } from '../intake/connections/integration-connection.service';
import { IngestionException } from '../intake/entities/ingestion-exception.entity';
import { IngestionJobTransition } from '../intake/entities/ingestion-job-transition.entity';
import { IngestionJob } from '../intake/entities/ingestion-job.entity';
import { IntegrationConnection } from '../intake/entities/integration-connection.entity';
import { ReplayRun } from '../intake/entities/replay-run.entity';
import { IngestionExceptionsService } from '../intake/exceptions/ingestion-exceptions.service';
import { IntakeModule } from '../intake/intake.module';
import { IngestionJobsService } from '../intake/jobs/ingestion-jobs.service';
import { ReplayService } from '../intake/replay/replay.service';
import { Signal } from '../signals/entities/signal.entity';
import { SignalBackfillService } from '../signals/signal-backfill.service';
import { SignalPreviewService } from '../signals/signal-preview.service';
import { SignalsModule } from '../signals/signals.module';
import { SignalsService } from '../signals/signals.service';
import { CalendarModule } from '../calendar/calendar.module';
import { CalendarPreviewService } from '../calendar/calendar-preview.service';
import { CalendarPublishService } from '../calendar/calendar-publish.service';
import { CalendarVersionsService } from '../calendar/calendar-versions.service';
import { CrewsService } from '../calendar/crews.service';
import { CalendarVersion } from '../calendar/entities/calendar-version.entity';
import { CrewRotation } from '../calendar/entities/crew-rotation.entity';
import { Crew } from '../calendar/entities/crew.entity';
import { ShiftInstance } from '../calendar/entities/shift-instance.entity';
import { Site } from '../calendar/entities/site.entity';
import { SitesService } from '../calendar/sites.service';
import { ProductionProfile } from '../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../profiles/entities/valuation-rate.entity';
import { GradeTransitionStandard } from '../profiles/entities/transition-standard.entity';
import { ProfileResolutionService } from '../profiles/profile-resolution.service';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProfilesService } from '../profiles/profiles.service';
import { RateImportsService } from '../profiles/rate-imports.service';
import { RatesService } from '../profiles/rates.service';
import { ValuationRatesService } from '../profiles/valuation-rates.service';
import { TransitionStandardsService } from '../profiles/transition-standards.service';
import { PlanPeriod } from '../plans/entities/plan-period.entity';
import { PlanScenario } from '../plans/entities/plan-scenario.entity';
import { PlanVersion } from '../plans/entities/plan-version.entity';
import { PlanApprovalService } from '../plans/plan-approval.service';
import { PlanReviewService } from '../plans/plan-review.service';
import { PlanGenerationJobsService } from '../plans/plan-generation-jobs.service';
import { PlanLegacyBridge } from '../plans/plan-legacy-bridge.service';
import { PlanPeriodGeneratorService } from '../plans/plan-period-generator.service';
import { PlanScenariosService } from '../plans/plan-scenarios.service';
import { PlanVersionsService } from '../plans/plan-versions.service';
import { PlansModule } from '../plans/plans.module';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { ActualsAdjustmentsService } from '../periods/actuals-adjustments.service';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { ApprovalService } from '../reconciliation/approval.service';
import { ChangeProposalsService } from '../reconciliation/change-proposals.service';
import { DraftLinesService } from '../reconciliation/draft-lines.service';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { RevisionLifecycleService } from '../reconciliation/revision-lifecycle.service';
import { SubmissionService } from '../reconciliation/submission.service';
import { ActualsJobsService } from '../periods/actuals-jobs.service';
import { ExternalReportsService } from '../periods/external-reports.service';
import { PeriodsModule } from '../periods/periods.module';
import { PeriodsService } from '../periods/periods.service';
import { AccountingCommandsService } from '../accounting/accounting-commands.service';
import { AccountingModule } from '../accounting/accounting.module';
import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { DeliveryReconciliationService } from '../exports/delivery-reconciliation.service';
import { ExportJobsService } from '../exports/export-jobs.service';
import { ExportReadsService } from '../exports/export-reads.service';
import { ExportRequestsService } from '../exports/export-requests.service';
import { DemandStatusesService } from '../valuation/demand-statuses.service';
import { FxRatesService } from '../valuation/fx-rates.service';
import { ValuationPoliciesService } from '../valuation/valuation-policies.service';
import { ValuationModule } from '../valuation/valuation.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ExportsModule } from '../exports/exports.module';
import { buildV2Document } from './openapi-v2';
import { V2Module } from './v2.module';
import { CodeMappingPreviewService } from '../code-library/code-mapping-preview.service';
import { RuleClassificationService } from '../rules/rule-classification.service';
import { RuleCommandsService } from '../rules/rule-commands.service';
import { RuleSimulationService } from '../rules/rule-simulation.service';
import { RulesModule } from '../rules/rules.module';
import { RulesService } from '../rules/rules.service';
import { withMasterDataStubs } from './master-data/master-data-v2.stubs';
import { withAdministrationStubs } from './administration/administration-v2.stubs';
import { ActivitySummaryV2Service } from './activity-summary/activity-summary-v2.service';

/** Stands in for the global common module: the clock the event writes read (DT-09). */
@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
class ClockModuleStub {}

/** Stands in for the v1 event module (and its RCA/realtime graph): only the document is needed. */
@Module({
  providers: [
    { provide: ProductionEventService, useValue: {} },
    { provide: EventRevisionService, useValue: {} },
  ],
  exports: [ProductionEventService, EventRevisionService],
})
class ProductionEventModuleStub {}

/** Stands in for the plan 1.3 modules (code libraries, mappings): only their controllers' routes matter. */
@Module({
  providers: [
    { provide: CodeLibraryService, useValue: {} },
    { provide: CodeLibraryCommandService, useValue: {} },
    { provide: CodeMappingRuleService, useValue: {} },
    { provide: CodeDefaultsService, useValue: {} },
    { provide: CodeMappingPreviewService, useValue: {} },
  ],
  exports: [
    CodeLibraryService,
    CodeLibraryCommandService,
    CodeMappingRuleService,
    CodeDefaultsService,
    CodeMappingPreviewService,
  ],
})
class CodeLibraryModuleStub {}

@Module({
  providers: [{ provide: SourceMappingService, useValue: {} }],
  exports: [SourceMappingService],
})
class SourceMappingModuleStub {}

@Module({
  providers: [{ provide: AttributeMappingService, useValue: {} }],
  exports: [AttributeMappingService],
})
class AttributeMappingModuleStub {}

/** Stands in for the plan 1.4 event operations (commands, bulk coding, jobs). */
@Module({
  providers: [
    { provide: EventCommandService, useValue: {} },
    { provide: BulkCodeService, useValue: {} },
    { provide: BulkJobService, useValue: {} },
  ],
  exports: [EventCommandService, BulkCodeService, BulkJobService],
})
class EventOperationsModuleStub {}

/** Stands in for the plan 1.5 intake module (connections, jobs, replay, quarantine). */
@Module({
  providers: [
    { provide: IntegrationConnectionService, useValue: {} },
    { provide: IngestionJobsService, useValue: {} },
    { provide: ReplayService, useValue: {} },
    { provide: IngestionExceptionsService, useValue: {} },
  ],
  exports: [
    IntegrationConnectionService,
    IngestionJobsService,
    ReplayService,
    IngestionExceptionsService,
  ],
})
class IntakeModuleStub {}

/** Stands in for the plan 1.7 signals module (definitions, preview, backfill). */
@Module({
  providers: [
    { provide: SignalsService, useValue: {} },
    { provide: SignalPreviewService, useValue: {} },
    { provide: SignalBackfillService, useValue: {} },
  ],
  exports: [SignalsService, SignalPreviewService, SignalBackfillService],
})
class SignalsModuleStub {}

/** Stands in for the plan 2.1 calendar module (versions, publication, preview, crews, sites). */
@Module({
  providers: [
    { provide: SitesService, useValue: {} },
    { provide: CalendarVersionsService, useValue: {} },
    { provide: CalendarPublishService, useValue: {} },
    { provide: CalendarPreviewService, useValue: {} },
    { provide: CrewsService, useValue: {} },
  ],
  exports: [
    SitesService,
    CalendarVersionsService,
    CalendarPublishService,
    CalendarPreviewService,
    CrewsService,
  ],
})
class CalendarModuleStub {}

/** Stands in for the plan 2.2 profiles module (profiles, rates, valuation rates, imports, resolution). */
@Module({
  providers: [
    { provide: ProfilesService, useValue: {} },
    { provide: RatesService, useValue: {} },
    { provide: ValuationRatesService, useValue: {} },
    { provide: TransitionStandardsService, useValue: {} },
    { provide: ProfileResolutionService, useValue: {} },
    { provide: RateImportsService, useValue: {} },
  ],
  exports: [
    ProfilesService,
    RatesService,
    ValuationRatesService,
    TransitionStandardsService,
    ProfileResolutionService,
    RateImportsService,
  ],
})
class ProfilesModuleStub {}

/** Stands in for the plan 2.3 plans module (versions, generation, approval, scenarios, jobs). */
@Module({
  providers: [
    { provide: PlanScenariosService, useValue: {} },
    { provide: PlanVersionsService, useValue: {} },
    { provide: PlanPeriodGeneratorService, useValue: {} },
    { provide: PlanApprovalService, useValue: {} },
    { provide: PlanReviewService, useValue: {} },
    { provide: PlanGenerationJobsService, useValue: {} },
    { provide: PlanLegacyBridge, useValue: {} },
  ],
  exports: [
    PlanScenariosService,
    PlanVersionsService,
    PlanPeriodGeneratorService,
    PlanApprovalService,
    PlanReviewService,
    PlanGenerationJobsService,
    PlanLegacyBridge,
  ],
})
class PlansModuleStub {}

/** Stands in for the plan 2.4 periods module (materializer, actuals jobs, adjustments, external reports). */
@Module({
  providers: [
    { provide: PeriodsService, useValue: {} },
    { provide: ActualsJobsService, useValue: {} },
    { provide: ActualsAdjustmentsService, useValue: {} },
    { provide: ExternalReportsService, useValue: {} },
    { provide: AccountingPoliciesService, useValue: {} },
  ],
  exports: [
    PeriodsService,
    ActualsJobsService,
    ActualsAdjustmentsService,
    ExternalReportsService,
    AccountingPoliciesService,
  ],
})
class PeriodsModuleStub {}

/** Stands in for the plan 2.5 accounting module (calculation runs, recalculation command). */
@Module({
  providers: [{ provide: AccountingCommandsService, useValue: {} }],
  exports: [AccountingCommandsService],
})
class AccountingModuleStub {}

/** Stands in for the plan 2.8 workflow module (draft lines, submission, approval, lifecycle, proposals). */
@Module({
  providers: [
    { provide: DraftLinesService, useValue: {} },
    { provide: SubmissionService, useValue: {} },
    { provide: ApprovalService, useValue: {} },
    { provide: RevisionLifecycleService, useValue: {} },
    { provide: ChangeProposalsService, useValue: {} },
  ],
  exports: [
    DraftLinesService,
    SubmissionService,
    ApprovalService,
    RevisionLifecycleService,
    ChangeProposalsService,
  ],
})
class ReconciliationModuleStub {}

/** Stands in for the plan 2.9 exports module (requests, reads, render jobs, delivery reconciliation). */
@Module({
  providers: [
    { provide: ExportRequestsService, useValue: {} },
    { provide: ExportReadsService, useValue: {} },
    { provide: ExportJobsService, useValue: {} },
    { provide: DeliveryReconciliationService, useValue: {} },
  ],
  exports: [
    ExportRequestsService,
    ExportReadsService,
    ExportJobsService,
    DeliveryReconciliationService,
  ],
})
class ExportsModuleStub {}

/** Stands in for the plan 2.6 valuation module (FX rates, valuation policies). */
@Module({
  providers: [
    { provide: FxRatesService, useValue: {} },
    { provide: ValuationPoliciesService, useValue: {} },
    { provide: DemandStatusesService, useValue: {} },
  ],
  exports: [FxRatesService, ValuationPoliciesService, DemandStatusesService],
})
class ValuationModuleStub {}

/** Stands in for the plan 3.1 feature-flag module. */
@Module({
  providers: [{ provide: FeatureFlagsService, useValue: {} }],
  exports: [FeatureFlagsService],
})
class FeatureFlagsModuleStub {}

/** Stands in for the plan 3.8 declarative rules module. */
const RULE_SERVICES = [
  RulesService,
  RuleCommandsService,
  RuleSimulationService,
  RuleClassificationService,
];
@Module({
  providers: RULE_SERVICES.map((provide) => ({ provide, useValue: {} })),
  exports: RULE_SERVICES,
})
class RulesModuleStub {}

/** Stands in for the plan 3.9 RCA case module. */
const RCA_SERVICES = [
  RcaCasesService,
  RcaCaseCommandsService,
  RcaAnalysesService,
  RcaAttachmentsService,
  RcaLinksService,
  RcaRecommendationsService,
  RcaActionsService,
];
@Module({
  providers: RCA_SERVICES.map((provide) => ({ provide, useValue: {} })),
  exports: RCA_SERVICES,
})
class RcaCaseModuleStub {}

/** Stands in for the v2 RCA knowledge base module (owner decision 2026-10-12). */
const KNOWLEDGE_SERVICES = [
  RcaKnowledgeV2Service,
  RcaKnowledgeV2CommandsService,
  RcaKnowledgeSimilarService,
];
@Module({
  providers: KNOWLEDGE_SERVICES.map((provide) => ({ provide, useValue: {} })),
  exports: KNOWLEDGE_SERVICES,
})
class RcaKnowledgeModuleStub {}

/** Committed contract of /api/v2 (plan 0.4 step 8b). Regenerate: `npm run openapi:v2:update`. */
const SNAPSHOT = resolve(__dirname, '..', '..', 'openapi', 'v2.json');

async function generate(): Promise<string> {
  const moduleRef = await withAdministrationStubs(withMasterDataStubs(Test.createTestingModule({ imports: [V2Module, ClockModuleStub] })))
    .overrideProvider(getRepositoryToken(ProductionEvent))
    .useValue({})
    .overrideProvider(getRepositoryToken(Unit))
    .useValue({})
    .overrideProvider(getRepositoryToken(Product))
    .useValue({})
    .overrideProvider(getRepositoryToken(Asset))
    .useValue({})
    .overrideProvider(getRepositoryToken(ReasonCode))
    .useValue({})
    .overrideProvider(getRepositoryToken(ProductionPlan))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventRevision))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventCoding))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventReviewItem))
    .useValue({})
    .overrideProvider(getRepositoryToken(SourceMapping))
    .useValue({})
    .overrideProvider(getRepositoryToken(AttributeMappingVersion))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventRelation))
    .useValue({})
    .overrideProvider(getRepositoryToken(IntegrationConnection))
    .useValue({})
    .overrideProvider(getRepositoryToken(IngestionJob))
    .useValue({})
    .overrideProvider(getRepositoryToken(IngestionJobTransition))
    .useValue({})
    .overrideProvider(getRepositoryToken(IngestionException))
    .useValue({})
    .overrideProvider(getRepositoryToken(ReplayRun))
    .useValue({})
    .overrideProvider(getRepositoryToken(Signal))
    .useValue({})
    .overrideProvider(getRepositoryToken(Site))
    .useValue({})
    .overrideProvider(getRepositoryToken(CalendarVersion))
    .useValue({})
    .overrideProvider(getRepositoryToken(ShiftInstance))
    .useValue({})
    .overrideProvider(getRepositoryToken(Crew))
    .useValue({})
    .overrideProvider(getRepositoryToken(CrewRotation))
    .useValue({})
    .overrideProvider(getRepositoryToken(ProductionProfile))
    .useValue({})
    .overrideProvider(getRepositoryToken(UnitProductRate))
    .useValue({})
    .overrideProvider(getRepositoryToken(ValuationRate))
    .useValue({})
    .overrideProvider(getRepositoryToken(GradeTransitionStandard))
    .useValue({})
    .overrideProvider(getRepositoryToken(PlanVersion))
    .useValue({})
    .overrideProvider(getRepositoryToken(PlanPeriod))
    .useValue({})
    .overrideProvider(getRepositoryToken(PlanScenario))
    .useValue({})
    .overrideProvider(getRepositoryToken(ProductionPeriod))
    .useValue({})
    .overrideProvider(getRepositoryToken(CalculationRun))
    .useValue({})
    .overrideProvider(ActivitySummaryV2Service)
    .useValue({})
    .overrideModule(ProductionEventModule)
    .useModule(ProductionEventModuleStub)
    .overrideModule(CodeLibraryModule)
    .useModule(CodeLibraryModuleStub)
    .overrideModule(SourceMappingModule)
    .useModule(SourceMappingModuleStub)
    .overrideModule(AttributeMappingModule)
    .useModule(AttributeMappingModuleStub)
    .overrideModule(EventOperationsModule)
    .useModule(EventOperationsModuleStub)
    .overrideModule(IntakeModule)
    .useModule(IntakeModuleStub)
    .overrideModule(SignalsModule)
    .useModule(SignalsModuleStub)
    .overrideModule(CalendarModule)
    .useModule(CalendarModuleStub)
    .overrideModule(ProfilesModule)
    .useModule(ProfilesModuleStub)
    .overrideModule(PlansModule)
    .useModule(PlansModuleStub)
    .overrideModule(PeriodsModule)
    .useModule(PeriodsModuleStub)
    .overrideModule(AccountingModule)
    .useModule(AccountingModuleStub)
    .overrideModule(ReconciliationModule)
    .useModule(ReconciliationModuleStub)
    .overrideModule(ExportsModule)
    .useModule(ExportsModuleStub)
    .overrideModule(ValuationModule)
    .useModule(ValuationModuleStub)
    .overrideModule(FeatureFlagsModule)
    .useModule(FeatureFlagsModuleStub)
    .overrideModule(RulesModule)
    .useModule(RulesModuleStub)
    .overrideModule(RcaCaseModule)
    .useModule(RcaCaseModuleStub)
    .overrideModule(RcaKnowledgeModule)
    .useModule(RcaKnowledgeModuleStub)
    .compile();
  const app: INestApplication = configureHttpApp(
    moduleRef.createNestApplication(),
  );
  await app.init();
  try {
    return `${JSON.stringify(buildV2Document(app), null, 2)}\n`;
  } finally {
    await app.close();
  }
}

describe('OpenAPI v2 snapshot', () => {
  it('matches openapi/v2.json (public API contract)', async () => {
    const generated = await generate();
    if (process.env.UPDATE_OPENAPI === '1') {
      writeFileSync(SNAPSHOT, generated);
    }
    if (!existsSync(SNAPSHOT)) {
      throw new Error(`Missing ${SNAPSHOT}; run npm run openapi:v2:update`);
    }
    const committed = readFileSync(SNAPSHOT, 'utf8').replace(/\r\n/g, '\n');
    expect(generated).toBe(committed);
  });
});
