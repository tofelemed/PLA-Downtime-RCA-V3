import { Module } from '@nestjs/common';
import { CloseModule } from '../../close/close.module';
import { MonthCloseV2Controller } from './month-close-v2.controller';

/**
 * Close resources on `/api/v2` (EXPERT_REVIEW Area 3: month close). Imported by `V2Module` and included in
 * the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [CloseModule],
  controllers: [MonthCloseV2Controller],
})
export class CloseV2Module {}
