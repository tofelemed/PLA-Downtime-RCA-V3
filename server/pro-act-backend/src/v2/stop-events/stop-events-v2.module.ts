import { Module } from '@nestjs/common';
import { PeriodsModule } from '../../periods/periods.module';
import { StopEventsModule } from '../../stop-events/stop-events.module';
import { OeePolicyVersionsService } from '../reliability/oee-policy-versions.service';
import { StopEventPolicyV2Controller } from './stop-event-policy-v2.controller';
import { StopEventPolicyV2Service } from './stop-event-policy-v2.service';
import { StopIncidentsV2Controller } from './stop-incidents-v2.controller';
import { StopIncidentsV2Service } from './stop-incidents-v2.service';
import { StopReconciliationsV2Controller } from './stop-reconciliations-v2.controller';
import { StopReconciliationsV2Service } from './stop-reconciliations-v2.service';

/** Providers of this module that need a database (the OpenAPI snapshot stubs them). */
export const STOP_EVENTS_V2_SERVICES = [
  StopReconciliationsV2Service,
  StopIncidentsV2Service,
  StopEventPolicyV2Service,
  OeePolicyVersionsService,
];

/**
 * Stop events on `/api/v2` (plan 1.10, DT-04, SME D5): duplicate merges and suggestions, repeat-stop
 * incidents, stop-event settings and the derived-stop preview. Imported by `V2Module` and included in
 * the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [StopEventsModule, PeriodsModule],
  controllers: [
    StopReconciliationsV2Controller,
    StopIncidentsV2Controller,
    StopEventPolicyV2Controller,
  ],
  providers: STOP_EVENTS_V2_SERVICES,
})
export class StopEventsV2Module {}
