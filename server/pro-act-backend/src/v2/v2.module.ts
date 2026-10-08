import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
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

/**
 * Home of every `/api/v2` resource (see CONVENTIONS.md). Kept separate from the v1 feature modules so the
 * v2 Swagger document can be generated from this module alone.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionEvent,
      Unit,
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
    ]),
    ProductionEventModule,
    CodeLibraryModule,
    SourceMappingModule,
    AttributeMappingModule,
    EventOperationsModule,
    IntakeModule,
    SignalsModule,
    CalendarModule,
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
  ],
  providers: [
    ProductionEventsV2Service,
    ProductionEventHistoryService,
    ProductionEventsV2CommandService,
    ProductionEventOperationsV2Service,
    EventReferencesValidator,
    SourceMappingsV2Service,
    AttributeMappingsV2Service,
    IntakeQueriesV2Service,
    SignalsV2Service,
    CalendarsV2Service,
  ],
})
export class V2Module {}
