import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodsModule } from '../../periods/periods.module';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { LossStatementV2Controller } from './loss-statement-v2.controller';
import { LossStatementV2Service } from './loss-statement-v2.service';

/**
 * The loss accounting statement (Task 13): `GET /v2/reports/loss-statement` and the statement service the
 * day view (CloseV2Module) and the period reconciliation view (V2Module) use. Included in the v2 OpenAPI
 * document (`openapi-v2.ts`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProductionPeriod]), PeriodsModule],
  controllers: [LossStatementV2Controller],
  providers: [LossStatementV2Service],
  exports: [LossStatementV2Service],
})
export class LossStatementV2Module {}
