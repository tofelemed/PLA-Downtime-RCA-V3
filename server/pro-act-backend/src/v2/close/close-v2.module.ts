import { Module } from '@nestjs/common';
import { CloseModule } from '../../close/close.module';
import { MonthCloseV2Controller } from './month-close-v2.controller';
import { PeriodSlaV2Controller } from './period-sla-v2.controller';
import { ReconciliationQueueV2Controller } from './reconciliation-queue-v2.controller';

/**
 * Close resources on `/api/v2` (EXPERT_REVIEW Area 3: month close, reconciliation SLA). Imported by `V2Module` and included in
 * the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [CloseModule],
  controllers: [
    MonthCloseV2Controller,
    PeriodSlaV2Controller,
    ReconciliationQueueV2Controller,
  ],
  // the period grid and the reports of V2Module read the SLA and the close policies
  exports: [CloseModule],
})
export class CloseV2Module {}
