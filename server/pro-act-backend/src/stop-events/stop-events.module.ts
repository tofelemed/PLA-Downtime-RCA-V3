import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../common/outbox/outbox.module';
import { PeriodsModule } from '../periods/periods.module';
import { ProductionEventModule } from '../production-event/production-event.module';
import { RulesModule } from '../rules/rules.module';
import { DerivedStopEngineService } from './derived-stop-engine.service';
import { EventImpact } from './entities/event-impact.entity';
import { StateEngineCursor } from './entities/state-engine-cursor.entity';
import { StopIncidentBreak } from './entities/stop-incident-break.entity';
import { StopIncidentMember } from './entities/stop-incident-member.entity';
import { StopIncident } from './entities/stop-incident.entity';
import { StopReconciliation } from './entities/stop-reconciliation.entity';
import { IncidentGroupingService } from './incident-grouping.service';
import { StateEngineJob } from './state-engine.job';
import { StopEventDecisionsService } from './stop-event-decisions.service';
import { StopEventSettingsService } from './stop-event-settings.service';
import { StopEventsConsumer } from './stop-events.consumer';
import { StopReconciliationService } from './stop-reconciliation.service';
import { UnitImpactConsumer } from './unit-impact.consumer';
import { UnitImpactService } from './unit-impact.service';

export const STOP_EVENT_ENTITIES = [
  StopReconciliation,
  StopIncident,
  StopIncidentMember,
  StopIncidentBreak,
  StateEngineCursor,
  EventImpact,
];

/**
 * Plan 1.10 state-derived stop events and DT-04 / SME D5 stop handling: the state engine (worker cron),
 * duplicate reconciliation and incident grouping (run by the engine and by the event-change consumer),
 * unit impact resolution (unit impact rules, standby takeover, plan 1.10 step 4) and the people's decisions the v2 API exposes (`src/v2/stop-events`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(STOP_EVENT_ENTITIES),
    OutboxModule,
    PeriodsModule,
    ProductionEventModule,
    RulesModule,
  ],
  providers: [
    StopEventSettingsService,
    StopReconciliationService,
    IncidentGroupingService,
    DerivedStopEngineService,
    StateEngineJob,
    StopEventsConsumer,
    StopEventDecisionsService,
    UnitImpactService,
    UnitImpactConsumer,
  ],
  exports: [TypeOrmModule, StopEventSettingsService, StopEventDecisionsService],
})
export class StopEventsModule {}
