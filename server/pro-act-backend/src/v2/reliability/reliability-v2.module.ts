import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../../reliability/reliability.module';
import { FailureDictionaryImportV2Service } from './failure-dictionary-import-v2.service';
import { FailureDictionaryV2Controller } from './failure-dictionary-v2.controller';
import { FailureDictionaryV2Service } from './failure-dictionary-v2.service';

/**
 * Reliability resources on `/api/v2` (SME D1 / D2 / D6 / D9 / D10 / D11). Imported by `V2Module` and
 * included in the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [ReliabilityModule],
  controllers: [FailureDictionaryV2Controller],
  providers: [FailureDictionaryV2Service, FailureDictionaryImportV2Service],
  // V2Module's event writes use the failure dictionary validator
  exports: [ReliabilityModule],
})
export class ReliabilityV2Module {}
