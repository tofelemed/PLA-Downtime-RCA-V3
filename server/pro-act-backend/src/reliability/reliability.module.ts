import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FailureDictionaryEntry } from './entities/failure-dictionary-entry.entity';
import { StandbyEquipment } from './entities/standby-equipment.entity';
import { StandbyRecord } from './entities/standby-record.entity';
import { UnitStateMapping } from './entities/unit-state-mapping.entity';
import { WorkOrderOperation } from './entities/work-order-operation.entity';
import { FailureDictionaryValidator } from './failure-dictionary/failure-dictionary.validator';

export const RELIABILITY_ENTITIES = [
  FailureDictionaryEntry,
  StandbyEquipment,
  StandbyRecord,
  WorkOrderOperation,
  UnitStateMapping,
];

/**
 * Reliability master data and records of SME D1 / D2 / D9 / D10 / D11: the failure dictionary, standby
 * demand and test records, CMMS work-order operations and unit state mappings. The v2 API lives in
 * `src/v2/reliability`; event writes use the dictionary validator.
 */
@Module({
  imports: [TypeOrmModule.forFeature(RELIABILITY_ENTITIES)],
  providers: [FailureDictionaryValidator],
  exports: [FailureDictionaryValidator, TypeOrmModule],
})
export class ReliabilityModule {}
