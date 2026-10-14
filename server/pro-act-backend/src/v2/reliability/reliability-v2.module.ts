import { Module } from '@nestjs/common';
import { PeriodsModule } from '../../periods/periods.module';
import { ReliabilityModule } from '../../reliability/reliability.module';
import { FailureDictionaryImportV2Service } from './failure-dictionary-import-v2.service';
import { FailureDictionaryV2Controller } from './failure-dictionary-v2.controller';
import { FailureDictionaryV2Service } from './failure-dictionary-v2.service';
import { MicroStopPolicyV2Controller } from './micro-stop-policy-v2.controller';
import { MicroStopPolicyV2Service } from './micro-stop-policy-v2.service';
import { StandbyEquipmentV2Service } from './standby-equipment-v2.service';
import { StandbyRecordsV2Service } from './standby-records-v2.service';
import { StandbyV2Controller } from './standby-v2.controller';
import { UnitStateV2Controller } from './unit-state-v2.controller';
import { UnitStateV2Service } from './unit-state-v2.service';
import { WorkOrderOperationsV2Controller } from './work-order-operations-v2.controller';
import { WorkOrderOperationsV2Service } from './work-order-operations-v2.service';

/** Providers of this module that need a database (the OpenAPI snapshot stubs them). */
export const RELIABILITY_V2_SERVICES = [
  FailureDictionaryV2Service,
  FailureDictionaryImportV2Service,
  MicroStopPolicyV2Service,
  StandbyEquipmentV2Service,
  StandbyRecordsV2Service,
  WorkOrderOperationsV2Service,
  UnitStateV2Service,
];

/**
 * Reliability resources on `/api/v2` (SME D1 / D2 / D6 / D9 / D10 / D11). Imported by `V2Module` and
 * included in the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [ReliabilityModule, PeriodsModule],
  controllers: [
    FailureDictionaryV2Controller,
    MicroStopPolicyV2Controller,
    StandbyV2Controller,
    WorkOrderOperationsV2Controller,
    UnitStateV2Controller,
  ],
  providers: RELIABILITY_V2_SERVICES,
  // V2Module's event writes use the failure dictionary validator
  exports: [ReliabilityModule],
})
export class ReliabilityV2Module {}
